import { useCallback, useEffect, useState } from 'react';

import { addHistoryRecord, loadHistory, updateBookmark } from '../services/historyStorage';
import { DoubtRecord } from '../types/doubt';

export const useHistory = () => {
  const [records, setRecords] = useState<DoubtRecord[]>([]);
  const [loading, setLoading] = useState(true);

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

  const toggleBookmark = useCallback(
    async (id: string, bookmarked: boolean) => {
      const next = await updateBookmark(id, bookmarked);
      setRecords(next);
    },
    [],
  );

  return {
    loading,
    records,
    refresh,
    addRecord,
    toggleBookmark,
  };
};
