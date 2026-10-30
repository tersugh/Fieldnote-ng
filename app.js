const form = document.querySelector('#case-form');
const photoInput = document.querySelector('#photo');
const cropSelect = document.querySelector('#crop');
const otherCrop = document.querySelector('#other-crop');
const preview = document.querySelector('#preview');
const uploadMain = document.querySelector('#upload-main');
const uploadHint = document.querySelector('#upload-hint');
const symptoms = document.querySelector('#symptoms');
const voiceButton = document.querySelector('#voice-button');
const voiceStatus = document.querySelector('#voice-status');
const charCount = document.querySelector('#char-count');
const submitButton = document.querySelector('#submit-button');
const emptyState = document.querySelector('#empty-state');
const loadingState = document.querySelector('#loading-state');
const errorState = document.querySelector('#error-state');
const analysisResult = document.querySelector('#analysis-result');
const clarificationPanel = document.querySelector('#clarification-panel');
const formMode = document.querySelector('#form-mode');
const activeCaseLabel = document.querySelector('#active-case-label');
const casebookList = document.querySelector('#casebook-list');
const newCaseButton = document.querySelector('#new-case-button');
const printReport = document.querySelector('#print-report');
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_RECORDING_SECONDS = 30;
let activeCaseId = null;
let activeCaseRecord = null;
let displayedCase = null;
let displayedVisit = null;
let refineBusy = false;
let visitBusy = false;
let caseActionBusy = false;
let savedPreviewUrl = null;
let draftWrites = Promise.resolve();
let draftSaveError = null;
let recordingSession = null;
let language = localStorage.getItem('fieldnote-language') === 'ha' ? 'ha' : 'en';

const copy = {
  en: {
    answerLabel: 'Your answer', answerPlaceholder: 'Tell us what you observed…', updateAdvice: 'Update advice',
    updatingAdvice: 'Updating advice…', clarificationHistory: 'Clarification history', openAdvice: 'View advice / answer question',
    refinePrivacy: 'Updating advice sends this saved visit’s photo, notes, previous advice, and your answer to Meta. It does not add a photo visit.',
    draftSaved: 'Draft saved on this device.', draftFailed: 'Could not save the draft on this device. Keep this page open and retry.',
    refineFailed: 'Advice was not updated. Your previous advice and answer are still available; retry when connected.',
    refineSuccess: 'Advice updated and conversation saved.', answerRequired: 'Type an answer first.',
    invalidAdvice: 'The service returned incomplete advice. Your previous advice and answer are unchanged.',
    voiceTooLong: 'The transcript would exceed 1,200 characters. Your existing text is unchanged; record a shorter answer.',
    voiceConsent: 'Record in English for up to 30 seconds? Stopping sends the audio to Meta for transcription. You can edit the transcript before updating advice.',
    savedRevision: 'Advice after this answer', pendingAnswer: 'Saved answer — update pending',
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
    activeCase: (crop, count) => `${crop} · ${count} previous ${count === 1 ? 'visit' : 'visits'}`,
    chooseLanguage: 'Choose language', ariaHome: 'Fieldnote home', ariaWorkspace: 'Crop incident form',
    areaNoLocation: 'Location not added', errorCrop: 'Choose a crop or enter its name.',
  },
  ha: {
    answerLabel: 'Amsarka', answerPlaceholder: 'Rubuta abin da ka lura da shi…', updateAdvice: 'Sabunta shawara',
    updatingAdvice: 'Ana sabunta shawara…', clarificationHistory: 'Tarihin tambayoyi da amsoshi', openAdvice: 'Duba shawara / amsa tambaya',
    refinePrivacy: 'Sabunta shawara yana aika hoton wannan ziyara, bayanai, shawarar baya da amsarka ga Meta. Ba sabuwar ziyara ba ce.',
    draftSaved: 'An ajiye amsar a wannan na’ura.', draftFailed: 'Ba a iya ajiye amsar ba. Ka bar shafin a buɗe ka sake gwadawa.',
    refineFailed: 'Ba a sabunta shawara ba. Shawarar baya da amsarka suna nan; ka sake gwadawa idan akwai intanet.',
    refineSuccess: 'An sabunta shawara kuma an ajiye tarihin tattaunawa.', answerRequired: 'Rubuta amsarka da farko.',
    invalidAdvice: 'Ba a samu cikakkiyar shawara ba. Shawarar baya da amsarka suna nan.',
    voiceTooLong: 'Rubutun muryar zai wuce haruffa 1,200. Ka yi gajeren rikodi; rubutunka yana nan.',
    voiceConsent: 'Yi rikodin Turanci na daƙiƙa 30? Dakatarwa tana aika sautin ga Meta domin rubutu. Za ka iya gyara rubutun kafin sabunta shawara.',
    savedRevision: 'Shawara bayan wannan amsa', pendingAnswer: 'An ajiye amsa — ana jiran sabuntawa',    prototype: 'Samfurin gwajin hackathon', eyebrow: 'BINCIKEN RAHOTON MATSALAR GONA', headline: 'Ka lura da canji.<br /><em>Ka san mataki na gaba.</em>',
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
    activeCase: (crop, count) => `${crop} · ziyarori ${count} da suka gabata`,
    chooseLanguage: 'Zaɓi harshe', ariaHome: 'Shafin farko na Fieldnote', ariaWorkspace: 'Fom ɗin rahoton gona',
    areaNoLocation: 'Ba a saka wuri ba', errorCrop: 'Zaɓi amfanin gona ko rubuta sunansa.',
  },
};

const cropNames = {
  ha: { Soybean: 'Waken soya', Cocoa: 'Koko', Yam: 'Doya', Cassava: 'Rogo', Maize: 'Masara', Rice: 'Shinkafa', 'Oil palm': 'Dabino mai (oil palm)', Groundnut: 'Gyada', Sesame: 'Ridi', Sorghum: 'Dawa', Cowpea: 'Wake', Cashew: 'Kashu (cashew)', Ginger: 'Citta', Hibiscus: 'Karkade', Rubber: 'Roba', Cotton: 'Auduga', Shea: 'Kadanya (shea)', 'Chili pepper': 'Barkono mai zafi', Tomato: 'Tumatir', Sugarcane: 'Rake', Millet: 'Gero', Coffee: 'Kofi', 'Kola nut': 'Goro', 'Gum arabic': 'Danko (gum arabic)', Turmeric: 'Kurkum', Moringa: 'Zogale', Tobacco: 'Taba', Plantain: 'Ayaba babba (plantain)', Banana: 'Ayaba', Mango: 'Mangwaro', Pineapple: 'Abarba', Egusi: 'Agushi' },
};

