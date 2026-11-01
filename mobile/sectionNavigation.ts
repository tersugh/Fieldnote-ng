export type CaseSection = 'checklist' | 'reminder' | 'advice' | 'question';

// Measure after the selected case and expanded editor have committed their layout.
// A newer request/layout invalidates older asynchronous measurements.
export function createSectionNavigation(
  defer: (callback: () => void) => void,
  measure: (section: CaseSection, ready: (y: number) => void) => void,
  scroll: (y: number) => void,
) {
  let target: CaseSection | null = null;
  let revision = 0;
  const layout = () => {
    if (!target) return;
    const section = target;
    const current = ++revision;
    defer(() => defer(() => {
      if (current !== revision || target !== section) return;
      measure(section, y => {
        if (current !== revision || target !== section || !Number.isFinite(y)) return;
        target = null;
        scroll(Math.max(0, y - 12));
      });
    }));
  };
  return {
    request(section: CaseSection) { target = section; layout(); },
    layout,
    cancel() { target = null; revision++; },
  };
}
