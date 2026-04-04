import { SolveModeOption } from '../types/doubt';

export const solveModeOptions: readonly SolveModeOption[] = [
  { id: 'step_by_step', label: 'Step-by-step Solution', emoji: '🔍' },
  { id: 'hint_only', label: 'Hint Only', emoji: '💡' },
  { id: 'explain_concept', label: 'Explain Concept', emoji: '📖' },
  { id: 'quick_answer', label: 'Quick Answer', emoji: '⚡' },
];
