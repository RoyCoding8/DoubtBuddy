import { SubjectId } from '../types/syllabus';

export const getSubjectLabel = (subjectId: SubjectId): string => {
  if (subjectId === 'physics') {
    return 'Physics';
  }
  if (subjectId === 'chemistry') {
    return 'Chemistry';
  }
  return 'Mathematics';
};

export const formatDateTime = (isoDate: string): string =>
  new Date(isoDate).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