function tr(key) { return copy[language][key] ?? copy.en[key] ?? key; }
function applyLanguage(nextLanguage) {
  language = nextLanguage === 'ha' ? 'ha' : 'en';
  document.querySelector('#save-local').textContent = language === 'ha' ? 'Ajiye a nan — a tantance daga baya' : 'Save on this device — analyze later';
  localStorage.setItem('fieldnote-language', language);
  document.documentElement.lang = language;
  document.title = language === 'ha' ? 'Fieldnote — Rahoton gonaki' : 'Fieldnote — Crop incident follow-up';
  document.querySelector('[aria-label="Choose language"]')?.setAttribute('aria-label', tr('chooseLanguage'));
  for (const button of document.querySelectorAll('[data-language]')) button.setAttribute('aria-pressed', String(button.dataset.language === language));
  const ids = {
    'prototype-copy':'prototype','eyebrow-copy':'eyebrow','intro-copy':'intro','story-copy':'story','model-copy':'model',
    'form-mode':activeCaseId?'followMode':'startMode','form-title':'formTitle','crop-label':'cropLabel','required-crop':'required',
    'photo-label':'photoLabel','required-photo':'required','upload-main':activeCaseId?'newFollowup':'choosePhoto','upload-hint':'photoHint',
    'symptoms-label':'symptomsLabel','required-symptoms':'required','field-hint':'fieldHint','stage-label':'stageLabel',
    'optional-stage':'optional','location-label':'locationLabel','optional-location':'optional','privacy-copy':'privacy',
    'submit-copy':activeCaseId?'comparing':'submit','disclaimer-copy':'disclaimer','result-label':'resultLabel','result-title':'resultTitle',
    'empty-copy':'empty','loading-title':'loadingTitle','loading-copy':'loadingCopy','result-foot-copy':'resultFoot',
    'casebook-label':'casebookLabel','casebook-title':'casebookTitle','casebook-copy':'casebookCopy','new-case-copy':'newCase',
    'casebook-empty':'casebookEmpty','footer-copy':'footer','voice-button-copy':language==='ha'?'voiceButtonHausa':'voiceButton'
  };
  for (const [id,key] of Object.entries(ids)) { const element=document.getElementById(id); if(element) element.textContent=tr(key); }
  document.getElementById('headline').innerHTML=tr('headline');
  document.getElementById('workspace').setAttribute('aria-label',tr('ariaWorkspace'));
  document.querySelector('.brand').setAttribute('aria-label',tr('ariaHome'));
  cropSelect.options[0].textContent=tr('selectCrop');
  for (const option of cropSelect.options) if(option.value && option.value!=='Other') option.textContent=language==='ha'?(cropNames.ha[option.value]||option.value):option.value;
  cropSelect.options[cropSelect.options.length-1].textContent=tr('otherCrop');
  otherCrop.placeholder=tr('otherCropPlaceholder');
  otherCrop.setAttribute('aria-label',tr('otherCrop'));
  symptoms.placeholder=language==='ha'?(activeCaseId?'Me ya canza tun ziyarar baya? Rubuta sabbin alamu ko abin da kuka gwada…':tr('symptomsPlaceholder')):(activeCaseId?'What has changed since the last visit? Note new signs, spread, or anything you tried…':tr('symptomsPlaceholder'));
  const stageNames=language==='ha'?['Zaɓi idan ka sani','Matashin shuka','Girman ganye','Fure','Samar da ’ya’ya ko ƙwaya','Balaga ko girbi']:['Select if known','Seedling / early growth','Vegetative / leaf growth','Flowering','Fruit, pod, or tuber development','Maturity / harvest'];
  Array.from(document.querySelector('#stage').options).forEach((option,index)=>option.textContent=stageNames[index]);
  document.getElementById('location').placeholder=tr('locationPlaceholder');
  document.getElementById('voice-button').disabled=language==='ha';
  document.getElementById('voice-button').setAttribute('aria-pressed','false');
  document.getElementById('voice-status').textContent=language==='ha'?tr('voiceHausaOff'):tr('voiceHint');
  preview.alt=language==='ha'?'Hoton shukar da aka zaɓa':'Selected crop photo preview';
  if(activeCaseRecord) {
    const cropName=language==='ha'?(cropNames.ha[activeCaseRecord.crop]||activeCaseRecord.crop):activeCaseRecord.crop;
    activeCaseLabel.textContent=copy[language].activeCase(cropName,activeCaseRecord.observations.length);
  }
  if (displayedCase) renderSavedAdvice();
  renderCasebook();
}

document.querySelectorAll('[data-language]').forEach((button) => button.addEventListener('click', () => {
  if (refineBusy || visitBusy || caseActionBusy) return;
  cancelRecording();
  applyLanguage(button.dataset.language);
}));
applyLanguage(language);

symptoms.addEventListener('input', () => { charCount.textContent = `${symptoms.value.length} / 1200`; });

// One recording/transcription pipeline, with an explicit destination field per session.
voiceButton.addEventListener('click', () => startRecording(symptoms, voiceButton, voiceStatus));
window.addEventListener('pagehide', cancelRecording);

function cancelRecording() {
  const session = recordingSession;
  if (!session) return;
  recordingSession = null;
  session.cancelled = true;
  clearTimeout(session.timer);
  session.controller?.abort();
  if (session.recorder?.state === 'recording') session.recorder.stop();
  session.stream?.getTracks().forEach((track) => track.stop());
  session.button.classList.remove('recording');
  session.button.disabled = language === 'ha';
  session.button.setAttribute('aria-pressed', 'false');
  session.button.querySelector('span:last-child').textContent = tr('voiceButton');
}

async function startRecording(field, button, status) {
  if (language === 'ha' || refineBusy || visitBusy) return;
  if (recordingSession) {
    if (recordingSession.button === button && recordingSession.recorder?.state === 'recording') recordingSession.recorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    status.textContent = tr('voiceUnsupported');
    return;
  }
  if (!window.confirm(tr('voiceConsent'))) return;
  const session = { field, button, status, chunks: [], cancelled: false, language };
  recordingSession = session;
  button.disabled = true;
  try {
    session.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    if (session.cancelled) { session.stream.getTracks().forEach((track) => track.stop()); return; }
    session.recorder = new MediaRecorder(session.stream);
    session.recorder.addEventListener('dataavailable', (event) => { if (event.data.size) session.chunks.push(event.data); });
    session.recorder.addEventListener('stop', () => finishRecording(session), { once: true });
    session.recorder.addEventListener('error', () => { cancelRecording(); status.textContent = tr('voiceFailed'); });
    session.recorder.start();
    button.disabled = false;
    button.classList.add('recording');
    button.setAttribute('aria-pressed', 'true');
    button.querySelector('span:last-child').textContent = tr('voiceRecording');
    status.textContent = 'Recording in English… 30 seconds maximum.';
    session.timer = setTimeout(() => { if (session.recorder.state === 'recording') session.recorder.stop(); }, MAX_RECORDING_SECONDS * 1000);
  } catch {
    if (!session.cancelled) status.textContent = tr('voiceDenied');
    if (recordingSession === session) cancelRecording();
  }
}

async function finishRecording(session) {
  clearTimeout(session.timer);
  session.stream?.getTracks().forEach((track) => track.stop());
  if (session.cancelled) return;
  const { field, button, status } = session;
  button.classList.remove('recording');
  button.disabled = true;
  button.setAttribute('aria-pressed', 'false');
  button.querySelector('span:last-child').textContent = tr('voiceTranscribing');
  status.textContent = tr('voiceConverting');
  session.controller = new AbortController();
  const timeout = setTimeout(() => session.controller.abort(), 70000);
  try {
    const blob = new Blob(session.chunks, { type: session.recorder.mimeType || 'audio/webm' });
    const wav = await convertToWav(blob);
    if (session.cancelled) return;
    const audioDataUrl = await readAsDataUrl(wav);
    if (session.cancelled) return;
    const response = await fetch('/api/transcribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: session.controller.signal,
      body: JSON.stringify({ audio_data_url: audioDataUrl, language: 'en' }),
    });
    const body = await response.json();
    if (session.cancelled || !field.isConnected || language !== session.language) return;
    if (!response.ok) throw new Error(body.detail || tr('voiceFailed'));
    if (typeof body.transcript !== 'string' || !body.transcript.trim()) throw new Error(tr('voiceFailed'));
    const combined = [field.value.trim(), body.transcript.trim()].filter(Boolean).join(' ');
    if (combined.length > 1200) throw new Error(tr('voiceTooLong'));
    field.value = combined;
    field.dispatchEvent(new Event('input', { bubbles: true }));
    field.focus();
    status.textContent = tr('voiceReview');
  } catch (error) {
    if (!session.cancelled) status.textContent = error.name === 'AbortError' ? tr('voiceFailed') : localizeError(error.message) || tr('voiceFailed');
  } finally {
    clearTimeout(timeout);
    if (recordingSession === session) recordingSession = null;
    if (!session.cancelled) {
      button.disabled = language === 'ha';
      button.querySelector('span:last-child').textContent = language === 'ha' ? tr('voiceButtonHausa') : tr('voiceButton');
    }
  }
}

async function convertToWav(blob) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const sourceRate = decoded.sampleRate;
    const targetRate = 24000;
    const outputLength = Math.min(targetRate * MAX_RECORDING_SECONDS, Math.floor(decoded.length * targetRate / sourceRate));
    const channels = Array.from({ length: decoded.numberOfChannels }, (_, index) => decoded.getChannelData(index));
    const pcm = new Int16Array(outputLength);
    for (let i = 0; i < outputLength; i += 1) {
      const sourceIndex = i * sourceRate / targetRate;
      const left = Math.floor(sourceIndex);
      const fraction = sourceIndex - left;
      let sample = 0;
      for (const channel of channels) {
        const first = channel[Math.min(left, channel.length - 1)] || 0;
        const second = channel[Math.min(left + 1, channel.length - 1)] || 0;
        sample += first + (second - first) * fraction;
      }
      sample /= channels.length;
      pcm[i] = Math.max(-1, Math.min(1, sample)) * (sample < 0 ? 32768 : 32767);
    }
    const wav = new ArrayBuffer(44 + pcm.length * 2);
    const view = new DataView(wav);
    const write = (offset, text) => { for (let i = 0; i < text.length; i += 1) view.setUint8(offset + i, text.charCodeAt(i)); };
    write(0, 'RIFF'); view.setUint32(4, wav.byteLength - 8, true); write(8, 'WAVE');
    write(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true);
    view.setUint16(22, 1, true); view.setUint32(24, targetRate, true);
    view.setUint32(28, targetRate * 2, true); view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    write(36, 'data'); view.setUint32(40, pcm.length * 2, true);
    for (let i = 0; i < pcm.length; i += 1) view.setInt16(44 + i * 2, pcm[i], true);
    return new Blob([wav], { type: 'audio/wav' });
  } finally { await context.close(); }
}
cropSelect.addEventListener('change', () => {
  const isOther = cropSelect.value === 'Other';
  otherCrop.hidden = !isOther;
  otherCrop.required = isOther;
});

