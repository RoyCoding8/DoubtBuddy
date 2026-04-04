import { SolveMode } from '../types/doubt';

export interface PromptContext {
  chapter: string;
  topic?: string;
  difficultyLevel: string;
  mode: SolveMode;
}

export const modeInstructions: Record<SolveMode, string> = {
  step_by_step: 'Give full step-by-step derivation with no skipped steps.',
  hint_only: 'Do not provide full solution; provide graded hints only.',
  explain_concept: 'Focus on concept intuition and when to apply formulas.',
  quick_answer: 'Give concise approach and final answer quickly.',
};

export const difficultyInstruction = (difficultyLevel: string): string => {
  if (difficultyLevel === 'hard') {
    return 'Target IIT-JEE Advanced level rigor.';
  }

  if (difficultyLevel === 'easy') {
    return 'Target JEE Main foundation level with simpler wording.';
  }

  return 'Target balanced JEE Main + Advanced preparation level.';
};

export const commonRules = (context: PromptContext): string =>
  [
    `Student is studying ${context.chapter}${context.topic ? ` / ${context.topic}` : ''}.`,
    'Rules:',
    '- Return markdown only; do not include meta intros like "Here is the explanation"',
    '- Step-by-step solution, no skipped steps unless mode says otherwise',
    '- For numerical problems use concise sections: Given, Steps, Final Answer, Key Concept',
    '- For concept-only doubts, explain directly in concise bullets without forced template sections',
    '- Standard notation and units where applicable',
    '- Use LaTeX only for necessary formulas; keep non-math text plain and concise',
    '- Prefer simple supported LaTeX macros and avoid deeply nested environments',
    '- LaTeX format: $...$ inline and $$...$$ display',
    '- Describe diagram logic if relevant',
    '- If unsure, say "unsure" and explain what is missing',
    '- Never invent constants, formulas, or question values',
    '- If question statement is incomplete, ask one precise clarification question',
    '- Keep explanation concise but complete for exam revision',
    '- End with a short Key Concept section (2-4 lines)',
    '- Box final numerical answer where applicable',
    '- Use simple student-friendly language',
    `- Solve mode instruction: ${modeInstructions[context.mode]}`,
    `- Difficulty instruction: ${difficultyInstruction(context.difficultyLevel)}`,
  ].join('\n');
