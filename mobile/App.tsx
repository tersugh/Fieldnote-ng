import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  type ScrollViewInstance,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { ImageManipulator, SaveFormat, type ImageManipulatorContext, type ImageRef } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as SQLite from 'expo-sqlite';
import { File } from 'expo-file-system';
import { useAudioStream, requestRecordingPermissionsAsync, setAudioModeAsync } from 'expo-audio';
import { prepareTranscriptionWav } from './voice';
import { buildCaseSummary, shareCaseSummary } from './caseSharing';
import { analyzeSavedVisit, analysisStatus, createOperationGate, type AnalysisState } from './analysis';
import { makeChecklist, updateChecklist, parseRecheck, recheckDue, type Checklist } from './caseActions';
import { CaseActions, type ActionChange } from './CaseActionPanel';

declare const process: { env: { EXPO_PUBLIC_API_BASE_URL?: string } };

type Assessment = {
  visual_observations: string;
  possible_causes: { name: string; likelihood: string; evidence?: string; what_to_check?: string }[];
  next_steps: string[];
  urgency: string;
  escalation?: string;
  follow_up_question?: string;
};

type RefinementTurn = {
  id: string;
  date: string;
  question: string;
  answer: string;
  previousAssessment: Assessment;
  assessment?: Assessment;
};

type Observation = {
  checklist?: Checklist;
  id: string;
  date: string;
  stage: string;
  location?: string;
  analysis?: AnalysisState;
  symptoms: string;
  photoUri: string;
  mimeType: string;
  assessment?: Assessment;
  refinements?: RefinementTurn[];
};

type CropCase = {
  recheckAt?: string | null;
  id: string;
  crop: string;
  location: string;
  createdAt: string;
  updatedAt: string;
  observations: Observation[];
};

type StoredCase = { record_json: string };
type PickedPhoto = { uri: string; mimeType: string; name: string; fileSize?: number | null };

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;
const APP_REVISION = 'android-parity-photo-v2';

function requirePhotoApi(method: unknown, name: string): void {
  if (typeof method !== 'function') {
    throw new Error(`${name} is unavailable in this runtime. This project requires an Expo Go runtime compatible with SDK 58.`);
  }
}

async function photoStep<T>(step: string, operation: () => T | Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error(`[${APP_REVISION}] ${step}: ${detail}`);
  }
}

const copy = {
  en: {
    title: 'Fieldnote', subtitle: 'Get crop advice. Track what works.',
    intro: 'Save crop observations on this phone. Get practical recommendations directly when you have a connection.',
    crop: 'Crop', cropHint: 'e.g. soybean, yam, cocoa', location: 'Area or community',
    stage: 'Growth stage (optional)', photo: 'Add a crop photo', camera: 'Take photo', gallery: 'Choose photo',
    notes: 'What changed?', notesHint: 'Describe the signs, when they started, and what you have tried.',
    save: 'Save field note on phone', saveAnalyze: 'Save and get crop advice',
    casebook: 'Saved cases', newCase: 'New case', followup: 'Add to this case', review: 'Get crop advice',
    noCases: 'Your saved crop cases will appear here.', active: 'Adding a dated visit to',
    offline: 'Saved on this phone. Connect to the internet to get crop advice.',
    saved: 'Field note saved on this phone.', reviewed: 'Crop recommendations added to this visit.',
    config: 'Add EXPO_PUBLIC_API_BASE_URL to connect the app to the Fieldnote server.',
    error: 'Something went wrong. Your saved field note is still on this phone.',
    assessment: 'Crop advice', possible: 'Possible explanations', next: 'What to do now',
    escalate: 'Urgency and warning signs', share: 'Share with extension worker', disclaimer: 'AI crop guidance may be uncertain. Recheck the field after acting and follow local product labels.',
    photoRequired: 'Add a crop photo and describe what changed before saving.', cropRequired: 'Enter the crop name first.',
    chooseLanguage: 'Language', latest: 'Latest visit', visits: 'visits',
  },
  ha: {
    title: 'Fieldnote', subtitle: 'Ka lura da matsala. Ka sami shawara kai tsaye.',
    intro: 'Ajiye bayanin gonarka a waya. Nemi shawarwarin noma kai tsaye idan kana da intanet.',
    crop: 'Amfanin gona', cropHint: 'misali waken soya, doya, koko', location: 'Yanki ko al’umma',
    stage: 'Matakin girma (na zaɓi)', photo: 'Ƙara hoton amfanin gona', camera: 'Ɗauki hoto', gallery: 'Zaɓi hoto',
    notes: 'Me ya canza?', notesHint: 'Bayyana alamu, lokacin da suka fara, da abin da ka gwada.',
    save: 'Ajiye bayanin gona a waya', saveAnalyze: 'Ajiye, ka nemi shawarar noma',
    casebook: 'Rahotannin da aka ajiye', newCase: 'Sabon rahoto', followup: 'Ƙara ziyara zuwa wannan rahoto', review: 'Nemi shawarar noma',
    noCases: 'Rahotannin gonakinka za su bayyana a nan.', active: 'Ana ƙara ziyara zuwa',
    offline: 'An ajiye a wannan waya. Haɗa intanet don samun shawarar noma.',
    saved: 'An ajiye bayanin gonar a wannan waya.', reviewed: 'An ƙara shawarwarin noma ga wannan ziyara.',
    config: 'Ƙara EXPO_PUBLIC_API_BASE_URL domin haɗa manhajar da sabar Fieldnote.',
    error: 'An samu matsala. Bayaninka yana nan a wannan waya.',
    assessment: 'Shawarar noma', possible: 'Abubuwan da ka iya haddasawa', next: 'Abin yi yanzu',
    escalate: 'Gaggawa da alamomin lura', share: 'Aika wa jami’in noma', disclaimer: 'Shawarar AI na iya yin kuskure. Ka sake duba gona bayan mataki kuma ka bi umarnin lakabin maganin gona.',
    photoRequired: 'Ƙara hoton gona kuma bayyana canjin kafin ajiyewa.', cropRequired: 'Rubuta sunan amfanin gonar da farko.',
    chooseLanguage: 'Harshe', latest: 'Ziyara ta ƙarshe', visits: 'ziyara',
  },
} as const;

