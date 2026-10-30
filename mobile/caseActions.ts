export type Checklist = { savedAt: string; items: { text: string; state: 'todo' | 'done' | 'skipped'; note: string }[] };

export function makeChecklist(steps: string[], now = new Date().toISOString()): Checklist {
  return { savedAt: now, items: steps.map(text => ({ text, state: 'todo', note: '' })) };
}

export function updateChecklist(saved: Checklist, progress: { state: string; note: string }[]): Checklist {
  if (saved.items.length !== progress.length) throw new Error('The checklist changed. Reopen it before saving.');
  return { ...saved, items: saved.items.map((item, index) => {
    const change = progress[index];
    if (!['todo', 'done', 'skipped'].includes(change.state) || change.note.length > 300) throw new Error('Choose a valid status and keep each note within 300 characters.');
    return { ...item, state: change.state as 'todo' | 'done' | 'skipped', note: change.note };
  }) };
}

// Parse local wall-clock input strictly, rejecting invalid dates and DST gaps.
export function parseRecheck(value: string): string {
  const parts = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})$/.exec(value);
  if (!parts) throw new Error('Enter a local date and time as YYYY-MM-DD HH:mm.');
  const [year, month, day, hour, minute] = parts.slice(1).map(Number);
  const date = new Date(year, month - 1, day, hour, minute);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day || date.getHours() !== hour || date.getMinutes() !== minute) throw new Error('Enter a valid local date and time.');
  return date.toISOString();
}

export function localRecheck(value?: string | null): string {
  if (!value) return '';
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return '';
  const pad = (number: number) => String(number).padStart(2, '0');
  return date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate()) + 'T' + pad(date.getHours()) + ':' + pad(date.getMinutes());
}

export function recheckDue(value?: string | null, now = Date.now()): boolean {
  return !!value && Number.isFinite(Date.parse(value)) && Date.parse(value) <= now;
}
