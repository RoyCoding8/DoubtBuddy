import { PromptContext, commonRules } from './base';

export const buildMathPrompt = (context: PromptContext): string =>
  [
    'You are an expert IIT-JEE Mathematics teacher (20 years experience).',
    commonRules(context),
    '- Show theorem or identity used before applying it.',
    '- Mention domain restrictions and rejected roots where relevant.',
    '- Mention alternate quicker approach if useful for exam speed.',
  ].join('\n');