const webCopy = {
  en: {
    prototype: 'Hackathon prototype', eyebrow: 'CROP INCIDENT FOLLOW-UP', headline: 'Notice a change.<br /><em>Know what to do next.</em>',
    intro: 'Share a crop photo and field notes to get practical recommendations directly. Return with dated updates to see what changed and decide what to do next.',
    story: 'Born from a family story about soybean losses—and built to put timely, understandable crop advice directly in farmers’ hands.',
    model: 'Meta Muse Spark · crop advice and follow-up recommendations', formMode: 'NEW CROP INCIDENT', formTitle: 'What are you seeing?',
    cropLabel: 'Which crop?', required: 'Required', selectCrop: 'Select a crop', otherCrop: 'Other crop', otherCropPlaceholder: 'Enter the crop name',
    photoLabel: 'A clear crop photo', choosePhoto: 'Choose a crop photo', photoHint: 'JPG, PNG, or WebP · up to 8 MB',
    symptomsLabel: 'Describe the change', symptomsPlaceholder: 'For example: yellow spots appeared on older leaves after several rainy days…',
    fieldHint: 'What changed, when it started, and whether it is spreading.', stageLabel: 'Growth stage', optional: 'Optional',
    selectStage: 'Select if known', locationLabel: 'Area', locationPlaceholder: 'e.g. Makurdi, Benue',
    privacy: 'Cases and photos are saved in this browser only. Photos go to Meta for analysis; voice audio goes to Meta for transcription. The server does not save them.',
    submit: 'Get crop advice', disclaimer: 'AI crop guidance can be uncertain. Check it against what you see in the field; use any crop-protection product only as its local label directs.',
    resultLabel: 'YOUR FIELD CASE', resultTitle: 'Careful guidance, not guesswork.', empty: 'After you share a photo and symptoms, your field note will appear here.',
    loadingTitle: 'Looking closely…', loadingCopy: 'Checking the image alongside your notes.', resultFoot: 'FIELDNOTE · A FIRST STEP TOWARD TIMELY HELP',
    casebookLabel: 'FIELDNOTE CASEBOOK', casebookTitle: 'Keep track of what changes.',
    casebookCopy: 'Cases are stored on this device. Follow progress and recommendations, then share the case with an extension worker if you want a second opinion.',
    newCase: 'New incident', casebookEmpty: 'Your saved crop incidents will appear here on this device.',
    footer: 'Built during Meta Global AI Developer Hackathon · 2026', voiceButton: 'Record voice note',
    voiceHint: 'Speak in English; your transcript will be added here for review.', voiceHausaOff: 'Hausa voice transcription is not verified. Type your note in Hausa instead.', voiceButtonHausa: 'Hausa voice off',
    voiceUnsupported: 'Voice recording is not supported in this browser. Type your observations instead.', voiceDenied: 'Microphone access was unavailable. Allow microphone access or type your observations.',
    voiceRecording: 'Stop recording', voiceTranscribing: 'Transcribing…', voiceConverting: 'Converting your voice note to editable text…',
    voiceReview: 'Transcript added. Review or edit it before submitting your field note.', voiceFailed: 'Could not transcribe this recording. Type your observations instead.',
    newFollowup: 'Choose a new visit photo', comparing: 'Compare with earlier visit', create: 'Get crop advice',
    firstLoading: 'Reviewing first visit…', followLoading: 'Comparing visits…', visit: 'visit', visits: 'visits',
    updated: 'Updated', noLocation: 'Location not added', print: 'Print field plan', share: 'Share with extension worker', addFollowup: 'Add follow-up',
    observation: 'What stands out', change: 'What changed between visits', causes: 'Possible explanations', checks: 'Check:',
    noCauses: 'The available photos do not support a clear shortlist yet.', next: 'What to do now', urgency: 'Urgency and warning signs',
    followQuestion: 'One question to improve this advice:', disclaimerResult: 'AI-generated crop guidance may be uncertain. Recheck the field after acting; follow local product labels and precautions.',
    likelihood: 'likelihood', low: 'Low', moderate: 'Moderate', high: 'High', uncertain: 'Uncertain',
    noChecks: 'No specific checks were suggested.', startMode: 'NEW CROP INCIDENT', followMode: 'FOLLOW-UP VISIT',
    activeCase: (crop: string, count: number) => `${crop} · ${count} previous ${count === 1 ? 'visit' : 'visits'}`,
    chooseLanguage: 'Choose language', ariaHome: 'Fieldnote home', ariaWorkspace: 'Crop incident form',
    areaNoLocation: 'Location not added', errorCrop: 'Choose a crop or enter its name.',
  },
  ha: {
    prototype: 'Samfurin gwajin hackathon', eyebrow: 'BINCIKEN RAHOTON MATSALAR GONA', headline: 'Ka lura da canji.<br /><em>Ka san mataki na gaba.</em>',
    intro: 'Aika hoton amfanin gona da bayanin gona domin samun shawarwari masu amfani kai tsaye. Ka dawo da sabon bayani mai kwanan wata domin ganin canji da sanin mataki na gaba.',
    story: 'An samo ra’ayin ne daga labarin asarar waken soya a gonar kakata. An gina Fieldnote domin kai shawarar noma mai sauƙin fahimta kai tsaye ga manoma.',
    model: 'Meta Muse Spark · shawarwarin noma da bibiyar canji', formMode: 'SABON RAHOTON GONA', formTitle: 'Me ka lura da shi?',
    cropLabel: 'Wane amfanin gona?', required: 'Dole', selectCrop: 'Zaɓi amfanin gona', otherCrop: 'Wani amfanin gona', otherCropPlaceholder: 'Rubuta sunan amfanin gonar',
    photoLabel: 'Hoto bayyananne na shukar', choosePhoto: 'Zaɓi hoton shuka', photoHint: 'JPG, PNG ko WebP · har zuwa 8 MB',
    symptomsLabel: 'Bayyana abin da ya canza', symptomsPlaceholder: 'Misali: ganyen da suka tsufa sun fara yin rawaya bayan ruwan sama…',
    fieldHint: 'Me ya canza, yaushe aka fara gani, kuma ko yana ƙaruwa.', stageLabel: 'Matakin girma', optional: 'Zaɓi idan kana so',
    selectStage: 'Zaɓi idan ka sani', locationLabel: 'Wuri', locationPlaceholder: 'Misali: Kano',
    privacy: 'Ana adana rahotanni da hotuna a wannan burauzar kawai. Ana aika hotuna ga Meta idan ka nemi tantancewa. Rikodin muryar Turanci yana zuwa ga Meta domin mayar da shi rubutu; ba a tabbatar da gane muryar Hausa ba tukuna.',
    submit: 'Nemi shawarar noma', disclaimer: 'Shawarar AI na iya yin kuskure. Ka duba abin da ke faruwa a gona; idan za ka yi amfani da maganin gona, bi umarnin lakabinsa na gida.',
    resultLabel: 'RAHOTON GONARKA', resultTitle: 'Jagora cikin kulawa, ba zato kawai ba.', empty: 'Rahotonka zai bayyana a nan bayan ka aika hoto da bayanin abin da ka lura da shi.',
    loadingTitle: 'Ana duba hoton…', loadingCopy: 'Ana nazarin hoton tare da bayaninka.', resultFoot: 'FIELDNOTE · MATAKIN FARKO NA NEMAN TAIMAKO DA WURI',
    casebookLabel: 'LITTAFIN RAHOTON GONA', casebookTitle: 'Ka bibiyi abin da ke canzawa.',
    casebookCopy: 'Ana adana rahotanni a wannan na’ura. Ka bibiyi ci gaba da shawarwari, sannan ka aika rahoton ga jami’in noma idan kana son ƙarin ra’ayi.',
    newCase: 'Sabon rahoto', casebookEmpty: 'Rahotannin gonakinka da ka adana za su bayyana a nan.',
    footer: 'An gina shi a Meta Global AI Developer Hackathon · 2026', voiceButton: 'Yi rikodin murya',
    voiceHint: 'Yi magana da Turanci; za a nuna rubutun nan domin ka duba.', voiceHausaOff: 'Ba a tabbatar da gane muryar Hausa ba. Ka rubuta bayaninka da Hausa.', voiceButtonHausa: 'Ba a buɗe muryar Hausa ba',
    voiceUnsupported: 'Wannan burauzar ba ta goyon bayan rikodin murya. Ka rubuta abin da ka lura da shi.', voiceDenied: 'Ba a samu damar amfani da makirufo ba. Ka ba da izini ko ka rubuta bayaninka.',
    voiceRecording: 'Dakatar da rikodi', voiceTranscribing: 'Ana mayar da murya rubutu…', voiceConverting: 'Ana shirya rubutun murya…',
    voiceReview: 'An saka rubutun. Ka duba ko gyara shi kafin aika rahoto.', voiceFailed: 'Ba a iya mayar da wannan rikodi rubutu ba. Ka rubuta bayaninka.',
    newFollowup: 'Zaɓi sabon hoton ziyara', comparing: 'Kwatanta da ziyarar baya', create: 'Nemi shawarar noma',
    firstLoading: 'Ana duba ziyarar farko…', followLoading: 'Ana kwatanta ziyarori…', visit: 'ziyara', visits: 'ziyarori',
    updated: 'An sabunta', noLocation: 'Ba a saka wuri ba', print: 'Buga tsarin aikin gona', share: 'Aika wa jami’in noma', addFollowup: 'Ƙara ziyara',
    observation: 'Abin da aka lura da shi', change: 'Canjin da aka gani tsakanin ziyarori', causes: 'Abubuwan da ka iya haddasawa', checks: 'Abin dubawa:',
    noCauses: 'Hotunan ba su isa a tantance abubuwan da ka iya haddasawa ba tukuna.', next: 'Abin yi yanzu', urgency: 'Gaggawa da alamomin lura',
    followQuestion: 'Tambayar da za ta inganta shawarar:', disclaimerResult: 'Taimakon tantancewa da AI ne, ba tabbataccen ganewar cuta ba. Kada a yanke shawarar magani bisa wannan sakamakon kaɗai.',
    likelihood: 'yiwuwar faruwa', low: 'Ƙaranci', moderate: 'Matsakaici', high: 'Mai yawa', uncertain: 'Ba a tabbatar ba',
    noChecks: 'Ba a ba da takamaiman abin dubawa ba.', startMode: 'SABON RAHOTON GONA', followMode: 'ZIYARAR BIYO-BAYA',
    activeCase: (crop: string, count: number) => `${crop} · ziyarori ${count} da suka gabata`,
    chooseLanguage: 'Zaɓi harshe', ariaHome: 'Shafin farko na Fieldnote', ariaWorkspace: 'Fom ɗin rahoton gona',
    areaNoLocation: 'Ba a saka wuri ba', errorCrop: 'Zaɓi amfanin gona ko rubuta sunansa.',
  },
};


const cropNames: { ha: Record<string, string> } = {
  ha: { Soybean: 'Waken soya', Cocoa: 'Koko', Yam: 'Doya', Cassava: 'Rogo', Maize: 'Masara', Rice: 'Shinkafa', 'Oil palm': 'Dabino mai (oil palm)', Groundnut: 'Gyada', Sesame: 'Ridi', Sorghum: 'Dawa', Cowpea: 'Wake', Cashew: 'Kashu (cashew)', Ginger: 'Citta', Hibiscus: 'Karkade', Rubber: 'Roba', Cotton: 'Auduga', Shea: 'Kadanya (shea)', 'Chili pepper': 'Barkono mai zafi', Tomato: 'Tumatir', Sugarcane: 'Rake', Millet: 'Gero', Coffee: 'Kofi', 'Kola nut': 'Goro', 'Gum arabic': 'Danko (gum arabic)', Turmeric: 'Kurkum', Moringa: 'Zogale', Tobacco: 'Taba', Plantain: 'Ayaba babba (plantain)', Banana: 'Ayaba', Mango: 'Mangwaro', Pineapple: 'Abarba', Egusi: 'Agushi' },
};


const CROPS: string[] = ["Soybean","Cocoa","Yam","Cassava","Maize","Rice","Oil palm","Groundnut","Sesame","Sorghum","Cowpea","Cashew","Ginger","Hibiscus","Rubber","Cotton","Shea","Chili pepper","Tomato","Sugarcane","Millet","Coffee","Kola nut","Gum arabic","Turmeric","Moringa","Tobacco","Plantain","Banana","Mango","Pineapple","Egusi","Other"];
const STAGES: string[] = ["Seedling / early growth","Vegetative / leaf growth","Flowering","Fruit, pod, or tuber development","Maturity / harvest"];
const HA_STAGES = ['Matashin shuka', 'Girman ganye', 'Fure', 'Samar da ’ya’ya ko ƙwaya', 'Balaga ko girbi'];

type Language = keyof typeof copy;

function openDatabase(): Promise<SQLite.SQLiteDatabase> {
  if (!databasePromise) {
    databasePromise = (async () => {
      const db = await SQLite.openDatabaseAsync('fieldnote.db');
      await db.execAsync(`CREATE TABLE IF NOT EXISTS cases (
        id TEXT PRIMARY KEY NOT NULL,
        crop TEXT NOT NULL,
        location TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        record_json TEXT NOT NULL
      );`);
      return db;
    })();
  }
  return databasePromise;
}

