import AsyncStorage from '@react-native-async-storage/async-storage';

import {
  appendStudySessionExchange,
  buildStudySessionKey,
  loadStudySessions,
  resetStudySession,
  STUDY_SESSION_TURN_LIMIT,
} from './sessionContextStore';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const installMemoryStorage = (): Map<string, string> => {
  const memoryStore = new Map<string, string>();

  const storage = AsyncStorage as unknown as {
    getItem: (key: string) => Promise<string | null>;
    setItem: (key: string, value: string) => Promise<void>;
  };

  storage.getItem = async (key: string): Promise<string | null> => memoryStore.get(key) ?? null;
  storage.setItem = async (key: string, value: string): Promise<void> => {
    memoryStore.set(key, value);
  };

  return memoryStore;
};

const runTrimToEightTurns = async (): Promise<void> => {
  installMemoryStorage();

  const scope = {
    subjectId: 'physics' as const,
    chapterId: 'kinematics',
    topic: 'projectile motion',
  };

  for (let index = 1; index <= 5; index += 1) {
    await appendStudySessionExchange({
      scope,
      userText: `Q${index}`,
      assistantText: `A${index}`,
      createdAt: new Date(1700000000000 + index).toISOString(),
    });
  }

  const sessions = await loadStudySessions();
  const key = buildStudySessionKey(scope);
  const session = sessions.find((entry) => buildStudySessionKey(entry) === key);

  assert(Boolean(session), 'session should exist for scope');
  assert(session!.turns.length === STUDY_SESSION_TURN_LIMIT, 'session must trim to exactly 8 turns');

  const turnTexts = session!.turns.map((turn) => turn.text);
  assert(turnTexts[0] === 'Q2', 'trim should drop oldest user turn first');
  assert(turnTexts[turnTexts.length - 1] === 'A5', 'latest assistant turn should be retained');
};

const runResetClearsScopedSession = async (): Promise<void> => {
  installMemoryStorage();

  const scope = {
    subjectId: 'chemistry' as const,
    chapterId: 'mole-concept',
    topic: 'stoichiometry',
  };

  await appendStudySessionExchange({
    scope,
    userText: 'first question',
    assistantText: 'first answer',
  });

  await resetStudySession(scope);

  const sessions = await loadStudySessions();
  const key = buildStudySessionKey(scope);
  const session = sessions.find((entry) => buildStudySessionKey(entry) === key);
  assert(!session, 'reset should remove scoped session');
};

export const runSessionContextStoreUnitTests = async (): Promise<void> => {
  await runTrimToEightTurns();
  await runResetClearsScopedSession();
};
