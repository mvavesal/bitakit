/** Sample data of the public course studio; kept outside the contribution folders. */
export const STORAGE_KEY = 'saas-foundation.public-course-sample.v1';
export const INITIAL = {
  title: 'A better first week',
  objective: 'Help new teammates feel confident, connected, and ready to begin.',
};
export const LESSONS = [
  {
    id: 'welcome',
    title: 'Start with a warm welcome',
    minutes: 4,
    body: 'A good first day starts before the first meeting. Share a simple plan, introduce a buddy, and make room for questions.',
  },
  {
    id: 'connections',
    title: 'Build the right connections',
    minutes: 6,
    body: 'Introduce the people your new teammate will work with. Explain how each person can help, and leave space for a conversation.',
  },
  {
    id: 'first-step',
    title: 'Make the first step achievable',
    minutes: 5,
    body: 'Choose one useful, manageable task for the first week. Agree on what success looks like and schedule a short check-in.',
  },
];
export type Draft = typeof INITIAL;
export function validDraft(value: unknown): value is Draft {
  if (!value || typeof value !== 'object') return false;
  const draft = value as Partial<Draft>;
  return (
    typeof draft.title === 'string' &&
    draft.title.trim().length > 0 &&
    draft.title.length <= 120 &&
    typeof draft.objective === 'string' &&
    draft.objective.trim().length > 0 &&
    draft.objective.length <= 300
  );
}
