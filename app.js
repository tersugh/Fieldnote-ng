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
const formMode = document.querySelector('#form-mode');
const activeCaseLabel = document.querySelector('#active-case-label');
const casebookList = document.querySelector('#casebook-list');
const newCaseButton = document.querySelector('#new-case-button');
const printReport = document.querySelector('#print-report');
const MAX_BYTES = 8 * 1024 * 1024;
const MAX_RECORDING_SECONDS = 30;
let activeCaseId = null;
let activeCaseRecord = null;
let language = localStorage.getItem('fieldnote-language') === 'ha' ? 'ha' : 'en';

const copy = {
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
    activeCase: (crop, count) => `${crop} · ${count} previous ${count === 1 ? 'visit' : 'visits'}`,
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
  renderCasebook();
}

document.querySelectorAll('[data-language]').forEach((button)=>button.addEventListener('click',()=>{
  if(button.dataset.language==='ha' && recorder?.state==='recording') recorder.stop();
  applyLanguage(button.dataset.language);
}));
applyLanguage(language);
let recorder;
let recordingStream;
let recordingChunks = [];
let recordingTimer;

symptoms.addEventListener('input', () => { charCount.textContent = `${symptoms.value.length} / 1200`; });

  voiceButton.addEventListener('click', async () => {
  if (recorder?.state === 'recording') {
    recorder.stop();
    return;
  }
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
    voiceStatus.textContent = tr('voiceUnsupported');
    return;
  }
  try {
    recordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recordingChunks = [];
    recorder = new MediaRecorder(recordingStream);
    recorder.addEventListener('dataavailable', (event) => { if (event.data.size) recordingChunks.push(event.data); });
    recorder.addEventListener('stop', finishRecording, { once: true });
    recorder.start();
    voiceButton.classList.add('recording');
    voiceButton.setAttribute('aria-pressed', 'true');
    voiceButton.querySelector('#voice-button-copy').textContent = tr('voiceRecording');
    voiceStatus.textContent = language === 'ha' ? 'Ana rikodi…' : `Recording… ${MAX_RECORDING_SECONDS} seconds maximum.`;
    recordingTimer = window.setTimeout(() => { if (recorder?.state === 'recording') recorder.stop(); }, MAX_RECORDING_SECONDS * 1000);
  } catch {
    voiceStatus.textContent = tr('voiceDenied');
  }
});

async function finishRecording() {
  window.clearTimeout(recordingTimer);
  recordingStream?.getTracks().forEach((track) => track.stop());
  recordingStream = null;
  voiceButton.classList.remove('recording');
  if(language==='ha') { voiceButton.setAttribute('aria-pressed','false'); voiceStatus.textContent=tr('voiceHausaOff'); return; }
  voiceButton.disabled = true;
  voiceButton.setAttribute('aria-pressed', 'false');
  voiceButton.querySelector('#voice-button-copy').textContent = tr('voiceTranscribing');
  voiceStatus.textContent = tr('voiceConverting');
  try {
    const blob = new Blob(recordingChunks, { type: recorder.mimeType || 'audio/webm' });
    const wav = await convertToWav(blob);
    const audioDataUrl = await readAsDataUrl(wav);
    const response = await fetch('/api/transcribe', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ audio_data_url: audioDataUrl }),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail || 'Voice transcription failed. Please try again.');
    const priorText = symptoms.value.trim();
    symptoms.value = priorText ? `${priorText} ${body.transcript}` : body.transcript;
    symptoms.dispatchEvent(new Event('input'));
    symptoms.focus();
    voiceStatus.textContent = tr('voiceReview');
  } catch (error) {
    voiceStatus.textContent = localizeError(error.message) || tr('voiceFailed');
  } finally {
    voiceButton.disabled = false;
    voiceButton.querySelector('#voice-button-copy').textContent = language === 'ha' ? tr('voiceButtonHausa') : tr('voiceButton');
  }
}

