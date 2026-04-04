import { createContext, PropsWithChildren, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import {
  addHistoryRecord,
  clearHistoryRecords,
  deleteHistoryRecord,
  loadHistory,
  updateBookmark,
} from '../services/historyStorage';
import { DoubtRecord } from '../types/doubt';

interface DoubtHistoryContextValue {
  loading: boolean;
  records: DoubtRecord[];
  refresh: () => Promise<void>;
  addRecord: (record: DoubtRecord) => Promise<void>;
  toggleBookmark: (id: string, bookmarked: boolean) => Promise<void>;
  deleteRecord: (id: string) => Promise<void>;
  clearAllRecords: () => Promise<void>;
}

const DoubtHistoryContext = createContext<DoubtHistoryContextValue | null>(null);

export const DoubtHistoryProvider = ({ children }: PropsWithChildren) => {
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<DoubtRecord[]>([]);

  const refresh = useCallback(async () => {
    setLoading(true);
    const next = await loadHistory();
    setRecords(next);
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addRecord = useCallback(async (record: DoubtRecord) => {
    const next = await addHistoryRecord(record);
    setRecords(next);
  }, []);

  const toggleBookmark = useCallback(async (id: string, bookmarked: boolean) => {
    const next = await updateBookmark(id, bookmarked);
    setRecords(next);
  }, []);

  const deleteRecord = useCallback(async (id: string) => {
    const next = await deleteHistoryRecord(id);
    setRecords(next);
  }, []);

  const clearAllRecords = useCallback(async () => {
    const next = await clearHistoryRecords();
    setRecords(next);
  }, []);

  const value = useMemo(
    () => ({
      loading,
      records,
      refresh,
      addRecord,
      toggleBookmark,
      deleteRecord,
      clearAllRecords,
    }),
    [addRecord, clearAllRecords, deleteRecord, loading, records, refresh, toggleBookmark],
  );

  return <DoubtHistoryContext.Provider value={value}>{children}</DoubtHistoryContext.Provider>;
};

export const useDoubtHistory = (): DoubtHistoryContextValue => {
  const context = useContext(DoubtHistoryContext);
  if (!context) {
    throw new Error('useDoubtHistory must be used within DoubtHistoryProvider');
  }

  return context;
};
