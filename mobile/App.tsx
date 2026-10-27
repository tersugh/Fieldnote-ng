import { useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import * as SQLite from 'expo-sqlite';

declare const process: { env: { EXPO_PUBLIC_API_BASE_URL?: string } };

type Assessment = {
  visual_observations: string;
  possible_causes: { name: string; likelihood: string }[];
  next_steps: string[];
  urgency: string;
  escalation?: string;
};

type Observation = {
  id: string;
  date: string;
  stage: string;
  symptoms: string;
  photoUri: string;
  mimeType: string;
  assessment?: Assessment;
};

type CropCase = {
  id: string;
  crop: string;
  location: string;
  createdAt: string;
  updatedAt: string;
  observations: Observation[];
};

type StoredCase = { record_json: string };
type PickedPhoto = { uri: string; mimeType: string; fileSize?: number | null };

const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL || '').replace(/\/$/, '');
let databasePromise: Promise<SQLite.SQLiteDatabase> | undefined;

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

function newId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

async function savePhotoPermanently(photo: PickedPhoto, observationId: string): Promise<string> {
  if (!FileSystem.documentDirectory) throw new Error('Phone storage is unavailable.');
  const extension = photo.mimeType === 'image/png' ? 'png' : photo.mimeType === 'image/webp' ? 'webp' : 'jpg';
  const target = `${FileSystem.documentDirectory}fieldnote-${observationId}.${extension}`;
  await FileSystem.copyAsync({ from: photo.uri, to: target });
  return target;
}

