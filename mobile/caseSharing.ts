type Advice = {
  visual_observations?: string;
  possible_causes?: { name: string }[];
  next_steps?: string[];
  urgency?: string;
  escalation?: string;
  follow_up_question?: string;
};
type Turn = { question?: string; answer?: string; assessment?: Advice };
type SavedCase = {
  crop?: string;
  location?: string;
  observations?: {
    date?: string; location?: string; stage?: string; symptoms?: string;
    assessment?: Advice; clarifications?: Turn[]; refinements?: Turn[];
  }[];
};

export function buildCaseSummary(record: SavedCase, language: 'en' | 'ha' = 'en'): string {
  const ha = language === 'ha';
  const label = (en: string, translated: string) => ha ? translated : en;
  const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
  const date = (value: string | undefined) => {
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
    const advice = visit.assessment!;
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

// React Native's Android Share API accepts text; local photo URLs are iOS-only.
// Keep the text independent of photo access and never claim delivery was confirmed.
export async function shareCaseSummary(
  message: string,
  share: (content: { title: string; message: string }) => Promise<unknown>,
): Promise<void> {
  await share({ title: 'Fieldnote', message });
}
