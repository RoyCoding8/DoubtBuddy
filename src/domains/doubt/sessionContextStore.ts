import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../../storage/keys';
import { SubjectId } from '../../types/syllabus';
import { StudySession, StudySessionTurn } from './types';

export const STUDY_SESSION_TURN_LIMIT = 8;

export interface StudySessionScope {
  subjectId: SubjectId;
  chapterId: string;
  topic?: string;
}

const normalizeTopic = (topic?: string): string => (topic ?? '').trim().toLowerCase();

export const buildStudySessionKey = (scope: StudySessionScope): string =>
  `${scope.subjectId}::${scope.chapterId}::${normalizeTopic(scope.topic) || 'general'}`;

const parseSessions = (raw: string | null): StudySession[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as StudySession[];
    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.map((session) => ({
      ...session,
      turnLimit: STUDY_SESSION_TURN_LIMIT,
      turns: Array.isArray(session.turns) ? session.turns.slice(-STUDY_SESSION_TURN_LIMIT) : [],
    }));
  } catch {
    return [];
  }
};

const saveSessions = async (sessions: readonly StudySession[]): Promise<void> => {
  await AsyncStorage.setItem(STORAGE_KEYS.studySessionsV2, JSON.stringify(sessions));
};

const upsertSession = (sessions: readonly StudySession[], next: StudySession): StudySession[] => {
  const key = buildStudySessionKey(next);
  const withoutCurrent = sessions.filter((session) => buildStudySessionKey(session) !== key);
  return [next, ...withoutCurrent];
};

const toSessionId = (scope: StudySessionScope): string =>
  `study-session:${scope.subjectId}:${scope.chapterId}:${normalizeTopic(scope.topic) || 'general'}`;

export const loadStudySessions = async (): Promise<StudySession[]> => {
  const raw = await AsyncStorage.getItem(STORAGE_KEYS.studySessionsV2);
  return parseSessions(raw);
};

export const appendStudySessionExchange = async (input: {
  scope: StudySessionScope;
  userText: string;
  assistantText: string;
  sourceModel?: string;
  createdAt?: string;
}): Promise<StudySession> => {
  const { scope, userText, assistantText, sourceModel } = input;
  const createdAt = input.createdAt ?? new Date().toISOString();
  const sessions = await loadStudySessions();
  const key = buildStudySessionKey(scope);

  const existing = sessions.find((session) => buildStudySessionKey(session) === key);

  const mergedTurns: StudySessionTurn[] = [
    ...(existing?.turns ?? []),
    {
      role: 'user',
      text: userText,
      createdAt,
    } as StudySessionTurn,
    {
      role: 'assistant',
      text: assistantText,
      createdAt,
      sourceModel,
    } as StudySessionTurn,
  ];

  const nextTurns: StudySessionTurn[] = mergedTurns.slice(-STUDY_SESSION_TURN_LIMIT);

  const nextSession: StudySession = {
    id: existing?.id ?? toSessionId(scope),
    subjectId: scope.subjectId,
    chapterId: scope.chapterId,
    topic: scope.topic,
    turns: nextTurns,
    turnLimit: STUDY_SESSION_TURN_LIMIT,
    updatedAt: createdAt,
  };

  await saveSessions(upsertSession(sessions, nextSession));
  return nextSession;
};

export const resetStudySession = async (scope: StudySessionScope): Promise<void> => {
  const sessions = await loadStudySessions();
  const key = buildStudySessionKey(scope);
  const updated = sessions.filter((session) => buildStudySessionKey(session) !== key);
  await saveSessions(updated);
};
