import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  appendStudySessionExchange,
  loadStudySessions,
  resetStudySession,
  StudySessionScope,
  STUDY_SESSION_TURN_LIMIT,
} from '../domains/doubt/sessionContextStore';
import { StudySession } from '../domains/doubt/types';

interface StudySessionContextValue {
  loading: boolean;
  sessions: StudySession[];
  turnLimit: number;
  refresh: () => Promise<void>;
  getSessionContext: (scope: StudySessionScope) => Array<{ role: 'user' | 'assistant'; text: string; sourceModel?: string }>;
  appendExchange: (input: {
    scope: StudySessionScope;
    userText: string;
    assistantText: string;
    sourceModel?: string;
    createdAt?: string;
  }) => Promise<void>;
  resetSession: (scope: StudySessionScope) => Promise<void>;
}

const StudySessionContext = createContext<StudySessionContextValue | null>(null);

const normalizeTopic = (topic?: string): string => (topic ?? '').trim().toLowerCase();

const matchScope = (session: StudySession, scope: StudySessionScope): boolean =>
  session.subjectId === scope.subjectId &&
  session.chapterId === scope.chapterId &&
  normalizeTopic(session.topic) === normalizeTopic(scope.topic);

export const StudySessionProvider = ({ children }: PropsWithChildren) => {
  const [loading, setLoading] = useState(false);
  const [sessions, setSessions] = useState<StudySession[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await loadStudySessions();
    setSessions(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const getSessionContext = useCallback(
    (scope: StudySessionScope): Array<{ role: 'user' | 'assistant'; text: string; sourceModel?: string }> => {
      const match = sessions.find((session) => matchScope(session, scope));
      if (!match) {
        return [];
      }

      return match.turns.slice(-STUDY_SESSION_TURN_LIMIT).map((turn) => ({
        role: turn.role,
        text: turn.text,
        sourceModel: turn.sourceModel,
      }));
    },
    [sessions],
  );

  const appendExchange = useCallback(
    async (input: {
      scope: StudySessionScope;
      userText: string;
      assistantText: string;
      sourceModel?: string;
      createdAt?: string;
    }) => {
      const next = await appendStudySessionExchange(input);
      setSessions((current) => {
        const filtered = current.filter((session) => !matchScope(session, input.scope));
        return [next, ...filtered];
      });
    },
    [],
  );

  const resetSessionForScope = useCallback(async (scope: StudySessionScope) => {
    await resetStudySession(scope);
    setSessions((current) => current.filter((session) => !matchScope(session, scope)));
  }, []);

  const value = useMemo(
    () => ({
      loading,
      sessions,
      turnLimit: STUDY_SESSION_TURN_LIMIT,
      refresh,
      getSessionContext,
      appendExchange,
      resetSession: resetSessionForScope,
    }),
    [appendExchange, getSessionContext, loading, refresh, resetSessionForScope, sessions],
  );

  return <StudySessionContext.Provider value={value}>{children}</StudySessionContext.Provider>;
};

export const useStudySession = (): StudySessionContextValue => {
  const context = useContext(StudySessionContext);
  if (!context) {
    throw new Error('useStudySession must be used within StudySessionProvider');
  }

  return context;
};