async function loadCases(): Promise<CropCase[]> {
  const db = await openDatabase();
  const rows = await db.getAllAsync<StoredCase>('SELECT record_json FROM cases ORDER BY updated_at DESC');
  return rows.map((row) => JSON.parse(row.record_json) as CropCase);
}

async function persistCase(record: CropCase): Promise<void> {
  const db = await openDatabase();
  await db.runAsync(
    'INSERT OR REPLACE INTO cases (id, crop, location, updated_at, record_json) VALUES (?, ?, ?, ?, ?)',
    record.id,
    record.crop,
    record.location,
    record.updatedAt,
    JSON.stringify(record),
  );
}

async function loadSavedCase(id: string): Promise<CropCase> {
  const db = await openDatabase();
  const row = await db.getFirstAsync<StoredCase>('SELECT record_json FROM cases WHERE id = ?', id);
  if (!row) throw new Error('The saved case could not be opened.');
  return JSON.parse(row.record_json) as CropCase;
}

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function savePhotoPermanently(photo: PickedPhoto, observationId: string): Promise<string> {
  return photoStep('Copy photo into app-private storage (FileSystem.copyAsync)', async () => {
    if (!FileSystem.documentDirectory) throw new Error('Phone storage is unavailable.');
    requirePhotoApi(FileSystem.copyAsync, 'FileSystem.copyAsync');
    const extension = photo.mimeType === 'image/png' ? 'png' : photo.mimeType === 'image/webp' ? 'webp' : 'jpg';
    const target = `${FileSystem.documentDirectory}fieldnote-${observationId}.${extension}`;
    await FileSystem.copyAsync({ from: photo.uri, to: target });
    return target;
  });
}