async function imageAsDataUrl(observation: Observation): Promise<string> {
  const base64 = await FileSystem.readAsStringAsync(observation.photoUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
  return `data:${observation.mimeType};base64,${base64}`;
}

export default function App() {
  const [language, setLanguage] = useState<Language>('en');
  const [cases, setCases] = useState<CropCase[]>([]);
  const [activeCase, setActiveCase] = useState<CropCase | null>(null);
  const [crop, setCrop] = useState('');
  const [location, setLocation] = useState('');
  const [stage, setStage] = useState('');
  const [symptoms, setSymptoms] = useState('');
  const [photo, setPhoto] = useState<PickedPhoto | null>(null);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState('');
  const t = copy[language];

  useEffect(() => {
    loadCases().then(setCases).catch(() => setStatus(t.error));
  }, []);

  const latestAssessment = useMemo(() => {
    const latest = activeCase?.observations.at(-1);
    return latest?.assessment;
  }, [activeCase]);

  function startNewCase() {
    setActiveCase(null);
    setCrop('');
    setLocation('');
    setStage('');
    setSymptoms('');
    setPhoto(null);
    setStatus('');
  }

  function continueCase(record: CropCase) {
    setActiveCase(record);
    setCrop(record.crop);
    setLocation(record.location);
    setStage('');
    setSymptoms('');
    setPhoto(null);
    setStatus('');
  }

  async function choosePhoto(useCamera: boolean) {
    try {
      const permission = useCamera
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        Alert.alert('Permission needed', 'Allow photo access to attach crop evidence.');
        return;
      }
      const options: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.65, allowsEditing: false };
      const result = useCamera
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (result.canceled || !result.assets[0]) return;
      const asset = result.assets[0];
      const context = ImageManipulator.manipulate(asset.uri, { maxWidth: 1600, maxHeight: 1600 });
      const rendered = await context.renderAsync();
      const compressed = await rendered.saveAsync({ format: ImageManipulator.SaveFormat.JPEG, compress: 0.65 });
      setPhoto({ uri: compressed.uri, mimeType: 'image/jpeg' });
      setStatus('');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not prepare this photo.';
      Alert.alert('Photo unavailable', message);
    }
  }

  async function saveFieldNote(requestMetaReview: boolean) {
    if (!crop.trim()) return Alert.alert(t.cropRequired);
    if (!photo || !symptoms.trim()) return Alert.alert(t.photoRequired);
    setBusy(true);
    setStatus('');
    let record: CropCase;
    let observation: Observation;
    try {
      const now = new Date().toISOString();
      const observationId = newId();
      const photoUri = await savePhotoPermanently(photo, observationId);
      observation = {
        id: observationId,
        date: now,
        stage: stage.trim(),
        symptoms: symptoms.trim(),
        photoUri,
        mimeType: photo.mimeType,
      };
      record = activeCase
        ? { ...activeCase, updatedAt: now, observations: [...activeCase.observations, observation] }
        : {
            id: newId(), crop: crop.trim(), location: location.trim(), createdAt: now, updatedAt: now,
            observations: [observation],
          };
      await persistCase(record);
      setActiveCase(record);
      setCases((current) => [record, ...current.filter((item) => item.id !== record.id)]);
      setSymptoms('');
      setPhoto(null);
      setStatus(t.saved);
      if (requestMetaReview) await requestReview(record, observation.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : t.error;
      setStatus(message || t.error);
      if (requestMetaReview) Alert.alert(t.error, message);
    } finally {
      setBusy(false);
    }
  }

  async function requestReview(record: CropCase, observationId?: string) {
    if (!API_BASE_URL) {
      setStatus(t.config);
      return;
    }
    const target = observationId
      ? record.observations.find((item) => item.id === observationId)
      : record.observations.find((item) => !item.assessment);
    if (!target) {
      setStatus(language === 'ha' ? 'An riga an duba wannan ziyara.' : 'This visit already has a review.');
      return;
    }
    const index = record.observations.findIndex((item) => item.id === target.id);
    const previous = index > 0 ? record.observations[index - 1] : null;
    try {
      setBusy(true);
      setStatus(language === 'ha' ? 'Ana haɗawa da Meta…' : 'Connecting to Meta…');
      const requestBody = previous
        ? {
            previous_image_data_url: await imageAsDataUrl(previous),
            image_data_url: await imageAsDataUrl(target),
            crop: record.crop,
            previous_note: previous.symptoms,
            symptoms: target.symptoms,
            stage: target.stage,
            location: record.location,
            language,
          }
        : {
            image_data_url: await imageAsDataUrl(target),
            crop: record.crop,
            symptoms: target.symptoms,
            stage: target.stage,
            location: record.location,
            language,
          };
      const response = await fetch(`${API_BASE_URL}${previous ? '/api/followup' : '/api/diagnose'}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.detail || 'Crop advice could not be generated.');
      const updated: CropCase = {
        ...record,
        observations: record.observations.map((item) => item.id === target.id ? { ...item, assessment: body.assessment } : item),
      };
      await persistCase(updated);
      setActiveCase(updated);
      setCases((current) => [updated, ...current.filter((item) => item.id !== updated.id)]);
      setStatus(t.reviewed);
    } catch (error) {
      const message = error instanceof Error ? error.message : t.offline;
      setStatus(`${t.offline} ${message}`);
    } finally {
      setBusy(false);
    }
  }

  async function shareCaseWithWorker(record: CropCase) {
    const latest = record.observations.at(-1);
    if (!latest) return;
    const assessment = latest.assessment;
    const message = language === 'ha'
      ? [
          `Rahoton Fieldnote: ${record.crop}`,
          `Wuri: ${record.location || 'Ba a saka ba'}`,
          ...record.observations.map((item, index) => `Ziyara ${index + 1} (${new Date(item.date).toLocaleDateString()}): ${item.symptoms}`),
          ...(assessment ? [
            `Abin da AI ta lura: ${assessment.visual_observations}`,
            `Abubuwan da ka iya haddasawa: ${assessment.possible_causes.map((item) => item.name).join(', ') || 'Ba a tabbatar ba'}`,
            `Abin yi yanzu: ${assessment.next_steps.join('; ')}`,
            `Gaggawa da alamomin lura: ${assessment.urgency || assessment.escalation || ''}`,
          ] : []),
          'Manomi yana neman ƙarin ra’ayi ne bisa zaɓinsa.',
        ].join('\n')
      : [
          `Fieldnote crop case: ${record.crop}`,
          `Area: ${record.location || 'Not added'}`,
          ...record.observations.map((item, index) => `Visit ${index + 1} (${new Date(item.date).toLocaleDateString()}): ${item.symptoms}`),
          ...(assessment ? [
            `AI observations: ${assessment.visual_observations}`,
            `Possible causes: ${assessment.possible_causes.map((item) => item.name).join(', ') || 'Unclear'}`,
            `Recommended next steps: ${assessment.next_steps.join('; ')}`,
            `Urgency / warning signs: ${assessment.urgency || assessment.escalation || ''}`,
          ] : []),
          'The farmer is sharing this case for an optional second opinion.',
        ].join('\n');
    try {
      await Share.share({ title: t.share, message });
    } catch (error) {
      const messageText = error instanceof Error ? error.message : t.error;
      Alert.alert(t.error, messageText);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <StatusBar barStyle="dark-content" backgroundColor="#f5f7f2" />
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View>
            <Text style={styles.brand}>{t.title}</Text>
            <Text style={styles.subtitle}>{t.subtitle}</Text>
          </View>
          <View style={styles.languageSwitch} accessibilityLabel={t.chooseLanguage}>
            {(['en', 'ha'] as const).map((code) => (
              <Pressable key={code} onPress={() => setLanguage(code)} style={[styles.languageButton, language === code && styles.languageSelected]}>
                <Text style={[styles.languageText, language === code && styles.languageTextSelected]}>{code.toUpperCase()}</Text>
              </Pressable>
            ))}
          </View>
        </View>

        <View style={styles.hero}>
          <Text style={styles.heroTitle}>{t.intro}</Text>
          <Text style={styles.offlineBadge}>●  ON-DEVICE CASEBOOK</Text>
        </View>

        <View style={styles.card}>
          {activeCase ? (
            <View style={styles.activeBanner}>
              <Text style={styles.activeLabel}>{t.active} {activeCase.crop}</Text>
              <Pressable onPress={startNewCase}><Text style={styles.link}>{t.newCase} +</Text></Pressable>
            </View>
          ) : <Text style={styles.sectionTitle}>{t.newCase}</Text>}

          <Text style={styles.label}>{t.crop}</Text>
          <TextInput value={crop} onChangeText={setCrop} placeholder={t.cropHint} style={styles.input} maxLength={80} />
          <Text style={styles.label}>{t.location}</Text>
          <TextInput value={location} onChangeText={setLocation} placeholder="e.g. Makurdi, Benue" style={styles.input} maxLength={100} />
          <Text style={styles.label}>{t.stage}</Text>
          <TextInput value={stage} onChangeText={setStage} placeholder="e.g. flowering" style={styles.input} maxLength={80} />

          <Text style={styles.label}>{t.photo}</Text>
          <View style={styles.row}>
            <Pressable style={styles.secondaryButton} onPress={() => choosePhoto(true)}><Text style={styles.secondaryText}>{t.camera}</Text></Pressable>
            <Pressable style={styles.secondaryButton} onPress={() => choosePhoto(false)}><Text style={styles.secondaryText}>{t.gallery}</Text></Pressable>
          </View>
          {photo && <Image source={{ uri: photo.uri }} style={styles.preview} resizeMode="cover" />}

          <Text style={styles.label}>{t.notes}</Text>
          <TextInput value={symptoms} onChangeText={setSymptoms} placeholder={t.notesHint} style={[styles.input, styles.notes]} multiline maxLength={1200} textAlignVertical="top" />

          <Pressable disabled={busy} onPress={() => saveFieldNote(false)} style={[styles.primaryButton, busy && styles.disabled]}>
            {busy ? <ActivityIndicator color="#fff" /> : <Text style={styles.primaryText}>{t.save}</Text>}
          </Pressable>
          <Pressable disabled={busy} onPress={() => saveFieldNote(true)} style={[styles.outlineButton, busy && styles.disabled]}>
            <Text style={styles.outlineText}>{t.saveAnalyze}</Text>
          </Pressable>
          <Text style={styles.disclaimer}>{t.disclaimer}</Text>
          {!!status && <Text style={styles.status}>{status}</Text>}
        </View>

        {latestAssessment && (
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>{t.assessment}</Text>
            <Text style={styles.body}>{latestAssessment.visual_observations}</Text>
            <Text style={styles.label}>{t.possible}</Text>
            <Text style={styles.body}>{latestAssessment.possible_causes.map((item) => `${item.name} (${item.likelihood})`).join(' · ') || '—'}</Text>
            <Text style={styles.label}>{t.next}</Text>
            {latestAssessment.next_steps.map((step, index) => <Text key={index} style={styles.body}>• {step}</Text>)}
            <Text style={styles.label}>{t.escalate}</Text>
            <Text style={styles.body}>{latestAssessment.urgency || latestAssessment.escalation}</Text>
          </View>
        )}

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>{t.casebook} ({cases.length})</Text>
          {cases.length === 0 && <Text style={styles.muted}>{t.noCases}</Text>}
          {cases.map((record) => {
            const latest = record.observations.at(-1);
            return (
              <View key={record.id} style={styles.caseItem}>
                <Pressable onPress={() => continueCase(record)} style={styles.caseMain}>
                  <Text style={styles.caseTitle}>{record.crop}{record.location ? ` · ${record.location}` : ''}</Text>
                  <Text style={styles.muted}>{record.observations.length} {t.visits} · {new Date(record.updatedAt).toLocaleDateString()}</Text>
                  <Text numberOfLines={2} style={styles.caseNote}>{latest?.symptoms}</Text>
                </Pressable>
                {latest?.assessment && <Pressable onPress={() => shareCaseWithWorker(record)} style={styles.reviewButton}><Text style={styles.reviewText}>{t.share}</Text></Pressable>}
                {latest && !latest.assessment && <Pressable onPress={() => requestReview(record, latest.id)} style={styles.reviewButton}><Text style={styles.reviewText}>{t.review}</Text></Pressable>}
              </View>
            );
          })}
        </View>
        <Text style={styles.footer}>FIELDNOTE · BUILT FOR FARMERS, WITH FARMERS</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f5f7f2' },
  content: { padding: 18, paddingTop: 22, paddingBottom: 40, maxWidth: 720, width: '100%', alignSelf: 'center' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 },
  brand: { color: '#183c2b', fontSize: 27, fontWeight: '800', letterSpacing: -0.6 },
  subtitle: { color: '#637166', fontSize: 12, marginTop: 2 },
  languageSwitch: { flexDirection: 'row', backgroundColor: '#e7ece5', borderRadius: 20, padding: 3 },
  languageButton: { paddingVertical: 7, paddingHorizontal: 10, borderRadius: 18 },
  languageSelected: { backgroundColor: '#183c2b' },
  languageText: { fontSize: 11, color: '#48584d', fontWeight: '700' },
  languageTextSelected: { color: '#fff' },
  hero: { backgroundColor: '#183c2b', borderRadius: 18, padding: 20, marginBottom: 14 },
  heroTitle: { fontSize: 19, color: '#fff', lineHeight: 27, fontWeight: '600' },
  offlineBadge: { color: '#c5e2c3', fontSize: 10, fontWeight: '700', letterSpacing: 0.8, marginTop: 16 },
  card: { backgroundColor: '#fff', borderRadius: 16, padding: 17, marginBottom: 14, borderWidth: 1, borderColor: '#e6ebe5' },
  sectionTitle: { color: '#183c2b', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  activeBanner: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 13 },
  activeLabel: { color: '#405649', fontWeight: '600', flex: 1, paddingRight: 8 },
  link: { color: '#256844', fontWeight: '700', fontSize: 12 },
  label: { color: '#435247', fontSize: 12, fontWeight: '700', marginTop: 10, marginBottom: 6 },
  input: { minHeight: 46, borderColor: '#dce4dc', borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, color: '#202b23', fontSize: 14, backgroundColor: '#fff' },
  notes: { minHeight: 96, paddingTop: 12 },
  row: { flexDirection: 'row', gap: 9 },
  secondaryButton: { flex: 1, minHeight: 42, justifyContent: 'center', alignItems: 'center', borderRadius: 10, backgroundColor: '#edf2ec' },
  secondaryText: { color: '#234d34', fontSize: 13, fontWeight: '700' },
  preview: { width: '100%', height: 190, marginTop: 10, borderRadius: 10, backgroundColor: '#e7ece5' },
  primaryButton: { minHeight: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 11, marginTop: 15, backgroundColor: '#183c2b' },
  primaryText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  outlineButton: { minHeight: 44, justifyContent: 'center', alignItems: 'center', borderRadius: 11, marginTop: 8, borderColor: '#b7c7b9', borderWidth: 1 },
  outlineText: { color: '#234d34', fontSize: 13, fontWeight: '700' },
  disabled: { opacity: 0.55 },
  disclaimer: { color: '#718075', fontSize: 11, lineHeight: 16, marginTop: 10 },
  status: { color: '#315a3f', fontSize: 12, lineHeight: 18, marginTop: 10, fontWeight: '600' },
  body: { color: '#334137', fontSize: 13, lineHeight: 19, marginBottom: 4 },
  caseItem: { borderTopColor: '#e7ece7', borderTopWidth: 1, paddingTop: 12, marginTop: 8 },
  caseMain: { paddingBottom: 4 },
  caseTitle: { color: '#1f3828', fontSize: 14, fontWeight: '700' },
  caseNote: { color: '#59675d', fontSize: 12, marginTop: 4, lineHeight: 17 },
  muted: { color: '#718075', fontSize: 12, lineHeight: 17 },
  reviewButton: { alignSelf: 'flex-start', paddingVertical: 7, paddingHorizontal: 10, backgroundColor: '#edf2ec', borderRadius: 8, marginTop: 5 },
  reviewText: { color: '#234d34', fontSize: 11, fontWeight: '700' },
  footer: { color: '#8a968b', fontSize: 10, textAlign: 'center', letterSpacing: 1, paddingVertical: 10 },
});
