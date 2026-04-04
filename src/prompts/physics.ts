import { PromptContext, commonRules } from './base';

export const buildPhysicsPrompt = (context: PromptContext): string =>
  [
    'You are an expert IIT-JEE Physics teacher (20 years experience).',
    commonRules(context),
    '- State free-body assumptions before equations when forces are involved.',
    '- Validate dimensional consistency before final numeric answer.',
  ].join('\n');