photoInput.addEventListener('change', async () => {
  if (refineBusy || visitBusy || caseActionBusy) return;
  await draftWrites;
  if (draftSaveError || refineBusy || visitBusy || caseActionBusy) return;
  const file = photoInput.files?.[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_BYTES) {
    photoInput.value = '';
    preview.hidden = true;
    showError('Choose a JPG, PNG, or WebP image smaller than 8 MB.');
    return;
  }
  errorState.hidden = true;
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  uploadMain.textContent = file.name;
  uploadHint.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB · select another photo to replace`;
});

document.querySelector('#drop-zone').addEventListener('dragover', (event) => { event.preventDefault(); event.currentTarget.classList.add('dragover'); });
document.querySelector('#drop-zone').addEventListener('dragleave', (event) => { event.currentTarget.classList.remove('dragover'); });
document.querySelector('#drop-zone').addEventListener('drop', (event) => {
  event.preventDefault(); event.currentTarget.classList.remove('dragover');
  if (refineBusy || visitBusy || caseActionBusy) return;
  const file = event.dataTransfer.files?.[0];
  if (!file) return;
  const transfer = new DataTransfer(); transfer.items.add(file); photoInput.files = transfer.files;
  photoInput.dispatchEvent(new Event('change'));
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  return saveWebVisit(true);
});
document.querySelector('#save-local').addEventListener('click', () => saveWebVisit(false));

async function saveWebVisit(sendNow) {
  if (refineBusy || visitBusy || caseActionBusy) return;
  const file = photoInput.files?.[0];
  const crop = cropSelect.value === 'Other' ? otherCrop.value.trim() : cropSelect.value;
  if (!crop || !file || !symptoms.value.trim()) return showError(language === 'ha' ? 'Zaɓi amfanin gona da hoto, sannan rubuta alamun.' : 'Choose a crop and photo, and describe the symptoms.');
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_BYTES) return showError('Choose a JPG, PNG, or WebP image smaller than 8 MB.');
  // Claim the operation before the first await; React/DOM updates are not a lock.
  setLoading(true);
  cancelRecording();
  try {
    await draftWrites;
    if (draftSaveError) throw new Error(tr('draftFailed'));
    const prior = activeCaseId ? await getCase(activeCaseId) : null;
    if (activeCaseId && !prior) throw new Error('The saved case could not be opened.');
    const now = new Date().toISOString();
    const visit = { id: crypto.randomUUID(), date: now, photo: file, symptoms: symptoms.value.trim(),
      stage: document.querySelector('#stage').value, location: document.querySelector('#location').value.trim(),
      analysis: { state: 'pending', kind: 'saved' } };
    const record = prior
      ? { ...prior, updatedAt: now, observations: [...prior.observations, visit] }
      : { id: crypto.randomUUID(), crop, location: visit.location, createdAt: now, updatedAt: now, observations: [visit] };
    await putCase(record); // Includes the Blob, committed before any upload.
    clearPhotoInput();
    activateCase(record);
    showSavedAdvice(record, record.observations.length - 1);
    await renderCasebook();
    if (sendNow) await analyzeSavedWebVisit(record.id, record.observations.length - 1);
  } catch (error) {
    showError(error.message || 'Local save failed. Your form has been kept; check device storage.');
  } finally { setLoading(false); }
}

function analysisStatus(visit) {
  if (visit.assessment) return language === 'ha' ? 'An kammala tantancewa' : 'Analysis complete';
  if (visit.analysis?.state === 'error') {
    const prefix = visit.analysis.kind === 'input'
      ? (language === 'ha' ? 'Bayanan na buƙatar gyara' : 'Input needs correction')
      : (language === 'ha' ? 'Tantancewa ta gaza' : 'Analysis needs attention');
    return prefix + (visit.analysis.message ? ': ' + visit.analysis.message : '');
  }
  return language === 'ha'
    ? 'Ana jiran tantancewa. An ajiye hoto da bayanai a nan. Babu aikawa ta atomatik.'
    : 'Pending analysis. Photo and details saved on this device. Nothing is sent automatically.';
}

function analysisError(kind, message) {
  return Object.assign(new Error(message), { analysisKind: kind });
}

async function fetchSavedAssessment(endpoint, payload) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 100000);
  try {
    let response;
    try {
      response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload), signal: controller.signal });
    } catch {
      throw analysisError('connection', language === 'ha' ? 'Ba a samu amsa ba. Za ka iya sake gwadawa da kanka.' : 'No response received (connection, timeout, or blocked request). Retry when ready.');
    }
    let body;
    try { body = await response.json(); }
    catch (error) {
      if (error.name === 'AbortError' || error.name === 'TypeError') throw analysisError('connection', 'The response was interrupted. Your saved note is intact; retry when ready.');
      throw analysisError('model', 'The service returned an unreadable response. The saved note is intact.');
    }
    if (!response.ok) throw analysisError(response.status === 400 || response.status === 422 ? 'input' : 'model',
      typeof body.detail === 'string' ? body.detail : 'The service could not produce advice.');
    if (!validRevisedAssessment(body.assessment)) throw analysisError('model', 'The service returned incomplete advice. The saved note is intact.');
    return body.assessment;
  } finally { clearTimeout(timeout); }
}

async function analyzeSavedWebVisit(caseId, index) {
  const record = await getCase(caseId);
  const target = record?.observations[index];
  if (!target || target.assessment) return;
  loadingState.hidden = false;
  let result;
  try {
    const previous = index > 0 ? record.observations[index - 1] : null;
    let image, previousImage;
    try {
      image = await readAsDataUrl(target.photo);
      if (previous) previousImage = await readAsDataUrl(previous.photo);
    } catch { throw analysisError('input', 'The saved photo could not be read. Add a corrected visit with a readable photo.'); }
    const payload = { image_data_url: image, crop: record.crop, symptoms: target.symptoms, stage: target.stage || '',
      location: target.location ?? record.location ?? '', language };
    if (previous) Object.assign(payload, { previous_image_data_url: previousImage, previous_note: previous.symptoms });
    const assessment = await fetchSavedAssessment(previous ? '/api/followup' : '/api/diagnose', payload);
    result = { assessment, analysis: { state: 'complete' } };
  } catch (error) {
    const kind = error.analysisKind || 'model';
    result = { analysis: { state: kind === 'connection' ? 'pending' : 'error', kind, message: error.message } };
  }
  // Merge into the current record, preserving all other visits and clarification turns.
  const latest = await getCase(caseId);
  if (!latest?.observations[index] || latest.observations[index].id !== target.id) throw new Error('The saved visit changed. Reopen it before retrying.');
  if (!latest.observations[index].assessment) Object.assign(latest.observations[index], result);
  latest.updatedAt = new Date().toISOString();
  await putCase(latest);
  if (activeCaseId === caseId) activeCaseRecord = latest;
  showSavedAdvice(latest, index);
  await renderCasebook();
}

async function retryWebAnalysis(caseId, index) {
  if (refineBusy || visitBusy || caseActionBusy) return;
  setLoading(true);
  cancelRecording();
  try {
    await draftWrites;
    if (draftSaveError) throw new Error(tr('draftFailed'));
    await analyzeSavedWebVisit(caseId, index);
  } catch (error) { showError(error.message || 'The local case could not be updated. Reopen the saved visit.'); }
  finally { setLoading(false); }
}

newCaseButton.addEventListener('click', startNewCase);
casebookList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button || refineBusy || visitBusy || caseActionBusy) return;
  if (button.dataset.action === 'retry') return retryWebAnalysis(button.dataset.caseId, Number(button.dataset.visitIndex));
  cancelRecording();
  await draftWrites;
  if (draftSaveError) return;
  const record = await getCase(button.dataset.caseId);
  if (!record) return;
  if (button.dataset.action === 'advice') {
    showSavedAdvice(record, Number(button.dataset.visitIndex));
  } else if (button.dataset.action === 'continue') {
    activateCase(record);
    clearPhotoInput();
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (button.dataset.action === 'print') {
    await printFarmPlan(record);
  } else if (button.dataset.action === 'share') {
    await shareCaseWithWorker(record);
  }
});

renderCasebook();

// Local clock checks only: no notification service or network retry.
window.setInterval?.(() => { if (!visitBusy && !refineBusy && !caseActionBusy) void renderCasebook(); }, 30000);
document.addEventListener?.('visibilitychange', () => { if (!document.hidden && !visitBusy && !refineBusy && !caseActionBusy) void renderCasebook(); });

function readAsDataUrl(file) {
  return new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = () => reject(new Error('Could not read this image.')); reader.readAsDataURL(file); });
}
function openCaseDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('fieldnote-casebook', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('cases', { keyPath: 'id' });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('This browser could not open the local casebook.'));
  });
}
async function caseStoreRequest(method, value) {
  const db = await openCaseDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction('cases', method === 'get' || method === 'getAll' ? 'readonly' : 'readwrite');
    const store = transaction.objectStore('cases');
    const request = method === 'getAll' ? store.getAll() : store[method](value);
    let result;
    request.onsuccess = () => { result = request.result; };
    request.onerror = () => reject(new Error('The local casebook could not be read or saved.'));
    transaction.oncomplete = () => { db.close(); resolve(result); };
    transaction.onabort = () => { db.close(); reject(new Error('The local casebook save was aborted.')); };
    transaction.onerror = () => { db.close(); reject(new Error('The local casebook could not be updated.')); };
  });
}
const getCase = (id) => caseStoreRequest('get', id);
const putCase = (record) => caseStoreRequest('put', record);
async function renderCasebook() {
  try {
    const records = (await caseStoreRequest('getAll')).sort((a, b) => Number(recheckDue(b.recheckAt)) - Number(recheckDue(a.recheckAt)) || b.updatedAt.localeCompare(a.updatedAt));
    if (!records.length) {
      casebookList.innerHTML = `<p class="casebook-empty">${escapeHtml(tr('casebookEmpty'))}</p>`;
      return;
    }
    casebookList.innerHTML = records.map((record) => {
      const latest = record.observations[record.observations.length - 1];
      const excerpt = latest.symptoms.length > 115 ? `${latest.symptoms.slice(0, 112)}…` : latest.symptoms;
      const cropName = language==='ha'?(cropNames.ha[record.crop]||record.crop):record.crop;
      const adviceActions = record.observations.map((visit, index) =>
        `<div><span>${index + 1} · ${escapeHtml(analysisStatus(visit))}</span>
        <button type="button" data-action="advice" data-case-id="${escapeHtml(record.id)}" data-visit-index="${index}">${escapeHtml(visit.assessment ? tr('openAdvice') : (language === 'ha' ? 'Duba bayanan da aka ajiye' : 'View saved details'))}</button>
        ${!visit.assessment ? `<button type="button" data-action="retry" data-case-id="${escapeHtml(record.id)}" data-visit-index="${index}">${language === 'ha' ? 'Sake neman tantancewa' : 'Retry analysis'}</button>` : ''}</div>`).join('');
      const shareAction = `<button type="button" data-action="share" data-case-id="${escapeHtml(record.id)}">${tr('share')}</button>`;
      return `<article class="case-card">${record.recheckAt ? `<div class="recheck-notice"><strong>${recheckDue(record.recheckAt) ? (language === 'ha' ? 'Lokacin sake dubawa ya yi' : 'Recheck due') : (language === 'ha' ? 'Tunatarwar sake dubawa' : 'Recheck reminder')}</strong> · ${escapeHtml(formatDate(record.recheckAt))}<button type="button" data-action="continue" data-case-id="${escapeHtml(record.id)}">${language === 'ha' ? 'Fara ziyara da sabon hoto a wannan rahoto' : 'Start photo follow-up on this case'}</button></div>` : ''}<div class="case-card-top"><div><span class="case-crop">${escapeHtml(cropName)}</span><span class="case-location">${record.location ? escapeHtml(record.location) : tr('noLocation')}</span></div><span class="case-count">${record.observations.length} ${record.observations.length === 1 ? tr('visit') : tr('visits')}</span></div><p class="case-excerpt">${escapeHtml(excerpt)}</p><div class="case-card-foot"><span>${tr('updated')} ${escapeHtml(formatDate(record.updatedAt))}</span><div class="case-actions">${adviceActions}${shareAction}<button type="button" data-action="print" data-case-id="${escapeHtml(record.id)}">${tr('print')}</button><button type="button" class="case-continue" data-action="continue" data-case-id="${escapeHtml(record.id)}">${tr('addFollowup')} ↗</button></div></div></article>`;
    }).join('');
    if (visitBusy || refineBusy || caseActionBusy) casebookList.querySelectorAll('button').forEach(button => { button.disabled = true; });
  } catch (error) {
    casebookList.innerHTML = `<p class="casebook-empty">${escapeHtml(error.message)}</p>`;
  }
}
function formatDate(value) { return new Intl.DateTimeFormat(language==='ha'?'ha-NG':'en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
function makeChecklist(steps, now = new Date().toISOString()) {
    return { savedAt: now, items: steps.map(text => ({ text, state: 'todo', note: '' })) };
}
function updateChecklist(saved, progress) {
    if (saved.items.length !== progress.length)
        throw new Error('The checklist changed. Reopen it before saving.');
    return { ...saved, items: saved.items.map((item, index) => {
            const change = progress[index];
            if (!['todo', 'done', 'skipped'].includes(change.state) || change.note.length > 300)
                throw new Error('Choose a valid status and keep each note within 300 characters.');
            return { ...item, state: change.state, note: change.note };
        }) };
}
// Parse local wall-clock input strictly, rejecting invalid dates and DST gaps.
function parseRecheck(value) {
    const parts = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(value);
    if (!parts)
        throw new Error('Enter a local date and time as YYYY-MM-DD HH:mm.');
    const [year, month, day, hour, minute] = parts.slice(1).map(Number);
    const date = new Date(year, month - 1, day, hour, minute);
    if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute)
        throw new Error('Enter a valid local date and time.');
    return date.toISOString();
}
function localRecheck(value) {
    if (!value)
        return '';
    const date = new Date(value);
    if (!Number.isFinite(date.getTime()))
        return '';
    const pad = (number) => String(number).padStart(2, '0');
    return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}
function recheckDue(value, now = Date.now()) {
    return !!value && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now;
}

async function saveWebCaseAction(kind) {
  if (caseActionBusy || visitBusy || refineBusy || !displayedCase) return;
  caseActionBusy = true;
  const caseId = displayedCase.id, index = displayedVisit;
  const panel = document.querySelector('#case-action-panel');
  const status = document.querySelector('#action-status');
  panel.querySelectorAll('button, input, select, textarea').forEach(element => { element.disabled = true; });
  const otherControls = '#clarification-answer, #answer-voice, #update-advice, #save-local, #submit-button, [data-language], #new-case-button, #photo, #voice-button, #casebook-list button';
  document.querySelectorAll(otherControls).forEach(element => { element.disabled = true; });
  try {
    await draftWrites;
    if (draftSaveError) throw new Error(tr('draftFailed'));
    const record = await getCase(caseId);
    const visit = record?.observations[index];
    if (!visit) throw new Error('The saved visit could not be opened.');
    if (kind === 'create' && !visit.checklist) visit.checklist = makeChecklist(visit.assessment?.next_steps || []);
    if (kind === 'progress') {
      if (!visit.checklist) throw new Error('Save the checklist first.');
      const progress = visit.checklist.items.map((item, i) => ({
        state: document.querySelector('#step-state-' + i).value, note: document.querySelector('#step-note-' + i).value,
      }));
      visit.checklist = updateChecklist(visit.checklist, progress);
    }
    if (kind === 'reminder') record.recheckAt = parseRecheck(document.querySelector('#recheck-time').value);
    if (kind === 'dismiss') record.recheckAt = null;
    await putCase(record);
    if (activeCaseId === caseId) activeCaseRecord = record;
    displayedCase = record;
    if (kind === 'create') renderCaseActions();
    else {
      document.querySelector('#dismiss-recheck').hidden = !record.recheckAt;
      document.querySelector('#recheck-time').value = localRecheck(record.recheckAt);
    }
    document.querySelector('#action-status').textContent = language === 'ha' ? 'An ajiye a wannan na’ura.' : 'Saved on this device.';
    await renderCasebook();
  } catch (error) {
    status.textContent = error.message || 'Could not save. Your edits are still here.';
  } finally {
    caseActionBusy = false;
    panel.querySelectorAll('button, input, select, textarea').forEach(element => { element.disabled = false; });
    document.querySelectorAll(otherControls).forEach(element => { element.disabled = false; });
    if (language === 'ha') document.querySelectorAll('#voice-button, #answer-voice').forEach(element => { element.disabled = true; });
  }
}

function renderCaseActions() {
  const panel = document.querySelector('#case-action-panel');
  const visit = displayedCase?.observations[displayedVisit];
  panel.hidden = !visit;
  if (!visit) return;
  const label = (en, ha) => language === 'ha' ? ha : en;
  const checklist = visit.checklist;
  panel.innerHTML = `<h3>${label('Action checklist', 'Jerin ayyuka')}</h3>
    <p>${label('These are the saved advice steps, unchanged. Save progress after editing. No AI request is made.', 'Waɗannan matakan shawara ne da aka ajiye, ba su canza ba. Ajiye ci gaba bayan gyara.')}</p>
    ${!checklist && visit.assessment?.next_steps?.length ? `<button type="button" id="create-checklist">${label('Save these steps as a checklist', 'Ajiye waɗannan matakai a jeri')}</button>` : ''}
    ${checklist ? `<ol>${checklist.items.map((item, index) => `<li><p>${escapeHtml(item.text)}</p>
      <label for="step-state-${index}">${label('Status', 'Matsayi')}</label>
      <select id="step-state-${index}">${['todo', 'done', 'skipped'].map(state => `<option value="${state}" ${item.state === state ? 'selected' : ''}>${state === 'todo' ? label('To do', 'A yi') : state === 'done' ? label('Done', 'An yi') : label('Skipped', 'An tsallake')}</option>`).join('')}</select>
      <label for="step-note-${index}">${label('Optional note (300 characters)', 'Bayani na zaɓi (haruffa 300)')}</label>
      <textarea id="step-note-${index}" maxlength="300" rows="2">${escapeHtml(item.note)}</textarea></li>`).join('')}</ol>
      <button type="button" id="save-progress">${label('Save progress', 'Ajiye ci gaba')}</button>` : ''}
    <h3>${label('Recheck reminder', 'Tunatarwar sake dubawa')}</h3>
    <p>${label('Choose a local date and time. Reminders appear here when this app is open; no push notifications or automatic uploads.', 'Zaɓi kwanan wata da lokacin yankinka. Tunatarwa tana bayyana a nan yayin da manhaja take buɗe; babu aikawa ta atomatik.')}</p>
    <label for="recheck-time">${label('Local date and time', 'Kwanan wata da lokaci')}</label>
    <input id="recheck-time" type="datetime-local" value="${escapeHtml(localRecheck(displayedCase.recheckAt))}">
    <button type="button" id="save-recheck">${label('Set / change reminder', 'Saita / canza tunatarwa')}</button>
    <button type="button" id="dismiss-recheck" ${displayedCase.recheckAt ? '' : 'hidden'}>${label('Dismiss reminder', 'Soke tunatarwa')}</button>
    <p id="action-status" role="status"></p>`;
  panel.querySelector('#create-checklist')?.addEventListener('click', () => saveWebCaseAction('create'));
  panel.querySelector('#save-progress')?.addEventListener('click', () => saveWebCaseAction('progress'));
  panel.querySelector('#save-recheck').addEventListener('click', () => saveWebCaseAction('reminder'));
  panel.querySelector('#dismiss-recheck').addEventListener('click', () => saveWebCaseAction('dismiss'));
}
function buildCaseSummary(record, language = 'en') {
  const ha = language === 'ha';
  const label = (en, translated) => ha ? translated : en;
  const clean = (value) => typeof value === 'string' ? value.trim() : '';
  const date = (value) => {
    const parsed = new Date(value || '');
    return Number.isNaN(parsed.getTime()) ? label('Date not recorded', 'Ba a saka kwanan wata ba') : parsed.toISOString().slice(0, 10);
  };
  const visits = record.observations || [];
  const lines = [
    label('FIELDNOTE — Case summary', 'FIELDNOTE — Taƙaitaccen rahoto'),
    label('Crop: ', 'Amfanin gona: ') + (clean(record.crop) || label('Not recorded', 'Ba a saka ba')),
  ];
  if (clean(record.location)) lines.push(label('Area: ', 'Wuri: ') + clean(record.location));
  lines.push('', label('VISIT TIMELINE', 'JERIN ZIYARA'));
  if (!visits.length) lines.push(label('No visits recorded.', 'Babu ziyara da aka ajiye.'));
  visits.forEach((visit, index) => {
    lines.push('', label('Visit ', 'Ziyara ') + (index + 1) + ' · ' + date(visit.date));
    if (clean(visit.location)) lines.push(label('Area: ', 'Wuri: ') + clean(visit.location));
    if (clean(visit.stage)) lines.push(label('Growth stage: ', 'Matakin girma: ') + clean(visit.stage));
    lines.push(label('Farmer observations: ', 'Abin da manomi ya lura: ') + (clean(visit.symptoms) || label('Not recorded', 'Ba a saka ba')));
    const turns = visit.clarifications || visit.refinements || [];
    turns.forEach((turn) => {
      lines.push(label('Question: ', 'Tambaya: ') + clean(turn.question));
      lines.push(label('Farmer answer: ', 'Amsar manomi: ') + (clean(turn.answer) || label('Not answered', 'Ba a amsa ba')));
      if (!turn.assessment) lines.push(label('(Advice has not been updated for this answer.)', '(Ba a sabunta shawara kan wannan amsar ba.)'));
    });
    const question = clean(visit.assessment?.follow_up_question);
    if (question) lines.push(label('Current question: ', 'Tambayar yanzu: ') + question);
  });
  const adviceIndex = visits.map((visit) => !!visit.assessment).lastIndexOf(true);
  lines.push('', label('LATEST SAVED AI GUIDANCE', 'SABUWAR SHAWARAR AI DA AKA AJIYE'));
  if (adviceIndex < 0) {
    lines.push(label('No AI guidance saved. These are farmer observations only.', 'Ba a ajiye shawarar AI ba. Waɗannan bayanan manomi ne kawai.'));
  } else {
    const visit = visits[adviceIndex];
    const advice = visit.assessment;
    lines.push(label('For visit ', 'Na ziyara ') + (adviceIndex + 1) + ' · ' + date(visit.date));
    if (adviceIndex < visits.length - 1) lines.push(label('The newest visit has not received AI guidance.', 'Sabuwar ziyara ba ta samu shawarar AI ba.'));
    if (clean(advice.visual_observations)) lines.push(label('AI observations: ', 'Abin da AI ta lura: ') + clean(advice.visual_observations));
    if (advice.possible_causes?.length) lines.push(label('Possible explanations (not confirmed): ', 'Abubuwan da ka iya haddasawa (ba a tabbatar ba): ') + advice.possible_causes.map((cause) => clean(cause.name)).filter(Boolean).join('; '));
    (advice.next_steps || []).forEach((step, index) => lines.push((index + 1) + '. ' + clean(step)));
    if (clean(advice.urgency || advice.escalation)) lines.push(label('Urgency / warning signs: ', 'Gaggawa da alamomin lura: ') + clean(advice.urgency || advice.escalation));
  }
  lines.push('', label('AI guidance may be uncertain. The farmer is choosing to request a second opinion; this is not a confirmed diagnosis.', 'Shawarar AI na iya yin kuskure. Manomi ya zaɓi neman ƙarin ra’ayi; wannan ba tabbataccen bincike ba ne.'));
  return lines.join('\n');
}

async function shareWebSummary(text, photo, platform = navigator) {
  if (typeof platform.share !== 'function') return 'unavailable';
  const payload = { title: 'Fieldnote', text };
  if (photo) {
    try {
      if (!platform.canShare?.({ ...payload, files: [photo] })) return 'unsupported-photo';
    } catch { return 'unsupported-photo'; }
    payload.files = [photo];
  }
  try {
    await platform.share(payload);
    return 'opened';
  } catch (error) {
    return error?.name === 'AbortError' ? 'cancelled' : 'failed';
  }
}

async function copyCaseSummary(text, platform = navigator) {
  try {
    if (!platform.clipboard?.writeText) return false;
    await platform.clipboard.writeText(text);
    return true;
  } catch { return false; }
}

function downloadCaseSummary(text) {
  const url = URL.createObjectURL(new Blob([text], { type: 'text/plain;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'fieldnote-case-summary.txt';
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function shareCaseWithWorker(record) {
  const ha = language === 'ha';
  const label = (en, translated) => ha ? translated : en;
  const dialog = document.querySelector('#share-review');
  const summary = document.querySelector('#share-summary');
  const status = document.querySelector('#share-status');
  const photoChoice = document.querySelector('#share-photo');
  const photoButton = document.querySelector('#share-with-photo');
  const textButton = document.querySelector('#share-text');
  const closeButton = document.querySelector('#share-close');
  const preview = document.querySelector('#share-photo-preview');
  const opener = document.activeElement;
  let previewUrl = null;
  let pending = false;
  const text = buildCaseSummary(record, language);
  summary.value = text;
  status.textContent = '';
  document.querySelector('#share-title').textContent = label('Review before sharing', 'Duba rahoto kafin rabawa');
  document.querySelector('#share-explanation').textContent = label('Optional: ask an extension worker for a second opinion. Review the saved details below, then choose who receives them. Nothing is uploaded by Fieldnote.', 'Zaɓi ne: nemi ƙarin ra’ayin jami’in noma. Duba bayanan da ke ƙasa sannan ka zaɓi wanda za a aika wa. Fieldnote ba ta aika bayanan zuwa sabar ba.');
  document.querySelector('#share-summary-label').textContent = label('Case summary (select text to copy manually)', 'Taƙaitaccen rahoto (zaɓi rubutu don kwafawa)');
  document.querySelector('#share-photo-label').textContent = label('Optional photo from a saved visit', 'Hoto daga ziyarar da aka ajiye (zaɓi ne)');
  textButton.textContent = label('Share summary only', 'Raba rubutu kawai');
  photoButton.textContent = label('Share summary and selected photo', 'Raba rubutu da hoton da aka zaɓa');
  document.querySelector('#share-copy').textContent = label('Copy summary', 'Kwafi rahoto');
  document.querySelector('#share-download').textContent = label('Download summary', 'Sauke rahoto');
  closeButton.textContent = label('Close', 'Rufe');
  const photos = [];
  photoChoice.replaceChildren();
  (record.observations || []).forEach((visit, index) => {
    const photo = visit.photo;
    if (!(photo instanceof Blob) || !photo.size || !['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) return;
    const file = new File([photo], 'fieldnote-visit-' + (index + 1) + ({ 'image/jpeg': '.jpg', 'image/png': '.png', 'image/webp': '.webp' }[photo.type]), { type: photo.type });
    try {
      if (!navigator.canShare?.({ title: 'Fieldnote', text, files: [file] })) return;
    } catch { return; }
    const option = document.createElement('option');
    option.value = String(photos.length);
    option.textContent = label('Visit ', 'Ziyara ') + (index + 1) + ' · ' + formatDate(visit.date);
    photos.push(file);
    photoChoice.append(option);
  });
  document.querySelector('#share-photo-controls').hidden = !photos.length || !navigator.share;
  textButton.hidden = !navigator.share;
  const releasePreview = () => { if (previewUrl) URL.revokeObjectURL(previewUrl); previewUrl = null; };
  const updatePhoto = () => {
    releasePreview();
    const photo = photos[Number(photoChoice.value)];
    preview.hidden = !photo;
    if (photo) { previewUrl = URL.createObjectURL(photo); preview.src = previewUrl; }
    else preview.removeAttribute('src');
  };
  photoChoice.value = String(Math.max(0, photos.length - 1));
  photoChoice.onchange = updatePhoto;
  updatePhoto();
  const setPending = (value) => {
    pending = value;
    textButton.disabled = photoButton.disabled = closeButton.disabled = photoChoice.disabled = value;
  };
  const share = async (photo) => {
    if (pending) return;
    setPending(true);
    try {
      const result = await shareWebSummary(text, photo);
      status.textContent = result === 'opened' ? label('Share options used. Delivery is not confirmed.', 'An yi amfani da zaɓin rabawa. Ba a tabbatar da isarwa ba.')
        : result === 'cancelled' ? label('Sharing cancelled. Your saved case is unchanged.', 'An soke rabawa. Rahoton da aka ajiye bai canza ba.')
        : label('Sharing was unavailable or failed. Try sharing the summary only, copy it, or download it.', 'Ba a samu rabawa ba ko ta gaza. Gwada rubutu kawai, kwafa, ko sauke rahoton.');
    } finally { setPending(false); }
  };
  textButton.onclick = () => share(null);
  photoButton.onclick = () => share(photos[Number(photoChoice.value)]);
  document.querySelector('#share-copy').onclick = async () => {
    const copied = await copyCaseSummary(text);
    status.textContent = copied ? label('Summary copied. Paste it into your chosen message.', 'An kwafi rahoto. Manna shi a saƙon da ka zaɓa.')
      : label('Copy was unavailable. Select and copy the text below, or download it.', 'Ba a samu kwafawa ba. Zaɓi rubutu ka kwafa, ko sauke shi.');
    if (!copied) { summary.focus(); summary.select(); }
  };
  document.querySelector('#share-download').onclick = () => {
    try { downloadCaseSummary(text); status.textContent = label('Summary download requested.', 'An nemi sauke rahoto.'); }
    catch { status.textContent = label('Download failed. Select and copy the summary.', 'Sauke rahoto ya gaza. Zaɓi rubutu ka kwafa.'); summary.focus(); summary.select(); }
  };
  closeButton.onclick = () => { if (!pending) dialog.close(); };
  dialog.oncancel = (event) => { if (pending) event.preventDefault(); };
  dialog.onclose = () => { releasePreview(); opener?.focus(); };
  dialog.showModal();
  summary.focus();
}
function activateCase(record) {
  activeCaseId = record.id;
  activeCaseRecord = record;
  const knownCrop = Array.from(cropSelect.options).some((option) => option.value === record.crop);
  cropSelect.value = knownCrop ? record.crop : 'Other';
  cropSelect.disabled = true;
  otherCrop.hidden = knownCrop;
  otherCrop.required = !knownCrop;
  if (!knownCrop) otherCrop.value = record.crop;
  document.querySelector('#location').value = record.location || '';
  formMode.textContent = tr('followMode');
  const cropName=language==='ha'?(cropNames.ha[record.crop]||record.crop):record.crop;
  activeCaseLabel.textContent = copy[language].activeCase(cropName,record.observations.length);
  activeCaseLabel.hidden = false;
  document.getElementById('submit-copy').textContent = tr('comparing');
  symptoms.value = '';
  symptoms.placeholder = language==='ha'?'Me ya canza tun ziyarar baya? Rubuta sabbin alamu ko abin da kuka gwada…':'What has changed since the last visit? Note new signs, spread, or anything you tried…';
  symptoms.dispatchEvent(new Event('input'));
  showSavedAdvice(record, record.observations.length - 1, false);
  voiceStatus.textContent = language==='ha'?tr('voiceHausaOff'):'Add what changed since the last visit. Your transcript will be added here for review.';
}
function clearPhotoInput() {
  photoInput.value = '';
  preview.hidden = true;
  preview.removeAttribute('src');
  uploadMain.textContent = tr('newFollowup');
  uploadHint.textContent = tr('photoHint');
}
async function startNewCase() {
  if (refineBusy || visitBusy || caseActionBusy) return;
  cancelRecording();
  await draftWrites;
  if (draftSaveError) return;
  activeCaseId = null;
  activeCaseRecord = null;
  form.reset();
  cropSelect.disabled = false;
  otherCrop.hidden = true;
  otherCrop.required = false;
  clearPhotoInput();
  uploadMain.textContent = tr('choosePhoto');
  formMode.textContent = tr('startMode');
  activeCaseLabel.hidden = true;
  document.getElementById('submit-copy').textContent = tr('submit');
  symptoms.placeholder = tr('symptomsPlaceholder');
  symptoms.dispatchEvent(new Event('input'));
  voiceStatus.textContent = language==='ha'?tr('voiceHausaOff'):tr('voiceHint');
  clearResult();
  form.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
async function printFarmPlan(record) {
  const entries = await Promise.all(record.observations.map(async (item, index) => ({ ...item, photoUrl: await readAsDataUrl(item.photo), index })));
  const h=language==='ha';
  const cropName=h?(cropNames.ha[record.crop]||record.crop):record.crop;
  printReport.innerHTML = `<main class="print-sheet"><header><div class="print-brand">FIELDNOTE · ${h?'TSARIN AIKIN GONA':'FARM ACTION PLAN'}</div><h1>${escapeHtml(cropName)} ${h?'· rahoton gona':'field case'}</h1><p>${h?'An buɗe':'Opened'} ${escapeHtml(formatDate(record.createdAt))}${record.location ? ` · ${escapeHtml(record.location)}` : ''} · ${entries.length} ${entries.length === 1 ? tr('visit') : tr('visits')}</p></header>${entries.map((item) => `<section class="print-entry"><h2>${h?'Ziyara':'Visit'} ${item.index + 1} · ${escapeHtml(formatDate(item.date))}</h2><img src="${item.photoUrl}" alt="${h?'Hoton shuka':'Crop photo'} ${item.index + 1}"><p><b>${h?'Bayanin manomi':'Farmer note'}:</b> ${escapeHtml(item.symptoms)}</p><p><b>${h?'Matakin girma':'Growth stage'}:</b> ${escapeHtml(item.stage || (h?'Ba a rubuta ba':'Not recorded'))}</p><h3>${h?'Abin da AI ta lura':'AI-assisted observations'}</h3><p>${escapeHtml(item.assessment.visual_observations)}</p><p><b>${h?'Abubuwan da ka iya haddasawa':'Possible explanations'}:</b> ${escapeHtml(item.assessment.possible_causes.map((cause) => `${cause.name} (${cause.likelihood})`).join('; ') || tr('noCauses'))}</p><p><b>${h?'Abin yi yanzu':'What to do now'}:</b> ${escapeHtml(item.assessment.next_steps.join(' · '))}</p><p><b>${h?'Gaggawa da alamomin lura':'Urgency and warning signs'}:</b> ${escapeHtml(item.assessment.urgency || item.assessment.escalation || '')}</p></section>`).join('')}<footer>${h?'Tsarin aikin gona ne da AI ta samar. Shawarar na iya yin kuskure; ka sake duba gonar bayan mataki kuma ka bi umarnin lakabin maganin gona.':'AI-generated field plan. Advice can be uncertain; recheck the field after acting and follow locally registered product labels.'}</footer></main>`;
  document.body.classList.add('printing-case');
  window.print();
  document.body.classList.remove('printing-case');
  printReport.innerHTML = '';
}
function setLoading(isLoading) {
  visitBusy = isLoading;
  submitButton.disabled = isLoading;
  document.querySelectorAll('#save-local, #photo, #new-case-button, [data-language], #casebook-list button, #retry-saved, #answer-voice, #update-advice').forEach((button) => { button.disabled = isLoading; });
  const answer = clarificationPanel.querySelector('#clarification-answer');
  if (answer) answer.readOnly = isLoading;
  if (language === 'ha') { const voice = clarificationPanel.querySelector('#answer-voice'); if (voice) voice.disabled = true; }
  document.getElementById('submit-copy').textContent = isLoading ? (activeCaseId ? tr('followLoading') : tr('firstLoading')) : (activeCaseId ? tr('comparing') : tr('submit'));
  loadingState.hidden = !isLoading;
  if (isLoading) { emptyState.hidden = true; errorState.hidden = true; }
}
function clearResult() {
  cancelRecording();
  if (savedPreviewUrl) URL.revokeObjectURL(savedPreviewUrl);
  savedPreviewUrl = null;
  displayedCase = null;
  displayedVisit = null;
  clarificationPanel.hidden = true;
  document.querySelector('#case-action-panel').hidden = true;
  errorState.hidden = true; analysisResult.hidden = true; emptyState.hidden = false;
}
function localizeError(message) {
  if(language!=='ha') return message;
  if(message.includes('MODEL_API_KEY is not set')) return 'Ba a saka MODEL_API_KEY a muhallin sabar ba tukuna.';
  if(message.includes('API rejected the key')) return 'Meta ta ƙi amincewa da maɓallin API. Duba maɓallinka da damar asusunka.';
  if(message.includes('Could not reach')) return 'Ba a iya haɗuwa da sabis ɗin Meta ba. Duba intanet ka sake gwadawa.';
  if(message.includes('Choose a JPG')||message.includes('Choose an image smaller')) return 'Zaɓi hoton JPG, PNG ko WebP wanda bai wuce 8 MB ba.';
  if(message.includes('Describe the change')) return 'Bayyana abin da ya canza da kalmomi kaɗan.';
  if(message.includes('Choose a crop')) return tr('errorCrop');
  if(message.includes('analysis failed')||message.includes('assessment could not')) return 'Ba a kammala tantancewar ba. Ka sake gwadawa.';
  return message;
}
function showError(message) { loadingState.hidden = true; emptyState.hidden = true; errorState.textContent = localizeError(message); errorState.hidden = false; }
function safeText(value) { return String(value ?? ''); }
function list(items) { if (!Array.isArray(items) || !items.length) return `<p>${tr('noChecks')}</p>`; return `<ul>${items.map((item) => `<li>${escapeHtml(safeText(item))}</li>`).join('')}</ul>`; }
function escapeHtml(value) { return value.replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function renderAssessment(a, isFollowup = false) {
  const causes = Array.isArray(a.possible_causes) ? a.possible_causes : [];
  analysisResult.innerHTML = `<h3>${isFollowup?tr('change'):tr('observation')}</h3><p>${escapeHtml(safeText(a.visual_observations))}</p><h3>${tr('causes')}</h3>${causes.length ? causes.map((cause) => {const level=({low:tr('low'),moderate:tr('moderate'),high:tr('high')})[String(cause.likelihood||'').toLowerCase()]||tr('uncertain');return `<article class="finding"><div class="finding-head"><strong>${escapeHtml(safeText(cause.name))}</strong><span class="badge">${escapeHtml(level)} ${tr('likelihood')}</span></div><p>${escapeHtml(safeText(cause.evidence))}</p>${cause.what_to_check ? `<p><b>${tr('checks')}</b> ${escapeHtml(safeText(cause.what_to_check))}</p>` : ''}</article>`;}).join('') : `<p>${tr('noCauses')}</p>`}<h3>${tr('next')}</h3>${list(a.next_steps)}<h3>${tr('urgency')}</h3><p>${escapeHtml(safeText(a.urgency || a.escalation))}</p><p class="disclaimer">${tr('disclaimerResult')}</p>`;
  loadingState.hidden = true; emptyState.hidden = true; errorState.hidden = true; analysisResult.hidden = false;
}


function showSavedAdvice(record, index, bringIntoView = true) {
  const visit = record.observations[index];
  if (!visit) return;
  cancelRecording();
  displayedCase = record;
  displayedVisit = index;
  renderSavedAdvice();
  analysisResult.scrollTop = 0;
  if (bringIntoView) {
    const panel = document.querySelector('#result-card');
    panel.focus({ preventScroll: true });
    panel.scrollIntoView({ behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
  }
}

function renderSavedAdvice() {
  const visit = displayedCase?.observations[displayedVisit];
  if (!visit) return;
  renderCaseActions();
  if (savedPreviewUrl) URL.revokeObjectURL(savedPreviewUrl);
  savedPreviewUrl = null;
  if (!visit.assessment) {
    analysisResult.innerHTML = `<h3>${escapeHtml(analysisStatus(visit))}</h3>
      ${visit.analysis?.state === 'pending' && visit.analysis.message ? `<p>${escapeHtml(visit.analysis.message)}</p>` : ''}
      <p>${escapeHtml(displayedCase.crop)} · ${escapeHtml(formatDate(visit.date))}</p>
      <p>${escapeHtml(visit.stage || '')} ${escapeHtml(visit.location ?? displayedCase.location ?? '')}</p>
      <p>${escapeHtml(visit.symptoms)}</p><img id="saved-photo" class="preview" alt="">
      <p>${language === 'ha' ? 'Sake gwadawa zai aika hoton da bayanan da aka ajiye don tantancewa.' : 'Retry sends this saved visit’s photo and details for analysis. A comparison also sends the previous visit’s photo.'}</p>
      <button type="button" id="retry-saved" class="new-case-button">${language === 'ha' ? 'Sake neman tantancewa' : 'Retry analysis'}</button>`;
    if (visit.photo) { savedPreviewUrl = URL.createObjectURL(visit.photo); document.querySelector('#saved-photo').src = savedPreviewUrl; }
    document.querySelector('#retry-saved').onclick = () => retryWebAnalysis(displayedCase.id, displayedVisit);
    clarificationPanel.hidden = true;
    emptyState.hidden = true; loadingState.hidden = true; errorState.hidden = true; analysisResult.hidden = false;
    return;
  }
  renderAssessment(visit.assessment, displayedVisit > 0 && !(visit.clarifications || []).some((turn) => turn.assessment));
  renderClarification();
}

function renderClarification() {
  const visit = displayedCase?.observations[displayedVisit];
  if (!visit) { clarificationPanel.hidden = true; return; }
  const question = safeText(visit.assessment?.follow_up_question).trim();
  const turns = visit.clarifications || [];
  const draft = visit.clarificationDraft?.question === question ? safeText(visit.clarificationDraft.answer) : '';
  clarificationPanel.innerHTML = `
    <p class="clarification-visit">${escapeHtml(tr('visit'))} ${displayedVisit + 1} · ${escapeHtml(formatDate(visit.date))}</p>
    ${turns.length ? `<h3>${escapeHtml(tr('clarificationHistory'))}</h3><ol class="clarification-history">${turns.map((turn) => `<li>
      <time>${escapeHtml(formatDate(turn.date))}</time><p class="clarification-question">${escapeHtml(safeText(turn.question))}</p>
      <p class="clarification-answer">${escapeHtml(safeText(turn.answer))}</p>
      ${turn.assessment ? `<details><summary>${escapeHtml(tr('savedRevision'))}</summary><p>${escapeHtml(safeText(turn.assessment.visual_observations))}</p>${list(turn.assessment.next_steps)}<p>${escapeHtml(safeText(turn.assessment.urgency))}</p></details>` : `<p>${escapeHtml(tr('pendingAnswer'))}</p>`}
    </li>`).join('')}</ol>` : ''}
    ${question ? `<form id="clarification-form" class="clarification-form">
      <p id="clarification-question" class="clarification-question"><b>${escapeHtml(tr('followQuestion'))}</b> ${escapeHtml(question)}</p>
      <label class="field-label" for="clarification-answer">${escapeHtml(tr('answerLabel'))}</label>
      <textarea id="clarification-answer" rows="3" maxlength="1200" required aria-describedby="clarification-question clarification-status" placeholder="${escapeHtml(tr('answerPlaceholder'))}">${escapeHtml(safeText(draft))}</textarea>
      <div class="clarification-tools"><button id="answer-voice" class="voice-button" type="button" aria-pressed="false" ${language === 'ha' ? 'disabled' : ''}><span aria-hidden="true">●</span> <span>${escapeHtml(tr(language === 'ha' ? 'voiceButtonHausa' : 'voiceButton'))}</span></button><span id="answer-count">${draft.length} / 1200</span></div>
      <p id="answer-voice-status" class="voice-status" role="status">${escapeHtml(tr(language === 'ha' ? 'voiceHausaOff' : 'voiceHint'))}</p>
      <p class="privacy-note">${escapeHtml(tr('refinePrivacy'))}</p>
      <button id="update-advice" class="submit-button" type="submit"><span>${escapeHtml(tr('updateAdvice'))}</span><span aria-hidden="true">↗</span></button>
    </form>` : ''}
    <p id="clarification-status" class="clarification-status" role="status">${draftSaveError ? escapeHtml(tr('draftFailed')) : ''}</p>`;
  clarificationPanel.hidden = false;
  clarificationPanel.setAttribute('aria-label', tr('clarificationHistory'));
  const field = clarificationPanel.querySelector('#clarification-answer');
  if (field) {
    field.addEventListener('input', () => {
      visit.clarificationDraft = { question, answer: field.value };
      clarificationPanel.querySelector('#answer-count').textContent = field.value.length + ' / 1200';
      queueDraftSave(displayedCase.id, displayedVisit, question, field.value);
    });
    clarificationPanel.querySelector('#answer-voice').addEventListener('click', () => startRecording(field, clarificationPanel.querySelector('#answer-voice'), clarificationPanel.querySelector('#answer-voice-status')));
    clarificationPanel.querySelector('#clarification-form').addEventListener('submit', updateAdvice);
  }
}

function clarificationStatus(message, failed = false) {
  const element = clarificationPanel.querySelector('#clarification-status');
  if (element) { element.textContent = message; element.classList.toggle('is-error', failed); }
}

function queueDraftSave(caseId, index, question, answer) {
  // Serialize read-modify-write operations so earlier keystrokes cannot overwrite newer drafts.
  draftWrites = draftWrites.then(async () => {
    const record = await getCase(caseId);
    const visit = record?.observations[index];
    if (!visit || safeText(visit.assessment?.follow_up_question).trim() !== question) throw new Error(tr('draftFailed'));
    visit.clarificationDraft = { question, answer };
    await putCase(record);
    draftSaveError = null;
    if (displayedCase?.id === caseId && displayedVisit === index && !refineBusy) clarificationStatus(tr('draftSaved'));
  }).catch(() => {
    draftSaveError = true;
    if (displayedCase?.id === caseId && displayedVisit === index) clarificationStatus(tr('draftFailed'), true);
  });
  return draftWrites;
}

function setRefineBusy(value) {
  refineBusy = value;
  document.querySelector('#save-local').disabled = value;
  submitButton.disabled = value;
  photoInput.disabled = value;
  newCaseButton.disabled = value;
  document.querySelectorAll('[data-language], #casebook-list button').forEach((button) => { button.disabled = value; });
  const field = clarificationPanel.querySelector('#clarification-answer');
  if (field) field.readOnly = value;
  const update = clarificationPanel.querySelector('#update-advice');
  if (update) { update.disabled = value; update.querySelector('span').textContent = tr(value ? 'updatingAdvice' : 'updateAdvice'); }
  const voice = clarificationPanel.querySelector('#answer-voice');
  if (voice) voice.disabled = value || language === 'ha';
}

function validRevisedAssessment(value) {
  return value && ['visual_observations', 'urgency', 'follow_up_question'].every((key) => typeof value[key] === 'string')
    && Array.isArray(value.next_steps) && value.next_steps.every((item) => typeof item === 'string')
    && Array.isArray(value.possible_causes) && value.possible_causes.every((item) => item && typeof item.name === 'string' && typeof item.likelihood === 'string');
}

async function updateAdvice(event) {
  event.preventDefault();
  if (refineBusy || visitBusy || caseActionBusy || !displayedCase) return;
  const field = clarificationPanel.querySelector('#clarification-answer');
  const answer = field.value.trim();
  if (!answer) { clarificationStatus(tr('answerRequired'), true); field.focus(); return; }
  const caseId = displayedCase.id;
  const index = displayedVisit;
  const question = safeText(displayedCase.observations[index].assessment.follow_up_question).trim();
  cancelRecording();
  setRefineBusy(true);
  clarificationStatus(tr('updatingAdvice'));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 100000);
  try {
    await queueDraftSave(caseId, index, question, field.value);
    if (draftSaveError) throw new Error(tr('draftFailed'));
    const record = await getCase(caseId);
    const visit = record?.observations[index];
    if (!visit || safeText(visit.assessment?.follow_up_question).trim() !== question) throw new Error(tr('refineFailed'));
    const turns = visit.clarifications || [];
    const pending = turns.find((turn) => !turn.assessment && turn.question === question);
    const turn = { id: pending?.id || crypto.randomUUID(), date: new Date().toISOString(), question, answer, previousAssessment: visit.assessment };
    visit.clarifications = [...turns.filter((item) => item.id !== pending?.id), turn];
    await putCase(record);
    const response = await fetch('/api/refine', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal,
      body: JSON.stringify({
        image_data_url: await readAsDataUrl(visit.photo), crop: record.crop, symptoms: visit.symptoms,
        stage: visit.stage || '', location: visit.location ?? record.location ?? '', previous_assessment: visit.assessment,
        question, answer, language,
        history: turns.filter((item) => item.assessment).slice(-20).map((item) => ({ question: item.question, answer: item.answer })),
      }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail || tr('refineFailed'));
    if (!validRevisedAssessment(body.assessment)) throw new Error(tr('invalidAdvice'));
    // Merge into the latest stored case, preserving any other visits added meanwhile.
    const updated = await getCase(caseId);
    const currentVisit = updated?.observations[index];
    if (!currentVisit || !currentVisit.clarifications?.some((item) => item.id === turn.id && !item.assessment)) throw new Error(tr('refineFailed'));
    currentVisit.assessment = body.assessment;
    currentVisit.clarifications = currentVisit.clarifications.map((item) => item.id === turn.id ? { ...turn, assessment: body.assessment } : item);
    delete currentVisit.clarificationDraft;
    updated.updatedAt = new Date().toISOString();
    await putCase(updated);
    if (activeCaseId === updated.id) activeCaseRecord = updated;
    showSavedAdvice(updated, index);
    clarificationStatus(tr('refineSuccess'));
    await renderCasebook();
  } catch (error) {
    // Never replace/hide the existing advice or the editable draft on failure.
    clarificationStatus(tr('refineFailed') + (error.name === 'AbortError' ? '' : ' ' + localizeError(error.message)), true);
  } finally {
    clearTimeout(timeout);
    setRefineBusy(false);
  }
}