async function imageAsDataUrl(observation: Observation): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(observation.photoUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${observation.mimeType};base64,${base64}`;
}


function Dropdown({ label, value, options, onChange, disabled, closeLabel }: {
  label: string; value: string; options: { value: string; label: string }[];
  onChange: (value: string) => void; disabled?: boolean; closeLabel: string;
}) {
  const [open, setOpen] = useState(false);
  return <>
    <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled, expanded: open }} disabled={disabled} onPress={() => setOpen(true)} style={[styles.input, styles.select, disabled && styles.disabled]}>
      <Text style={[styles.selectText, !value && styles.placeholder]}>{options.find((option) => option.value === value)?.label || value}</Text><Text style={styles.selectArrow}>⌄</Text>
    </Pressable>
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <View style={styles.modalBackdrop}><View style={styles.modalCard} accessibilityViewIsModal>
        <Text style={styles.sectionTitle}>{label}</Text>
        <ScrollView>{options.map((option) => <Pressable key={option.value} accessibilityRole="radio" accessibilityState={{ checked: value === option.value }} onPress={() => { onChange(option.value); setOpen(false); }} style={[styles.option, value === option.value && styles.optionSelected]}>
          <Text style={styles.body}>{option.label}{value === option.value ? '  ✓' : ''}</Text>
        </Pressable>)}</ScrollView>
        <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.outlineButton}><Text style={styles.outlineText}>{closeLabel}</Text></Pressable>
      </View></View>
    </Modal>
  </>;
}

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [cases, setCases] = useState<CropCase[]>([]);
  const [sharePreview, setSharePreview] = useState<string | null>(null);
  const [shareStatus, setShareStatus] = useState('');
  const [sharing, setSharing] = useState(false);
  const sharePending = useRef(false);
  const [activeCase, setActiveCase] = useState<CropCase | null>(null);
  const [crop, setCrop] = useState('');
  const [location, setLocation] = useState('');
  const [stage, setStage] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const actionSaving = useRef(false);
  const [reminderClock, setReminderClock] = useState(Date.now());
  useEffect(() => {
    const timer = setInterval(() => setReminderClock(Date.now()), 30000);
    const subscription = AppState.addEventListener('change', state => { if (state === 'active') setReminderClock(Date.now()); });
    return () => { clearInterval(timer); subscription.remove(); };
  }, []);
  const analysisGate = useMemo(() => createOperationGate(), []);
  const [status, setStatus] = useState('');
  const [selectedObservationId, setSelectedObservationId] = useState<string | null>(null);
  const [refineAnswer, setRefineAnswer] = useState('');
  const refineSubmitting = useRef(false);
  const t = copy[language];

  const [cropChoice, setCropChoice] = useState('');
  const [photoBusy, setPhotoBusy] = useState(false);
  const [voiceState, setVoiceState] = useState<'idle' | 'permission' | 'recording' | 'transcribing' | 'success' | 'error'>('idle');
  const [voiceMessage, setVoiceMessage] = useState('');
  const [voiceDiagnostics, setVoiceDiagnostics] = useState('');
  const symptomsRef = useRef(symptoms);
  symptomsRef.current = symptoms;
  const [seconds, setSeconds] = useState(0);
  const { stream } = useAudioStream({ sampleRate: 24000, channels: 1, encoding: 'int16' });
  const voicePhase = useRef('idle');
  const voiceSession = useRef(0);
  const voiceFile = useRef<string | null>(null);
  const voiceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const voiceClock = useRef<ReturnType<typeof setInterval> | null>(null);
  const voiceRequest = useRef<AbortController | null>(null);
  const scroll = useRef<ScrollViewInstance | null>(null);
  const w = webCopy[language];
  const voiceActive = ['permission', 'recording', 'transcribing'].includes(voiceState);
  const locked = busy || photoBusy || voiceActive || actionBusy;

  function clearVoiceTimers() {
    if (voiceTimer.current) clearTimeout(voiceTimer.current);
    if (voiceClock.current) clearInterval(voiceClock.current);
    voiceTimer.current = null;
    voiceClock.current = null;
  }

  async function removeVoiceFile() {
    const uri = voiceFile.current;
    voiceFile.current = null;
    if (uri) await FileSystem.deleteAsync(uri, { idempotent: true }).catch(() => {});
  }

  useEffect(() => {
    const audioSubscription = stream.addListener('audioStreamStatus', ({ isStreaming }) => {
      if (!isStreaming && voicePhase.current === 'recording') {
        voiceSession.current += 1;
        clearVoiceTimers();
        void removeVoiceFile();
        voicePhase.current = 'idle';
        setVoiceState('error');
        setVoiceMessage('Microphone recording was interrupted. Please try again or type your observations.');
        void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
    });
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active' && ['recording', 'transcribing'].includes(voicePhase.current)) {
        voiceSession.current += 1;
        clearVoiceTimers();
        voiceRequest.current?.abort();
        try { stream.stop(); } catch { /* Already interrupted by the OS. */ }
        void removeVoiceFile();
        voicePhase.current = 'idle';
        setVoiceState('error');
        setVoiceMessage('Recording or transcription interrupted. Your typed notes are unchanged; try again.');
        void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      }
    });
    return () => {
      subscription.remove();
      audioSubscription.remove();
      voiceSession.current += 1;
      clearVoiceTimers();
      voiceRequest.current?.abort();
      try { stream.stop(); } catch { /* The hook may already have released the stream. */ }
      void removeVoiceFile();
      void setAudioModeAsync({ allowsRecording: false }).catch(() => {});
    };
  }, [stream]);

  async function finishVoice() {
    if (voicePhase.current !== 'recording') return;
    voicePhase.current = 'transcribing';
    clearVoiceTimers();
    const session = voiceSession.current;
    setVoiceState('transcribing');
    setVoiceMessage('Transcribing your English voice note…');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      // Native stopFileRecordingAsync syncs/closes the WAV before resolving. Never read a live file.
      const recording = await stream.stopFileRecordingAsync();
      stream.stop();
      if (session !== voiceSession.current) return;
      const prepared = prepareTranscriptionWav(await new File(recording.uri).arrayBuffer(), recording);
      const info = prepared.info;
      setVoiceDiagnostics(
        'WAV: ' + info.duration.toFixed(1) + ' s · ' + info.sampleRate + ' Hz · mono · ' + info.sampleWidth
        + '-bit PCM · peak ' + (info.peak * 100).toFixed(2) + '% · RMS ' + (info.rms * 100).toFixed(2)
        + '% · non-silent (not proof of speech). Source: ' + info.sourceRate + ' Hz / ' + info.sourceChannels + ' channel(s).'
      );
      const audioDataUrl = prepared.dataUrl;
      if (session !== voiceSession.current) return;
      const controller = new AbortController();
      voiceRequest.current = controller;
      timeout = setTimeout(() => controller.abort(), 70000);
      const response = await fetch(API_BASE_URL + '/api/transcribe', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audio_data_url: audioDataUrl, language: 'en' }), signal: controller.signal,
      });
      const body = await response.json();
      if (session !== voiceSession.current) return;
      if (!response.ok) throw new Error(body.detail || 'Voice transcription failed. Please try again.');
      if (typeof body.transcript !== 'string' || !body.transcript.trim()) throw new Error('The server returned no transcript. Your typed note is unchanged; try a short English sentence or continue typing.');
      const transcript = body.transcript.trim();
      const combined = [symptomsRef.current.trim(), transcript].filter(Boolean).join(' ');
      if (combined.length > 1200) throw new Error('The transcript exceeds the 1,200-character note limit. Shorten your note and record a shorter message. Your existing text is unchanged.');
      setSymptoms(combined);
      setVoiceState('success');
      setVoiceMessage('Transcript added. Review or edit it before submitting your field note.');
    } catch (error) {
      if (session === voiceSession.current) {
        setVoiceState('error');
        setVoiceMessage(error instanceof Error && error.name !== 'AbortError' ? error.message : 'Transcription timed out or was interrupted. Check your connection and try again, or type your note.');
      }
    } finally {
      if (timeout) clearTimeout(timeout);
      if (session === voiceSession.current) {
        try { stream.stop(); } catch { /* Already stopped. */ }
        await removeVoiceFile();
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
        voiceRequest.current = null;
        voicePhase.current = 'idle';
      }
    }
  }

  async function startVoice() {
    if (language !== 'en' || voicePhase.current !== 'idle' || busy || photoBusy) return;
    if (!API_BASE_URL) {
      setVoiceState('error');
      setVoiceMessage('Voice transcription needs a server connection. You can still type and save a field note offline.');
      return;
    }
    voicePhase.current = 'permission';
    const session = ++voiceSession.current;
    setVoiceState('permission');
    setVoiceDiagnostics('');
    setVoiceMessage('Requesting microphone permission…');
    try {
      const permission = await requestRecordingPermissionsAsync();
      if (session !== voiceSession.current) return;
      if (!permission.granted) throw new Error('Microphone permission is needed. Allow it in phone settings or type your observations.');
      if (AppState.currentState !== 'active') throw new Error('Return to Fieldnote to record your voice note.');
      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      if (session !== voiceSession.current) {
        await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
        return;
      }
      await stream.start();
      if (session !== voiceSession.current) { stream.stop(); return; }
      const recording = await stream.startFileRecordingAsync({ format: 'wav', directory: 'cache' });
      voiceFile.current = recording.uri;
      if (session !== voiceSession.current) { stream.stop(); await removeVoiceFile(); return; }
      voicePhase.current = 'recording';
      setSeconds(0);
      setVoiceState('recording');
      setVoiceMessage('Recording in English. Stop to send this audio to Meta for transcription.');
      voiceClock.current = setInterval(() => setSeconds((value) => Math.min(30, value + 1)), 1000);
      voiceTimer.current = setTimeout(() => void finishVoice(), 30000);
    } catch (error) {
      if (session !== voiceSession.current) return;
      clearVoiceTimers();
      try { stream.stop(); } catch { /* Capture may not have started. */ }
      await removeVoiceFile();
      await setAudioModeAsync({ allowsRecording: false }).catch(() => {});
      voicePhase.current = 'idle';
      setVoiceState('error');
      setVoiceMessage(error instanceof Error ? error.message : 'Could not record audio. Type your observations or try again.');
    }
  }

  function requestVoice() {
    if (voicePhase.current === 'recording') { void finishVoice(); return; }
    Alert.alert('English voice note', 'Record up to 30 seconds. Stopping the recording (or reaching 30 seconds) sends the audio through the Fieldnote server to Meta for transcription. You can review the text before saving.', [
      { text: 'Cancel', style: 'cancel' }, { text: 'Record and transcribe', onPress: () => void startVoice() },
    ]);
  }


  useEffect(() => {
    loadCases().then(setCases).catch(() => setStatus(t.error));
  }, []);

  const resultObservation = useMemo(() => activeCase?.observations.find((item) => item.id === selectedObservationId)
    || activeCase?.observations.at(-1), [activeCase, selectedObservationId]);
  const latestAssessment = resultObservation?.assessment;

  function startNewCase() {
    if (actionSaving.current || locked) return;
    setVoiceDiagnostics('');
    setCropChoice('');
    setVoiceState('idle');
    setVoiceMessage('');
    scroll.current?.scrollTo({ y: 0, animated: true });
    setActiveCase(null);
    setSelectedObservationId(null);
    setRefineAnswer('');
    setCrop('');
    setLocation('');
    setStage('');
    setSymptoms('');
    setPhoto(null);
    setStatus('');
  }

  function continueCase(record: CropCase, observationId?: string) {
    if (actionSaving.current || locked) return;
    setVoiceDiagnostics('');
    setCropChoice(CROPS.includes(record.crop) ? record.crop : 'Other');
    setVoiceState('idle');
    setVoiceMessage('');
    setStatus('');
    scroll.current?.scrollTo({ y: 0, animated: true });
    setActiveCase(record);
    const visit = record.observations.find((item) => item.id === observationId) || record.observations.at(-1);
    setSelectedObservationId(visit?.id || null);
    setRefineAnswer(visit?.refinements?.find((turn) => !turn.assessment)?.answer || '');
    setCrop(record.crop);
    setLocation(record.location);
    setStage('');
    setSymptoms('');
    setPhoto(null);
    setStatus('');
  }

  async function choosePhoto(useCamera: boolean) {
    if (actionSaving.current || locked) return;
    setPhotoBusy(true);
    let context: ImageManipulatorContext | undefined;
    let rendered: ImageRef | undefined;
    try {
      const permission = await photoStep(useCamera ? 'Camera permission' : 'Gallery permission', () => {
        if (useCamera) {
          requirePhotoApi(ImagePicker.requestCameraPermissionsAsync, 'ImagePicker.requestCameraPermissionsAsync');
          return ImagePicker.requestCameraPermissionsAsync();
        }
        requirePhotoApi(ImagePicker.requestMediaLibraryPermissionsAsync, 'ImagePicker.requestMediaLibraryPermissionsAsync');
        return ImagePicker.requestMediaLibraryPermissionsAsync();
      });
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo access to attach crop evidence.');
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.65, allowsEditing: false };
      const result = await photoStep(useCamera ? 'Open camera' : 'Open gallery', () => {
        if (useCamera) {
          requirePhotoApi(ImagePicker.launchCameraAsync, 'ImagePicker.launchCameraAsync');
          return ImagePicker.launchCameraAsync(options);
        }
        requirePhotoApi(ImagePicker.launchImageLibraryAsync, 'ImagePicker.launchImageLibraryAsync');
        return ImagePicker.launchImageLibraryAsync(options);
      });
      if (result.canceled) return;
      const asset = await photoStep('Read selected photo', () => {
        const selected = result.assets?.[0];
        if (!selected?.uri || !(selected.width > 0) || !(selected.height > 0)) {
          throw new Error('The picker returned no usable photo or dimensions. Please choose another image.');
        }
        return selected;
      });
      // This is the named native object export, not the package namespace.
      const photoContext = await photoStep('Load photo (ImageManipulator.manipulate)', () => {
        requirePhotoApi(ImageManipulator?.manipulate, 'ImageManipulator.manipulate');
        return ImageManipulator.manipulate(asset.uri, { maxWidth: 1600, maxHeight: 1600 });
      });
      context = photoContext;
      if (Math.max(asset.width, asset.height) > 1600) {
        await photoStep('Resize photo (context.resize)', () => {
          requirePhotoApi(photoContext?.resize, 'ImageManipulatorContext.resize');
          photoContext.resize(asset.width >= asset.height ? { width: 1600 } : { height: 1600 });
        });
      }
      const image = await photoStep('Render photo (context.renderAsync)', () => {
        requirePhotoApi(photoContext?.renderAsync, 'ImageManipulatorContext.renderAsync');
        return photoContext.renderAsync();
      });
      rendered = image;
      const compressed = await photoStep('Save JPEG (image.saveAsync)', () => {
        requirePhotoApi(image?.saveAsync, 'ImageRef.saveAsync');
        return image.saveAsync({ format: SaveFormat.JPEG, compress: 0.65 });
      });
      await photoStep('Verify prepared JPEG (FileSystem.getInfoAsync)', async () => {
        if (!compressed.uri || !(compressed.width > 0) || !(compressed.height > 0)
            || Math.max(compressed.width, compressed.height) > 1600) {
          throw new Error('The image processor did not return a valid JPEG within the 1600-pixel limit.');
        }
        requirePhotoApi(FileSystem.getInfoAsync, 'FileSystem.getInfoAsync');
        const info = await FileSystem.getInfoAsync(compressed.uri);
        if (!info.exists || info.size === 0 || info.size > 8 * 1024 * 1024) {
          throw new Error('The prepared JPEG is missing, empty, or larger than 8 MB. Choose another photo.');
        }
      });
      setPhoto({ uri: compressed.uri, mimeType: 'image/jpeg', name: asset.fileName || (useCamera ? 'Camera photo.jpg' : 'Selected photo.jpg') });
      setStatus('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not prepare this photo.';
      Alert.alert('Photo unavailable', message);
    } finally {
      // Cleanup failures must not turn a successfully saved JPEG into a picker failure.
      for (const resource of [rendered, context]) {
        if (!resource) continue;
        try {
          requirePhotoApi(resource.release, 'ImageManipulator shared-object release');
          resource.release();
        } catch (error) {
          if (__DEV__) console.warn(`[${APP_REVISION}] Photo cleanup:`, error);
        }
      }
      setPhotoBusy(false);
    }
  }

  async function saveFieldNote(requestMetaReview: boolean) {
    if (actionSaving.current || locked) return;
    if (!crop.trim()) return Alert.alert(t.cropRequired);
    if (!photo || !symptoms.trim()) return Alert.alert(t.photoRequired);
    const selectedPhoto = photo;
    return analysisGate.run(async () => {
      setBusy(true);
      setStatus('');
      try {
        const now = new Date().toISOString();
        const observationId = newId();
        const photoUri = await savePhotoPermanently(selectedPhoto, observationId);
        const observation: Observation = {
          id: observationId, date: now, stage: stage.trim(), location: location.trim(),
          symptoms: symptoms.trim(), photoUri, mimeType: selectedPhoto.mimeType,
          analysis: { state: 'pending', kind: 'saved' },
        };
        const prior = activeCase ? await loadSavedCase(activeCase.id) : null;
        const record: CropCase = prior
          ? { ...prior, updatedAt: now, observations: [...prior.observations, observation] }
          : { id: newId(), crop: crop.trim(), location: location.trim(), createdAt: now, updatedAt: now, observations: [observation] };
        await persistCase(record);
        setActiveCase(record);
        setSelectedObservationId(observation.id);
        setRefineAnswer('');
        setCases(current => [record, ...current.filter(item => item.id !== record.id)]);
        setSymptoms('');
        setPhoto(null);
        setStatus(analysisStatus(observation, language));
        if (requestMetaReview) await reviewSavedVisit(record.id, observation.id);
      } catch (error) {
        setStatus(error instanceof Error ? error.message : t.error);
      } finally { setBusy(false); }
    });
  }

  async function reviewSavedVisit(caseId: string, observationId: string) {
    setStatus(language === 'ha' ? 'Ana neman tantancewa…' : 'Requesting analysis…');
    const updated = await analyzeSavedVisit<Observation, CropCase>(caseId, observationId, language, API_BASE_URL, {
      load: loadSavedCase, save: persistCase, photo: imageAsDataUrl, request: fetch,
    });
    setActiveCase(updated);
    setSelectedObservationId(observationId);
    const visit = updated.observations.find(item => item.id === observationId);
    setRefineAnswer(visit?.refinements?.find(turn => !turn.assessment)?.answer || '');
    setCases(current => [updated, ...current.filter(item => item.id !== updated.id)]);
    if (visit) setStatus(analysisStatus(visit, language));
  }

  async function requestReview(record: CropCase, observationId?: string) {
    if (actionSaving.current || locked) return;
    const id = observationId || record.observations.find(item => !item.assessment)?.id;
    if (!id) return;
    return analysisGate.run(async () => {
      setBusy(true);
      try { await reviewSavedVisit(record.id, id); }
      catch (error) { setStatus(error instanceof Error ? error.message : t.error); }
      finally { setBusy(false); }
    });
  }

  async function updateAdvice(sendToMeta: boolean) {
    if (actionSaving.current || locked || refineSubmitting.current || !activeCase || !resultObservation?.assessment) return;
    const previousAssessment = resultObservation.assessment;
    const question = resultObservation.assessment.follow_up_question?.trim();
    const answer = refineAnswer.trim();
    if (!question || !answer) {
      Alert.alert(language === 'ha' ? 'Rubuta amsarka da farko.' : 'Type an answer before updating advice.');
      return;
    }
    refineSubmitting.current = true;
    setBusy(true);
    setStatus('');
    let answerSaved = false;
    try {
      const record = activeCase;
      const target = resultObservation;
      const priorTurns = target.refinements || [];
      const pending = priorTurns.find((turn) => !turn.assessment);
      const turn: RefinementTurn = {
        id: pending?.id || newId(), date: new Date().toISOString(), question, answer,
        previousAssessment,
      };
      const turns = [...priorTurns.filter((item) => item.id !== pending?.id), turn];
      const saved: CropCase = { ...record, updatedAt: turn.date,
        observations: record.observations.map((item) => item.id === target.id ? { ...item, refinements: turns } : item),
      };
      // Save before the network call so a failure/restart never loses the submitted answer.
      await persistCase(saved);
      answerSaved = true;
      setActiveCase(saved);
      setCases((current) => [saved, ...current.filter((item) => item.id !== saved.id)]);
      setStatus(language === 'ha' ? 'An ajiye amsarka a wannan waya.' : 'Answer saved on this phone.');
      if (!sendToMeta) return;
      if (!API_BASE_URL) throw new Error(language === 'ha' ? 'Haɗa sabar domin sabunta shawara.' : 'Connect the Fieldnote server to update advice.');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 100000);
      try {
        const response = await fetch(API_BASE_URL + '/api/refine', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
          body: JSON.stringify({
            crop: record.crop, image_data_url: await imageAsDataUrl(target), symptoms: target.symptoms,
            stage: target.stage, location: record.location, previous_assessment: turn.previousAssessment,
            question, answer, language,
            history: priorTurns.filter((item) => !!item.assessment).slice(-20).map((item) => ({ question: item.question, answer: item.answer })),
          }),
        });
        const body = await response.json();
        if (!response.ok) throw new Error(body.detail || 'Could not update advice.');
        const assessment: Assessment = body.assessment;
        if (!assessment || typeof assessment.visual_observations !== 'string' || typeof assessment.follow_up_question !== 'string'
            || typeof assessment.urgency !== 'string' || !Array.isArray(assessment.next_steps) || !Array.isArray(assessment.possible_causes)) {
          throw new Error('The server returned incomplete advice. Your saved answer can be retried.');
        }
        const updated: CropCase = { ...saved, updatedAt: new Date().toISOString(),
          observations: saved.observations.map((item) => item.id === target.id ? {
            ...item, assessment, refinements: turns.map((item) => item.id === turn.id ? { ...item, assessment } : item),
          } : item),
        };
        await persistCase(updated);
        setActiveCase(updated);
        setCases((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
        setRefineAnswer('');
        setStatus(language === 'ha' ? 'An sabunta shawara kuma an ajiye ta.' : 'Advice updated and saved with your answer.');
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      const detail = error instanceof Error && error.name !== 'AbortError' ? error.message : 'The request timed out. Try again when connected.';
      setStatus((answerSaved
        ? (language === 'ha' ? 'Amsarka da shawarar baya suna nan a waya. ' : 'Your answer and previous advice are saved. Retry Update advice when connected. ')
        : (language === 'ha' ? 'Ba a ajiye amsar ba. ' : 'Could not save the answer; the text remains here. ')) + detail);
    } finally {
      refineSubmitting.current = false;
      setBusy(false);
    }
  }

  async function saveCaseAction(change: ActionChange) {
    if (locked || actionSaving.current || !activeCase || !resultObservation) throw new Error('Another operation is in progress. Try again.');
    actionSaving.current = true;
    setActionBusy(true);
    const caseId = activeCase.id;
    const visitId = resultObservation.id;
    try {
      const record = await loadSavedCase(caseId);
      const visit = record.observations.find(item => item.id === visitId);
      if (!visit) throw new Error('The saved visit could not be opened.');
      if (change.kind === 'create' && !visit.checklist) visit.checklist = makeChecklist(visit.assessment?.next_steps || []);
      if (change.kind === 'progress') {
        if (!visit.checklist) throw new Error('Save the checklist first.');
        visit.checklist = updateChecklist(visit.checklist, change.progress);
      }
      if (change.kind === 'reminder') record.recheckAt = change.value === null ? null : parseRecheck(change.value);
      await persistCase(record);
      setActiveCase(record);
      setCases(current => current.map(item => item.id === record.id ? record : item));
      setReminderClock(Date.now());
    } finally { actionSaving.current = false; setActionBusy(false); }
  }

  function shareCaseWithWorker(record: CropCase) {
    setSharePreview(buildCaseSummary(record, language));
    setShareStatus('');
  }

  async function confirmShare() {
    if (!sharePreview || sharePending.current) return;
    sharePending.current = true;
    setSharing(true);
    try {
      await shareCaseSummary(sharePreview, (content) => Share.share(content));
      setShareStatus(language === 'ha' ? 'An buɗe zaɓin rabawa. Ba a tabbatar da isarwa ba.' : 'Share options opened. Delivery is not confirmed.');
    } catch {
      setShareStatus(language === 'ha' ? 'Ba a iya buɗe rabawa ba. Sake gwadawa ko zaɓi rubutun ka kwafa.' : 'Could not open sharing. Try again or select and copy the summary below.');
    } finally {
      sharePending.current = false;
      setSharing(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" />
      <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.brandRow}><Text style={styles.brandMark}>f</Text><Text style={styles.brand}>fieldnote</Text></View>
          <View style={styles.languageSwitch} accessibilityLabel={w.chooseLanguage}>
            {(['en', 'ha'] as const).map((code) => <Pressable key={code} accessibilityRole="button" accessibilityState={{ selected: language === code, disabled: locked }} disabled={locked} onPress={() => { setLanguage(code); setVoiceState('idle'); setVoiceMessage(''); }} style={[styles.languageButton, language === code && styles.languageSelected]}><Text style={[styles.languageText, language === code && styles.languageTextSelected]}>{code.toUpperCase()}</Text></Pressable>)}
          </View>
        </View>
        <Text style={styles.prototype}>●  {w.prototype}</Text>
        {__DEV__ && <Text style={styles.hint}>Fieldnote · {APP_REVISION}</Text>}
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>—  {w.eyebrow}</Text>
          <Text style={styles.headline}>{language === 'en' ? 'Notice a change.' : 'Ka lura da canji.'}{'\n'}<Text style={styles.headlineAccent}>{language === 'en' ? 'Know what to do next.' : 'Ka san mataki na gaba.'}</Text></Text>
          <Text style={styles.introCopy}>{w.intro}</Text>
          <View style={styles.story}><Text style={styles.storyIcon}>✳</Text><Text style={styles.storyText}>{w.story}</Text></View>
          <Text style={styles.model}>●  {w.model}</Text>
        </View>

        <View style={styles.card}>
          <View style={styles.cardHeading}><View style={styles.flex}><Text style={styles.eyebrow}>{activeCase ? w.followMode : w.startMode}</Text><Text style={styles.sectionTitle}>{w.formTitle}</Text></View><Text style={styles.stepNumber}>01</Text></View>
          {activeCase && <Text style={styles.activeBanner}>{w.activeCase(language === 'ha' ? cropNames.ha[activeCase.crop] || activeCase.crop : activeCase.crop, activeCase.observations.length)}</Text>}
          <View style={styles.fieldLabel}><Text style={styles.label}>{w.cropLabel}</Text><Text style={styles.optional}>{w.required}</Text></View>
          <Dropdown label={w.cropLabel} value={cropChoice} disabled={locked || !!activeCase} closeLabel={language === 'ha' ? 'Rufe' : 'Close'} options={[{ value: '', label: w.selectCrop }, ...CROPS.map((value) => ({ value, label: value === 'Other' ? w.otherCrop : language === 'ha' ? cropNames.ha[value] || value : value }))]} onChange={(value) => { setCropChoice(value); setCrop(value === 'Other' ? '' : value); }} />
          {cropChoice === 'Other' && <TextInput accessibilityLabel={w.otherCrop} editable={!locked && !activeCase} value={crop} onChangeText={setCrop} placeholder={w.otherCropPlaceholder} placeholderTextColor="#929d93" style={[styles.input, styles.otherCrop]} maxLength={80} />}

          <View style={styles.fieldLabel}><Text style={styles.label}>{w.photoLabel}</Text><Text style={styles.optional}>{w.required}</Text></View>
          <View style={styles.photoCard}>
            <Text style={styles.uploadIcon}>＋</Text><Text style={styles.uploadTitle}>{photo?.name || (activeCase ? w.newFollowup : w.choosePhoto)}</Text>
            <Text style={styles.hint}>{language === 'ha' ? 'Ana shirya hoto a wannan waya · JPEG' : 'Prepared on this phone · JPEG · up to 8 MB'}</Text>
            <View style={styles.row}>
              <Pressable accessibilityRole="button" disabled={locked} style={[styles.secondaryButton, locked && styles.disabled]} onPress={() => choosePhoto(true)}><Text style={styles.secondaryText}>{t.camera}</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={locked} style={[styles.secondaryButton, locked && styles.disabled]} onPress={() => choosePhoto(false)}><Text style={styles.secondaryText}>{t.gallery}</Text></Pressable>
            </View>
            {photoBusy && <ActivityIndicator color="#214e37" accessibilityLabel={language === 'ha' ? 'Ana shirya hoto' : 'Preparing photo'} />}
            {photo && <Image accessibilityLabel={language === 'ha' ? 'Hoton shukar da aka zaɓa' : 'Selected crop photo preview'} source={{ uri: photo.uri }} style={styles.preview} resizeMode="contain" onError={({ nativeEvent }) => Alert.alert('Photo unavailable', `[${APP_REVISION}] Preview JPEG (Image): ${nativeEvent.error}`)} />}
          </View>

          <View style={styles.fieldLabel}><Text style={styles.label}>{w.symptomsLabel}</Text><Text style={styles.optional}>{w.required}</Text></View>
          <Pressable accessibilityRole="button" accessibilityState={{ disabled: language === 'ha' || busy || photoBusy || voiceState === 'permission' || voiceState === 'transcribing' }} disabled={language === 'ha' || busy || photoBusy || voiceState === 'permission' || voiceState === 'transcribing'} onPress={requestVoice} style={[styles.voiceButton, voiceState === 'recording' && styles.recording, language === 'ha' && styles.disabled]}>
            {(voiceState === 'permission' || voiceState === 'transcribing') && <ActivityIndicator size="small" color="#42664a" />}
            <Text style={styles.voiceText}>{language === 'ha' ? w.voiceButtonHausa : voiceState === 'recording' ? '●  Stop recording · ' + seconds + '/30s' : voiceState === 'transcribing' ? w.voiceTranscribing : voiceState === 'permission' ? 'Microphone permission…' : '●  ' + w.voiceButton}</Text>
          </Pressable>
          <Text accessibilityLiveRegion="polite" style={[styles.voiceStatus, voiceState === 'error' && styles.errorText, voiceState === 'success' && styles.successText]}>{language === 'ha' ? w.voiceHausaOff : voiceMessage || w.voiceHint}</Text>
          {!!voiceDiagnostics && language === 'en' && <Text style={styles.hint}>{voiceDiagnostics}</Text>}
          <TextInput accessibilityLabel={w.symptomsLabel} editable={!busy && !photoBusy} value={symptoms} onChangeText={setSymptoms} placeholder={activeCase ? (language === 'ha' ? 'Me ya canza tun ziyarar baya? Rubuta sabbin alamu ko abin da kuka gwada…' : 'What has changed since the last visit? Note new signs, spread, or anything you tried…') : w.symptomsPlaceholder} placeholderTextColor="#929d93" style={[styles.input, styles.notes]} multiline maxLength={1200} textAlignVertical="top" />
          <View style={styles.fieldFooter}><Text style={[styles.hint, styles.flex]}>{w.fieldHint}</Text><Text style={styles.hint}>{symptoms.length} / 1200</Text></View>
          <View style={styles.fieldLabel}><Text style={styles.label}>{w.stageLabel}</Text><Text style={styles.optional}>{w.optional}</Text></View>
          <Dropdown label={w.stageLabel} value={stage} disabled={locked} closeLabel={language === 'ha' ? 'Rufe' : 'Close'} options={[{ value: '', label: w.selectStage }, ...STAGES.map((value, index) => ({ value, label: language === 'ha' ? HA_STAGES[index] : value }))]} onChange={setStage} />
          <View style={styles.fieldLabel}><Text style={styles.label}>{w.locationLabel}</Text><Text style={styles.optional}>{w.optional}</Text></View>
          <TextInput accessibilityLabel={w.locationLabel} editable={!locked} value={location} onChangeText={setLocation} placeholder={w.locationPlaceholder} placeholderTextColor="#929d93" style={styles.input} maxLength={100} />
          <View style={styles.privacy}><Text style={styles.privacyIcon}>◎</Text><Text style={styles.privacyText}>{language === 'ha' ? 'Ana adana rahotanni da hotuna a wannan waya. Ana aika hoto ga Meta idan ka nemi shawara; rikodin Turanci yana zuwa ga Meta idan ka zaɓi mayar da shi rubutu. Sabar ba ta adana su.' : 'Cases and photos stay on this phone. Review sends photos to Meta; recording and transcribing sends English audio to Meta. The server does not save them.'}</Text></View>
          <Pressable accessibilityRole="button" disabled={locked} onPress={() => saveFieldNote(true)} style={[styles.primaryButton, locked && styles.disabled]}><Text style={styles.primaryText}>{activeCase ? w.comparing : language === 'ha' ? 'Duba wannan shuka' : 'Review this plant'}</Text>{busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryArrow}>↗</Text>}</Pressable>
          <Pressable accessibilityRole="button" disabled={locked} onPress={() => saveFieldNote(false)} style={[styles.outlineButton, locked && styles.disabled]}><Text style={styles.outlineText}>{language === 'ha' ? 'Ajiye bayanin gona ba tare da intanet ba' : 'Save field note offline'}</Text></Pressable>
          <Text style={styles.disclaimer}>{w.disclaimer}</Text>
        </View>

        <View style={[styles.card, styles.resultCard]}>
          <View style={styles.cardHeading}><View style={styles.flex}><Text style={styles.eyebrow}>{w.resultLabel}</Text><Text style={styles.sectionTitle}>{w.resultTitle}</Text></View><Text style={styles.resultIcon}>↳</Text></View>
          {busy && <View style={styles.loading}><ActivityIndicator color="#214e37" /><View style={styles.flex}><Text style={styles.label}>{w.loadingTitle}</Text><Text style={styles.muted}>{w.loadingCopy}</Text></View></View>}
          {!!status && <Text accessibilityLiveRegion="polite" style={styles.status}>{status}</Text>}
          {!latestAssessment && !busy && <View style={styles.emptyState}><Text style={styles.leaf}>❧</Text><Text style={styles.emptyText}>{activeCase ? t.offline : w.empty}</Text></View>}
          {latestAssessment && <>
            <Text style={styles.resultHeading}>{resultObservation?.refinements?.some((turn) => !!turn.assessment) ? (language === 'ha' ? 'Shawarar da aka sabunta' : 'Updated advice') : activeCase && activeCase.observations.findIndex((visit) => visit.id === resultObservation?.id) > 0 ? w.change : w.observation}</Text><Text style={styles.body}>{latestAssessment.visual_observations}</Text>
            <Text style={styles.resultHeading}>{w.causes}</Text>
            {latestAssessment.possible_causes.length === 0 && <Text style={styles.body}>{w.noCauses}</Text>}
            {latestAssessment.possible_causes.map((item, index) => <View key={index} style={styles.finding}><View style={styles.findingHeading}><Text style={[styles.caseTitle, styles.flex]}>{item.name}</Text><Text style={styles.badge}>{item.likelihood === 'low' ? w.low : item.likelihood === 'moderate' ? w.moderate : item.likelihood === 'high' ? w.high : item.likelihood}</Text></View>{!!item.evidence && <Text style={styles.body}>{item.evidence}</Text>}{!!item.what_to_check && <Text style={styles.body}>{w.checks} {item.what_to_check}</Text>}</View>)}
            <Text style={styles.resultHeading}>{w.next}</Text>{latestAssessment.next_steps.map((step, index) => <Text key={index} style={styles.body}>{index + 1}. {step}</Text>)}
            <Text style={styles.resultHeading}>{w.urgency}</Text><Text style={styles.body}>{latestAssessment.urgency || latestAssessment.escalation}</Text>
            {!!latestAssessment.follow_up_question && <View style={styles.followQuestion}>
              <Text style={styles.label}>{w.followQuestion}</Text><Text style={styles.body}>{latestAssessment.follow_up_question}</Text>
              <TextInput accessibilityLabel={language === 'ha' ? 'Amsarka' : 'Your answer'} value={refineAnswer} onChangeText={setRefineAnswer} editable={!busy}
                placeholder={language === 'ha' ? 'Rubuta amsarka a nan…' : 'Type your answer here…'} placeholderTextColor="#929d93" style={[styles.input, styles.notes]} multiline maxLength={1200} textAlignVertical="top" />
              <Text style={styles.hint}>{refineAnswer.length} / 1200</Text>
              <Text style={styles.voiceStatus}>{language === 'ha' ? 'Ba a tabbatar da gane muryar Hausa ba. Ka rubuta amsarka.' : 'Type your answer. Voice answers are not enabled until transcription is verified.'}</Text>
              <Text style={styles.privacyText}>{language === 'ha' ? 'Sabunta shawara yana aika hoton wannan ziyara, bayaninka da amsarka ga Meta. Wannan ba sabuwar ziyara ba ce.' : 'Update advice sends this saved visit’s photo, context, previous advice, and answer to Meta. It does not create a new visit.'}</Text>
              <Pressable accessibilityRole="button" disabled={locked || !refineAnswer.trim()} onPress={() => updateAdvice(true)} style={[styles.primaryButton, (locked || !refineAnswer.trim()) && styles.disabled]}><Text style={styles.primaryText}>{language === 'ha' ? 'Sabunta shawara' : 'Update advice'}</Text><Text style={styles.primaryArrow}>↗</Text></Pressable>
              <Pressable accessibilityRole="button" disabled={locked || !refineAnswer.trim()} onPress={() => updateAdvice(false)} style={[styles.outlineButton, (locked || !refineAnswer.trim()) && styles.disabled]}><Text style={styles.outlineText}>{language === 'ha' ? 'Ajiye amsa ba tare da intanet ba' : 'Save answer offline'}</Text></Pressable>
            </View>}
            {!!resultObservation?.refinements?.length && <View style={styles.followQuestion}>
              <Text style={styles.resultHeading}>{language === 'ha' ? 'Tambayoyi da amsoshi' : 'Questions and answers'}</Text>
              {resultObservation.refinements.map((turn) => <View key={turn.id}>
                <Text style={styles.visitDate}>{new Date(turn.date).toLocaleString()}</Text>
                <Text style={styles.label}>{turn.question}</Text><Text style={styles.body}>{turn.answer}</Text>
                <Text style={styles.muted}>{turn.assessment ? turn.assessment.visual_observations : (language === 'ha' ? 'An ajiye amsa; ana jiran sabunta shawara.' : 'Answer saved; advice update pending.')}</Text>
                {turn.assessment?.next_steps.map((step, index) => <Text key={index} style={styles.body}>• {step}</Text>)}
              </View>)}
            </View>}
            <Text style={styles.disclaimer}>{w.disclaimerResult}</Text>
          </>}
          {activeCase && resultObservation && <CaseActions key={activeCase.id + ':' + resultObservation.id} checklist={resultObservation.checklist} hasSteps={!!resultObservation.assessment?.next_steps.length} recheckAt={activeCase.recheckAt} disabled={locked} language={language} onSave={saveCaseAction} />}
          <Text style={styles.resultFoot}>f   {w.resultFoot}</Text>
        </View>

        <View style={styles.casebook}>
          <Text style={styles.eyebrow}>{w.casebookLabel}</Text><Text style={styles.casebookTitle}>{w.casebookTitle}</Text><Text style={styles.muted}>{w.casebookCopy}</Text>
          <Pressable accessibilityRole="button" disabled={locked} onPress={startNewCase} style={[styles.newCase, locked && styles.disabled]}><Text style={styles.outlineText}>＋  {w.newCase}</Text></Pressable>
          {cases.length === 0 && <Text style={styles.emptyCasebook}>{w.casebookEmpty}</Text>}
          {[...cases].sort((a, b) => Number(recheckDue(b.recheckAt, reminderClock)) - Number(recheckDue(a.recheckAt, reminderClock))).map((record) => <View key={record.id} style={styles.card}>
            {!!record.recheckAt && <View style={styles.status}>
              <Text style={styles.body}>{recheckDue(record.recheckAt, reminderClock) ? (language === 'ha' ? 'Lokacin sake duba amfanin gona ya yi' : 'Recheck due') : (language === 'ha' ? 'Tunatarwar sake dubawa' : 'Recheck reminder')} · {new Date(record.recheckAt).toLocaleString()}</Text>
              <Pressable accessibilityRole="button" disabled={locked} onPress={() => continueCase(record)} style={styles.outlineButton}><Text style={styles.outlineText}>{language === 'ha' ? 'Fara ziyara da sabon hoto a wannan rahoto' : 'Start photo follow-up on this case'}</Text></Pressable>
            </View>}
            <Text style={styles.caseTitle}>{language === 'ha' ? cropNames.ha[record.crop] || record.crop : record.crop}{record.location ? ' · ' + record.location : ''}</Text>
            <Text style={styles.muted}>{record.observations.length} {w.visits} · {w.updated} {new Date(record.updatedAt).toLocaleDateString()}</Text>
            {record.observations.map((visit, index) => <View key={visit.id} style={styles.visit}>
              <Image source={{ uri: visit.photoUri }} style={styles.thumbnail} accessibilityLabel={w.visit + ' ' + (index + 1)} />
              <View style={styles.flex}><Text style={styles.visitDate}>{w.visit} {index + 1} · {new Date(visit.date).toLocaleDateString()}</Text><Text style={styles.body}>{visit.symptoms}</Text>
                <Pressable accessibilityRole="button" disabled={locked} onPress={() => continueCase(record, visit.id)} style={styles.reviewButton}><Text style={styles.reviewText}>{language === 'ha' ? 'Jerin ayyuka / tunatarwa' : 'Checklist / reminder'}</Text></Pressable>
                {visit.assessment && <><Text style={styles.muted}>{visit.assessment.visual_observations}</Text><Pressable accessibilityRole="button" disabled={locked} onPress={() => continueCase(record, visit.id)} style={[styles.reviewButton, locked && styles.disabled]}><Text style={styles.reviewText}>{language === 'ha' ? 'Duba shawara / amsa tambaya' : 'View advice / answer question'}</Text></Pressable></>}
                {!visit.assessment && <>
                  {!!visit.stage && <Text style={styles.body}>{visit.stage}</Text>}
                  {!!visit.location && <Text style={styles.body}>{visit.location}</Text>}
                  <Text style={styles.status}>{analysisStatus(visit, language)}</Text>
                  <Text style={styles.hint}>{language === 'ha' ? 'Za a aika hoton da bayanan da aka ajiye ne idan ka sake neman tantancewa.' : 'Retry sends the saved photo and details. Comparisons also send the previous visit’s photo.'}</Text>
                  <Pressable accessibilityRole="button" disabled={locked} onPress={() => { void requestReview(record, visit.id); }} style={[styles.reviewButton, locked && styles.disabled]}><Text style={styles.reviewText}>{language === 'ha' ? 'Sake neman tantancewa' : 'Retry analysis'}</Text></Pressable>
                </>}
              </View>
            </View>)}
            <Pressable accessibilityRole="button" disabled={locked} onPress={() => continueCase(record)} style={[styles.outlineButton, locked && styles.disabled]}><Text style={styles.outlineText}>{w.addFollowup} ↗</Text></Pressable>
            <Pressable accessibilityRole="button" disabled={locked} onPress={() => shareCaseWithWorker(record)} style={[styles.reviewButton, locked && styles.disabled]}><Text style={styles.reviewText}>{w.share}</Text></Pressable>
          </View>)}
        </View>
        <View style={styles.footer}><Text style={styles.footerBrand}>FIELDNOTE</Text><Text style={styles.hint}>{w.footer}</Text></View>
      </ScrollView>
      <Modal visible={sharePreview !== null} transparent animationType="fade" onRequestClose={() => { if (!sharing) setSharePreview(null); }}>
        <View style={styles.modalBackdrop}><View style={styles.modalCard} accessibilityViewIsModal>
          <Text style={styles.sectionTitle}>{language === 'ha' ? 'Duba rahoto kafin rabawa' : 'Review before sharing'}</Text>
          <Text style={styles.body}>{language === 'ha' ? 'Za ka zaɓi wanda za a aika wa. Rubutu kawai; ba a haɗa hoto ba. Za ka iya zaɓar rubutun ka kwafa.' : 'Choose who receives this summary in your phone’s share options. Text only; no photo is attached. You can also select and copy the text.'}</Text>
          <ScrollView><Text selectable style={styles.body}>{sharePreview}</Text></ScrollView>
          {!!shareStatus && <Text accessibilityLiveRegion="polite" style={styles.body}>{shareStatus}</Text>}
          <Pressable accessibilityRole="button" disabled={sharing} onPress={confirmShare} style={[styles.primaryButton, sharing && styles.disabled]}><Text style={styles.primaryText}>{sharing ? (language === 'ha' ? 'Ana buɗewa…' : 'Opening…') : t.share}</Text></Pressable>
          <Pressable accessibilityRole="button" disabled={sharing} onPress={() => setSharePreview(null)} style={styles.outlineButton}><Text style={styles.outlineText}>{language === 'ha' ? 'Rufe' : 'Close'}</Text></Pressable>
        </View></View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fafbf7' },
  content: { paddingHorizontal: 18, paddingTop: Platform.OS === 'android' ? StatusBar.currentHeight || 24 : 24, paddingBottom: 28, maxWidth: 720, width: '100%', alignSelf: 'center' },
  flex: { flex: 1 },
  header: { minHeight: 66, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#e9ece6' },
  brandRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brand: { fontFamily: 'sans-serif', fontWeight: '800', fontSize: 22, letterSpacing: -0.8, color: '#1e2e25' },
  brandMark: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#214e37', color: '#fff', textAlign: 'center', fontFamily: 'serif', fontStyle: 'italic', fontWeight: '700', fontSize: 23 },
  languageSwitch: { flexDirection: 'row', borderRadius: 20, padding: 3, backgroundColor: '#e9f1e8' },
  languageButton: { minWidth: 44, minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 18 },
  languageSelected: { backgroundColor: '#214e37' },
  languageText: { fontSize: 11, fontWeight: '700', color: '#42664a' },
  languageTextSelected: { color: '#fff' },
  prototype: { fontSize: 11, color: '#647167', marginTop: 12 },
  intro: { paddingTop: 34, paddingBottom: 32 },
  eyebrow: { fontSize: 10, lineHeight: 16, fontWeight: '700', letterSpacing: 1.5, color: '#617467', marginBottom: 8 },
  headline: { fontFamily: 'sans-serif', fontSize: 40, lineHeight: 45, letterSpacing: -2.3, color: '#1e2e25', fontWeight: '700', marginTop: 10, marginBottom: 17 },
  headlineAccent: { color: '#59775d', fontWeight: '500' },
  introCopy: { fontSize: 16, lineHeight: 27, color: '#56645a', marginBottom: 22 },
  story: { flexDirection: 'row', gap: 11, borderLeftWidth: 2, borderLeftColor: '#b8c9b7', paddingLeft: 13, paddingVertical: 9 },
  storyIcon: { color: '#c27445', fontSize: 18 },
  storyText: { flex: 1, fontSize: 12, lineHeight: 19, color: '#69776b' },
  model: { fontSize: 10, lineHeight: 16, fontWeight: '600', letterSpacing: 0.3, color: '#65756a', marginTop: 17 },
  card: { padding: 23, backgroundColor: '#fff', borderWidth: 1, borderColor: '#e4e9e1', borderRadius: 18, marginBottom: 20, shadowColor: '#203928', shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.05, shadowRadius: 18, elevation: 1 },
  cardHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 10 },
  sectionTitle: { fontSize: 21, lineHeight: 28, letterSpacing: -0.6, fontWeight: '700', color: '#1e2e25' },
  stepNumber: { width: 30, height: 30, textAlign: 'center', textAlignVertical: 'center', borderRadius: 15, borderWidth: 1, borderColor: '#dfe5dc', fontSize: 11, color: '#9ca89d' },
  activeBanner: { marginTop: 8, borderLeftWidth: 2, borderLeftColor: '#b8c9b7', paddingLeft: 10, color: '#59775d', fontSize: 12, lineHeight: 18 },
  fieldLabel: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginTop: 22, marginBottom: 9 },
  label: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#1e2e25', flexShrink: 1 },
  optional: { fontSize: 10, color: '#94a096', flexShrink: 1 },
  input: { minHeight: 46, borderColor: '#dce3da', borderWidth: 1, borderRadius: 9, backgroundColor: '#fff', paddingHorizontal: 13, paddingVertical: 12, color: '#1e2e25', fontSize: 13, lineHeight: 20 },
  select: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  selectText: { flex: 1, fontSize: 13, color: '#1e2e25' },
  selectArrow: { color: '#69766d', fontSize: 17 },
  placeholder: { color: '#929d93' },
  otherCrop: { marginTop: 8 },
  photoCard: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#b8c8b8', backgroundColor: '#fbfcf9', borderRadius: 11, padding: 14, alignItems: 'center', gap: 8 },
  uploadIcon: { width: 30, height: 30, borderRadius: 15, backgroundColor: '#e8f0e7', color: '#426a4a', textAlign: 'center', fontSize: 21 },
  uploadTitle: { fontSize: 12, fontWeight: '700', color: '#1e2e25', textAlign: 'center' },
  hint: { fontSize: 10, lineHeight: 15, color: '#88958b' },
  row: { flexDirection: 'row', width: '100%', gap: 9, marginTop: 6 },
  secondaryButton: { flex: 1, minHeight: 44, padding: 8, justifyContent: 'center', alignItems: 'center', borderRadius: 9, backgroundColor: '#e9f1e8' },
  secondaryText: { fontSize: 12, fontWeight: '700', color: '#42664a', textAlign: 'center' },
  preview: { width: '100%', height: 180, borderRadius: 7, marginTop: 4 },
  voiceButton: { alignSelf: 'flex-start', flexDirection: 'row', gap: 7, alignItems: 'center', minHeight: 44, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 22, borderWidth: 1, borderColor: '#d6e2d2', backgroundColor: '#f7faf5', marginBottom: 8 },
  voiceText: { color: '#42664a', fontSize: 11, fontWeight: '600', flexShrink: 1 },
  recording: { backgroundColor: '#fff3ef', borderColor: '#edc6b8' },
  voiceStatus: { fontSize: 11, lineHeight: 16, color: '#839087', marginBottom: 8 },
  errorText: { color: '#a64d35' },
  successText: { color: '#214e37' },
  notes: { minHeight: 112 },
  fieldFooter: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginTop: 7 },
  privacy: { flexDirection: 'row', gap: 8, backgroundColor: '#f5f8f2', borderRadius: 8, padding: 11, marginTop: 21, marginBottom: 15 },
  privacyIcon: { fontSize: 16, color: '#638366' },
  privacyText: { flex: 1, fontSize: 10, lineHeight: 16, color: '#718075' },
  primaryButton: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, borderRadius: 9, paddingHorizontal: 16, paddingVertical: 14, backgroundColor: '#214e37' },
  primaryText: { color: '#fff', fontSize: 12, lineHeight: 18, fontWeight: '700', flex: 1 },
  primaryArrow: { fontSize: 19, color: '#fff' },
  outlineButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#d6e2d2', borderRadius: 9, padding: 11, marginTop: 10 },
  outlineText: { fontSize: 12, lineHeight: 18, fontWeight: '700', color: '#42664a', textAlign: 'center' },
  disabled: { opacity: 0.5 },
  disclaimer: { fontSize: 10, lineHeight: 16, color: '#939e94', textAlign: 'center', marginTop: 12 },
  resultCard: { minHeight: 330 },
  resultIcon: { width: 30, height: 30, borderRadius: 9, backgroundColor: '#edf3ea', color: '#55765a', textAlign: 'center', fontSize: 22 },
  resultHeading: { fontWeight: '700', fontSize: 13, color: '#384a3d', marginTop: 20, marginBottom: 7 },
  body: { fontSize: 12, lineHeight: 20, color: '#607065', marginBottom: 5 },
  loading: { flexDirection: 'row', gap: 13, alignItems: 'center', paddingVertical: 24 },
  status: { padding: 12, backgroundColor: '#f5f8f2', borderRadius: 8, color: '#42664a', fontSize: 12, lineHeight: 19, marginVertical: 10 },
  emptyState: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  leaf: { fontSize: 70, color: '#b9ceb7' },
  emptyText: { fontSize: 12, lineHeight: 21, color: '#849087', textAlign: 'center' },
  finding: { borderWidth: 1, borderColor: '#dfe9dc', backgroundColor: '#f7faf5', borderRadius: 10, padding: 13, marginTop: 10 },
  findingHeading: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  badge: { fontSize: 10, color: '#536d55', backgroundColor: '#e8f0e6', borderRadius: 12, paddingVertical: 5, paddingHorizontal: 8, maxWidth: '45%' },
  followQuestion: { borderLeftWidth: 2, borderLeftColor: '#c77a51', padding: 11, backgroundColor: '#fff8f4', marginTop: 14 },
  resultFoot: { borderTopWidth: 1, borderTopColor: '#edf0eb', paddingTop: 13, marginTop: 22, fontSize: 8, lineHeight: 14, letterSpacing: 1, color: '#98a298' },
  casebook: { marginTop: 34 },
  casebookTitle: { fontSize: 27, lineHeight: 34, letterSpacing: -1, fontWeight: '700', color: '#1e2e25', marginBottom: 8 },
  muted: { fontSize: 12, lineHeight: 19, color: '#738075' },
  newCase: { alignSelf: 'flex-start', borderWidth: 1, borderColor: '#d6e2d2', borderRadius: 9, backgroundColor: '#fff', padding: 12, marginVertical: 19 },
  emptyCasebook: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#dfe5dc', borderRadius: 12, padding: 22, color: '#849087', fontSize: 12, lineHeight: 20 },
  caseTitle: { color: '#304637', fontSize: 15, lineHeight: 21, fontWeight: '700', marginBottom: 5 },
  visit: { flexDirection: 'row', gap: 12, borderTopWidth: 1, borderTopColor: '#e7ece7', paddingTop: 14, marginTop: 14 },
  thumbnail: { width: 54, height: 62, borderRadius: 7, backgroundColor: '#e9f1e8' },
  visitDate: { fontSize: 10, color: '#738075', marginBottom: 5 },
  reviewButton: { alignSelf: 'flex-start', minHeight: 44, justifyContent: 'center', paddingHorizontal: 10, paddingVertical: 8, marginTop: 8, borderRadius: 8, backgroundColor: '#edf3ea' },
  reviewText: { fontSize: 11, fontWeight: '700', color: '#42664a' },
  footer: { borderTopWidth: 1, borderTopColor: '#e8ece5', paddingTop: 18, marginTop: 30, gap: 8 },
  footerBrand: { fontSize: 10, letterSpacing: 1, color: '#8a968c' },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(30,46,37,0.4)', justifyContent: 'center', padding: 24 },
  modalCard: { maxHeight: '80%', borderRadius: 18, padding: 20, backgroundColor: '#fafbf7' },
  option: { minHeight: 48, padding: 12, borderBottomWidth: 1, borderBottomColor: '#e4e9e1' },
  optionSelected: { backgroundColor: '#e9f1e8' },
});
