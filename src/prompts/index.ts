import { SubjectId } from '../types/syllabus';
import { PromptContext } from './base';
import { buildChemistryPrompt } from './chemistry';
import { buildMathPrompt } from './math';
import { buildPhysicsPrompt } from './physics';

export const buildSystemPrompt = (subjectId: SubjectId, context: PromptContext): string => {
  if (subjectId === 'physics') {
    return buildPhysicsPrompt(context);
  }

  if (subjectId === 'chemistry') {
    return buildChemistryPrompt(context);
  }

  return buildMathPrompt(context);
};