async function convertToWav(blob) {
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  const context = new AudioContextClass();
  try {
    const decoded = await context.decodeAudioData(await blob.arrayBuffer());
    const sourceRate = decoded.sampleRate;
    const targetRate = 24000;
    const outputLength = Math.ceil(decoded.length * targetRate / sourceRate);
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

photoInput.addEventListener('change', () => {
  const file = photoInput.files?.[0];
  if (!file) return;
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > MAX_BYTES) {
    photoInput.value = '';
    preview.hidden = true;
    showError('Choose a JPG, PNG, or WebP image smaller than 8 MB.');
    return;
  }
  clearResult();
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  uploadMain.textContent = file.name;
  uploadHint.textContent = `${(file.size / (1024 * 1024)).toFixed(1)} MB · select another photo to replace`;
});

document.querySelector('#drop-zone').addEventListener('dragover', (event) => { event.preventDefault(); event.currentTarget.classList.add('dragover'); });
document.querySelector('#drop-zone').addEventListener('dragleave', (event) => { event.currentTarget.classList.remove('dragover'); });
document.querySelector('#drop-zone').addEventListener('drop', (event) => {
  event.preventDefault(); event.currentTarget.classList.remove('dragover');
  const file = event.dataTransfer.files?.[0];
  if (!file) return;
  const transfer = new DataTransfer(); transfer.items.add(file); photoInput.files = transfer.files;
  photoInput.dispatchEvent(new Event('change'));
});

form.addEventListener('submit', async (event) => {
  event.preventDefault();
  const file = photoInput.files?.[0];
  if (!file || !symptoms.value.trim() || !cropSelect.value) return;
  if (file.size > MAX_BYTES) return showError('This photo is larger than 8 MB. Choose a smaller image.');
  setLoading(true);
  try {
    const imageDataUrl = await readAsDataUrl(file);
    const crop = cropSelect.value === 'Other' ? otherCrop.value.trim() : cropSelect.value;
    const stage = document.querySelector('#stage').value;
    const location = document.querySelector('#location').value.trim();
    const currentNote = symptoms.value.trim();
    let endpoint = '/api/diagnose';
    let requestBody = { image_data_url: imageDataUrl, crop, symptoms: currentNote, stage, location, language };
    let priorCase = null;
    if (activeCaseId) {
      priorCase = await getCase(activeCaseId);
      if (!priorCase?.observations?.length) throw new Error(language==='ha'?'Ba a iya buɗe rahoton baya ba. Ka fara sabon rahoto.':'Could not load the earlier field note. Start a new incident.');
      const previous = priorCase.observations[priorCase.observations.length - 1];
      requestBody = {
        previous_image_data_url: await readAsDataUrl(previous.photo),
        image_data_url: imageDataUrl,
        crop,
        previous_note: previous.symptoms,
        symptoms: currentNote,
        stage,
        location,
        language,
      };
      endpoint = '/api/followup';
    }
    const response = await fetch(endpoint, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    const body = await response.json();
    if (!response.ok) throw new Error(body.detail || 'The assessment could not be completed. Please try again.');
    const observation = { date: new Date().toISOString(), stage, symptoms: currentNote, photo: file, assessment: body.assessment };
    const savedCase = priorCase
      ? { ...priorCase, updatedAt: observation.date, observations: [...priorCase.observations, observation] }
      : { id: crypto.randomUUID(), crop, location, createdAt: observation.date, updatedAt: observation.date, observations: [observation] };
    await putCase(savedCase);
    renderAssessment(body.assessment, Boolean(priorCase));
    await renderCasebook();
    clearPhotoInput();
    activateCase(savedCase);
  } catch (error) {
    showError(error.message || (language==='ha'?'Ba a iya tantance rahoton ba. Duba intanet ka sake gwadawa.':'Could not reach the analysis service. Check your connection and try again.'));
  } finally { setLoading(false); }
});

newCaseButton.addEventListener('click', startNewCase);
casebookList.addEventListener('click', async (event) => {
  const button = event.target.closest('button[data-action]');
  if (!button) return;
  const record = await getCase(button.dataset.caseId);
  if (!record) return;
  if (button.dataset.action === 'continue') {
    activateCase(record);
    form.scrollIntoView({ behavior: 'smooth', block: 'start' });
  } else if (button.dataset.action === 'print') {
    await printFarmPlan(record);
  } else if (button.dataset.action === 'share') {
    await shareCaseWithWorker(record);
  }
});

renderCasebook();

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
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('The local casebook could not be read or saved.'));
    transaction.oncomplete = () => db.close();
    transaction.onerror = () => { db.close(); reject(new Error('The local casebook could not be updated.')); };
  });
}
const getCase = (id) => caseStoreRequest('get', id);
const putCase = (record) => caseStoreRequest('put', record);
async function renderCasebook() {
  try {
    const records = (await caseStoreRequest('getAll')).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
    if (!records.length) {
      casebookList.innerHTML = `<p class="casebook-empty">${escapeHtml(tr('casebookEmpty'))}</p>`;
      return;
    }
    casebookList.innerHTML = records.map((record) => {
      const latest = record.observations[record.observations.length - 1];
      const excerpt = latest.symptoms.length > 115 ? `${latest.symptoms.slice(0, 112)}…` : latest.symptoms;
      const cropName = language==='ha'?(cropNames.ha[record.crop]||record.crop):record.crop;
      const shareAction = latest.assessment ? `<button type="button" data-action="share" data-case-id="${escapeHtml(record.id)}">${tr('share')}</button>` : '';
      return `<article class="case-card"><div class="case-card-top"><div><span class="case-crop">${escapeHtml(cropName)}</span><span class="case-location">${record.location ? escapeHtml(record.location) : tr('noLocation')}</span></div><span class="case-count">${record.observations.length} ${record.observations.length === 1 ? tr('visit') : tr('visits')}</span></div><p class="case-excerpt">${escapeHtml(excerpt)}</p><div class="case-card-foot"><span>${tr('updated')} ${escapeHtml(formatDate(record.updatedAt))}</span><div class="case-actions">${shareAction}<button type="button" data-action="print" data-case-id="${escapeHtml(record.id)}">${tr('print')}</button><button type="button" class="case-continue" data-action="continue" data-case-id="${escapeHtml(record.id)}">${tr('addFollowup')} ↗</button></div></div></article>`;
    }).join('');
  } catch (error) {
    casebookList.innerHTML = `<p class="casebook-empty">${escapeHtml(error.message)}</p>`;
  }
}
function formatDate(value) { return new Intl.DateTimeFormat(language==='ha'?'ha-NG':'en-NG', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value)); }
async function shareCaseWithWorker(record) {
  const latest = record.observations[record.observations.length - 1];
  const assessment = latest.assessment;
  const cropName = language === 'ha' ? (cropNames.ha[record.crop] || record.crop) : record.crop;
  const lines = language === 'ha' ? [
    `Rahoton Fieldnote: ${cropName}`,
    `Wuri: ${record.location || 'Ba a saka ba'}`,
    ...record.observations.map((item, index) => `Ziyara ${index + 1} (${formatDate(item.date)}): ${item.symptoms}`),
    ...(assessment ? [
      `Abin da AI ta lura: ${assessment.visual_observations}`,
      `Abubuwan da ka iya haddasawa: ${(assessment.possible_causes || []).map((cause) => cause.name).join(', ') || 'Ba a tabbatar ba'}`,
      `Abin yi yanzu: ${(assessment.next_steps || []).join('; ')}`,
      `Gaggawa da alamomin lura: ${assessment.urgency || assessment.escalation || ''}`,
    ] : []),
    'An samar da wannan rahoto a Fieldnote. Manomi yana neman ƙarin ra’ayi ne bisa zaɓinsa.',
  ] : [
    `Fieldnote crop case: ${cropName}`,
    `Area: ${record.location || 'Not added'}`,
    ...record.observations.map((item, index) => `Visit ${index + 1} (${formatDate(item.date)}): ${item.symptoms}`),
    ...(assessment ? [
      `AI observations: ${assessment.visual_observations}`,
      `Possible causes: ${(assessment.possible_causes || []).map((cause) => cause.name).join(', ') || 'Unclear'}`,
      `Recommended next steps: ${(assessment.next_steps || []).join('; ')}`,
      `Urgency / warning signs: ${assessment.urgency || assessment.escalation || ''}`,
    ] : []),
    'Created in Fieldnote. The farmer is sharing this summary for an optional second opinion.',
  ];
  const text = lines.join('\n');
  try {
    if (navigator.share) {
      await navigator.share({ title: `Fieldnote · ${cropName}`, text });
    } else if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      alert(language === 'ha' ? 'An kwafi taƙaitaccen rahoton. Ka manna shi a WhatsApp ko saƙo ga jami’in noma.' : 'Case summary copied. Paste it into WhatsApp or a message to the worker.');
    } else {
      await printFarmPlan(record);
    }
  } catch (error) {
    if (error?.name !== 'AbortError') alert(language === 'ha' ? 'Ba a iya raba rahoton ba. Ka buga tsarin aikin gona ka aika da kanka.' : 'Could not share the case. Print the field plan and send it yourself.');
  }
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
  clearResult();
  voiceStatus.textContent = language==='ha'?tr('voiceHausaOff'):'Add what changed since the last visit. Your transcript will be added here for review.';
}
function clearPhotoInput() {
  photoInput.value = '';
  preview.hidden = true;
  preview.removeAttribute('src');
  uploadMain.textContent = tr('newFollowup');
  uploadHint.textContent = tr('photoHint');
}
function startNewCase() {
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
function setLoading(isLoading) { submitButton.disabled = isLoading; document.getElementById('submit-copy').textContent = isLoading ? (activeCaseId ? tr('followLoading') : tr('firstLoading')) : (activeCaseId ? tr('comparing') : tr('submit')); emptyState.hidden = isLoading; errorState.hidden = true; analysisResult.hidden = true; loadingState.hidden = !isLoading; }
function clearResult() { errorState.hidden = true; analysisResult.hidden = true; emptyState.hidden = false; }
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
function showError(message) { loadingState.hidden = true; emptyState.hidden = true; analysisResult.hidden = true; errorState.textContent = localizeError(message); errorState.hidden = false; }
function safeText(value) { return String(value ?? ''); }
function list(items) { if (!Array.isArray(items) || !items.length) return `<p>${tr('noChecks')}</p>`; return `<ul>${items.map((item) => `<li>${escapeHtml(safeText(item))}</li>`).join('')}</ul>`; }
function escapeHtml(value) { return value.replace(/[&<>"']/g, (char) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char])); }
function renderAssessment(a, isFollowup = false) {
  const causes = Array.isArray(a.possible_causes) ? a.possible_causes : [];
  analysisResult.innerHTML = `<h3>${isFollowup?tr('change'):tr('observation')}</h3><p>${escapeHtml(safeText(a.visual_observations))}</p><h3>${tr('causes')}</h3>${causes.length ? causes.map((cause) => {const level=({low:tr('low'),moderate:tr('moderate'),high:tr('high')})[String(cause.likelihood||'').toLowerCase()]||tr('uncertain');return `<article class="finding"><div class="finding-head"><strong>${escapeHtml(safeText(cause.name))}</strong><span class="badge">${escapeHtml(level)} ${tr('likelihood')}</span></div><p>${escapeHtml(safeText(cause.evidence))}</p>${cause.what_to_check ? `<p><b>${tr('checks')}</b> ${escapeHtml(safeText(cause.what_to_check))}</p>` : ''}</article>`;}).join('') : `<p>${tr('noCauses')}</p>`}<h3>${tr('next')}</h3>${list(a.next_steps)}<h3>${tr('urgency')}</h3><p>${escapeHtml(safeText(a.urgency || a.escalation))}</p>${a.follow_up_question ? `<div class="followup"><b>${tr('followQuestion')}</b> ${escapeHtml(safeText(a.follow_up_question))}</div>` : ''}<p class="disclaimer">${tr('disclaimerResult')}</p>`;
  loadingState.hidden = true; emptyState.hidden = true; errorState.hidden = true; analysisResult.hidden = false;
}
