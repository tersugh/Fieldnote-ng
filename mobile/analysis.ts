export type AnalysisState = { state: 'pending' | 'error' | 'complete'; kind?: 'saved' | 'connection' | 'input' | 'model' | 'configuration'; message?: string };
export type AnalysisAssessment = {
  visual_observations: string;
  possible_causes: { name: string; likelihood: string; evidence?: string; what_to_check?: string }[];
  next_steps: string[]; urgency: string; escalation?: string; follow_up_question?: string;
};
type Visit = { id: string; symptoms: string; stage: string; location?: string; assessment?: AnalysisAssessment; analysis?: AnalysisState };
type SavedCase<V extends Visit> = { id: string; crop: string; location: string; updatedAt: string; observations: V[] };

export function createOperationGate() {
  let running = false;
  return {
    async run<T>(operation: () => Promise<T>): Promise<T | undefined> {
      if (running) return;
      running = true;
      try { return await operation(); } finally { running = false; }
    },
  };
}

class AnalysisError extends Error {
  constructor(public kind: NonNullable<AnalysisState['kind']>, message: string) { super(message); }
}

export function analysisStatus(visit: Visit, language: 'en' | 'ha'): string {
  if (visit.assessment) return language === 'ha' ? 'An kammala tantancewa' : 'Analysis complete';
  if (visit.analysis?.state === 'error') {
    const prefix = visit.analysis.kind === 'input'
      ? (language === 'ha' ? 'Bayanan na buƙatar gyara: ' : 'Input needs correction: ')
      : (language === 'ha' ? 'Tantancewa na buƙatar kulawa: ' : 'Analysis needs attention: ');
    return prefix + (visit.analysis.message || '');
  }
  return (language === 'ha' ? 'Ana jiran tantancewa. An ajiye hoto da bayanai. Babu aikawa ta atomatik.' : 'Pending analysis. Photo and details saved. Nothing is sent automatically.')
    + (visit.analysis?.message ? ' ' + visit.analysis.message : '');
}

export async function analyzeSavedVisit<V extends Visit, C extends SavedCase<V>>(
  caseId: string, visitId: string, language: 'en' | 'ha', baseUrl: string,
  io: { load: (id: string) => Promise<C>; save: (record: C) => Promise<void>; photo: (visit: V) => Promise<string>; request: typeof fetch },
): Promise<C> {
  const record = await io.load(caseId);
  const index = record.observations.findIndex(visit => visit.id === visitId);
  const target = record.observations[index];
  if (!target) throw new Error('The saved visit could not be found.');
  if (target.assessment) return record;
  let result: { analysis: AnalysisState; assessment?: AnalysisAssessment };
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 100000);
  try {
    if (!baseUrl) throw new AnalysisError('configuration', 'The analysis server is not configured. Your saved note is intact.');
    const previous = index > 0 ? record.observations[index - 1] : undefined;
    let image: string, previousImage: string | undefined;
    try {
      image = await io.photo(target);
      if (previous) previousImage = await io.photo(previous);
    } catch { throw new AnalysisError('input', 'The saved photo could not be read. Add a corrected visit with a readable photo.'); }
    const payload = { crop: record.crop, symptoms: target.symptoms, stage: target.stage,
      location: target.location ?? record.location, language, image_data_url: image,
      ...(previous ? { previous_image_data_url: previousImage, previous_note: previous.symptoms } : {}) };
    let response: Response;
    try {
      response = await io.request(baseUrl + (previous ? '/api/followup' : '/api/diagnose'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: controller.signal,
      });
    } catch { throw new AnalysisError('connection', 'No response received (connection, timeout, or blocked request). Retry when ready.'); }
    let body;
    try { body = await response.json(); }
    catch (error) {
      if (error && typeof error === 'object' && 'name' in error && (error.name === 'AbortError' || error.name === 'TypeError')) throw new AnalysisError('connection', 'The response was interrupted. Your saved note is intact; retry when ready.');
      throw new AnalysisError('model', 'The service returned an unreadable response. The saved note is intact.');
    }
    if (!response.ok) throw new AnalysisError(response.status === 400 || response.status === 422 ? 'input' : 'model',
      typeof body.detail === 'string' ? body.detail : 'The service could not produce advice.');
    const a: AnalysisAssessment = body.assessment;
    if (!a || typeof a.visual_observations !== 'string' || typeof a.urgency !== 'string'
      || !Array.isArray(a.next_steps) || !a.next_steps.every(step => typeof step === 'string')
      || !Array.isArray(a.possible_causes) || !a.possible_causes.every(cause => cause && typeof cause.name === 'string' && typeof cause.likelihood === 'string')
      || (a.follow_up_question !== undefined && typeof a.follow_up_question !== 'string')) {
      throw new AnalysisError('model', 'The service returned incomplete advice. The saved note is intact.');
    }
    result = { assessment: a, analysis: { state: 'complete' } };
  } catch (error) {
    const kind = error instanceof AnalysisError ? error.kind : 'model';
    result = { analysis: { state: kind === 'connection' ? 'pending' : 'error', kind,
      message: error instanceof Error ? error.message : 'Analysis failed.' } };
  } finally { clearTimeout(timeout); }
  // Re-read before writing so existing clarification and visit history stays intact.
  const latest = await io.load(caseId);
  const current = latest.observations.find(visit => visit.id === visitId);
  if (!current) throw new Error('The saved visit changed. Reopen the case before retrying.');
  if (!current.assessment) Object.assign(current, result);
  latest.updatedAt = new Date().toISOString();
  await io.save(latest);
  return latest;
}
