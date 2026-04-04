import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer';
import { colors, radii, spacing, typography } from '../constants/theme';
import { createRevisionService } from '../domains/revision/revisionService';
import { RevisionRating } from '../domains/revision/revisionScheduler';
import {
  logTask16QueueAfterReview,
  logTask16QueueLoaded,
  logTask16ReviewAction,
} from '../domains/revision/task16EvidenceLogger';
import { RevisionCard } from '../domains/revision/types';
import { useDoubtHistory } from '../hooks/DoubtHistoryContext';
import { RootTabParamList } from '../navigation/types';
import { formatDateTime } from '../utils/formatters';

type Props = BottomTabScreenProps<RootTabParamList, 'Revision'>;

const revisionService = createRevisionService();

export const RevisionScreen = (_props: Props) => {
  const { records } = useDoubtHistory();
  const [queue, setQueue] = useState<RevisionCard[]>([]);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState('Ready to build your revision queue.');

  const dueCount = queue.length;
  const currentCard = queue[0] ?? null;

  const refreshQueue = useCallback(async (): Promise<RevisionCard[]> => {
    setLoading(true);
    try {
      const due = await revisionService.getDueQueue();
      setQueue(due);
      logTask16QueueLoaded(due.length);
      setStatus(due.length ? `${due.length} card(s) due now.` : 'No due cards. You are all caught up.');
      return due;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Failed to load revision queue: ${message}`);
      return [];
    } finally {
      setLoading(false);
    }
  }, []);

  const importSolvedDoubts = useCallback(async () => {
    setLoading(true);
    try {
      const seeded = await revisionService.seedFromSolvedDoubts(records);
      await refreshQueue();
      setStatus(`Imported ${seeded.length} new card(s) from solved doubts.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Failed to import solved doubts: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [records, refreshQueue]);

  const importWrongAttempts = useCallback(async () => {
    setLoading(true);
    try {
      const seeded = await revisionService.seedFromAllWrongPracticeAttempts();
      await refreshQueue();
      setStatus(`Imported ${seeded.length} new card(s) from wrong practice attempts.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Failed to import wrong attempts: ${message}`);
    } finally {
      setLoading(false);
    }
  }, [refreshQueue]);

  const reviewCurrentCard = useCallback(
    async (rating: RevisionRating) => {
      if (!currentCard) {
        return;
      }

      setLoading(true);
      try {
        const intervalBefore = currentCard.intervalDays;
        const dueBefore = currentCard.dueAt;
        const updated = await revisionService.reviewCard(currentCard.id, rating);
        logTask16ReviewAction({
          cardId: currentCard.id,
          rating,
          intervalBefore,
          intervalAfter: updated.intervalDays,
          dueBefore,
          dueAfter: updated.dueAt,
        });
        const dueAfterReview = await refreshQueue();
        logTask16QueueAfterReview(dueAfterReview.length);
        setStatus(
          `Saved ${rating.toUpperCase()} review. Next due: ${formatDateTime(updated.dueAt)} (interval ${updated.intervalDays}d).`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        setStatus(`Failed to save review: ${message}`);
      } finally {
        setLoading(false);
      }
    },
    [currentCard, refreshQueue],
  );

  useEffect(() => {
    void refreshQueue();
  }, [refreshQueue]);

  const sourceLabel = useMemo(() => {
    if (!currentCard) {
      return '';
    }
    return currentCard.sourceType === 'doubt' ? 'Solved Doubt' : 'Wrong Practice Attempt';
  }, [currentCard]);

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Revision Mode</Text>
      <Text style={styles.subheading}>Review saved cards with a spaced schedule.</Text>

      <View style={styles.row}>
        <Pressable style={styles.secondaryButton} onPress={importSolvedDoubts} disabled={loading}>
          <Text style={styles.secondaryText}>Import Solved Doubts</Text>
        </Pressable>
        <Pressable style={styles.secondaryButton} onPress={importWrongAttempts} disabled={loading}>
          <Text style={styles.secondaryText}>Import Wrong Attempts</Text>
        </Pressable>
      </View>

      <Pressable style={styles.refreshButton} onPress={refreshQueue} disabled={loading}>
        <Text style={styles.refreshText}>Refresh Queue</Text>
      </Pressable>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Due Queue</Text>
        <Text style={styles.meta}>Due now: {dueCount}</Text>

        {currentCard ? (
          <>
            <Text style={styles.tag}>{sourceLabel}</Text>
            <Text style={styles.promptLabel}>Front</Text>
            <Text style={styles.front}>{currentCard.front}</Text>

            <Text style={styles.promptLabel}>Back</Text>
            <Text style={styles.back}>{currentCard.back}</Text>

            <Text style={styles.meta}>Current interval: {currentCard.intervalDays} day(s)</Text>
            <Text style={styles.meta}>Current due: {formatDateTime(currentCard.dueAt)}</Text>

            <View style={styles.reviewRow}>
              <Pressable style={[styles.reviewButton, styles.again]} onPress={() => reviewCurrentCard('again')} disabled={loading}>
                <Text style={styles.reviewText}>Again</Text>
              </Pressable>
              <Pressable style={[styles.reviewButton, styles.hard]} onPress={() => reviewCurrentCard('hard')} disabled={loading}>
                <Text style={styles.reviewText}>Hard</Text>
              </Pressable>
              <Pressable style={[styles.reviewButton, styles.easy]} onPress={() => reviewCurrentCard('easy')} disabled={loading}>
                <Text style={[styles.reviewText, styles.easyText]}>Easy</Text>
              </Pressable>
            </View>
          </>
        ) : (
          <Text style={styles.empty}>No card due right now. Import cards or come back after due time.</Text>
        )}
      </View>

      <Text style={styles.status}>{status}</Text>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  heading: {
    color: colors.textPrimary,
    fontSize: typography.title,
    fontWeight: '800',
  },
  subheading: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  secondaryButton: {
    minHeight: 42,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  secondaryText: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '700',
  },
  refreshButton: {
    minHeight: 42,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.accent,
    backgroundColor: '#123049',
    justifyContent: 'center',
    alignItems: 'center',
  },
  refreshText: {
    color: colors.accent,
    fontSize: typography.body,
    fontWeight: '800',
  },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  cardTitle: {
    color: colors.textPrimary,
    fontSize: typography.bodyLarge,
    fontWeight: '800',
  },
  tag: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  promptLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  front: {
    color: colors.textPrimary,
    fontSize: typography.body,
    lineHeight: 20,
  },
  back: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 20,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  reviewRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  reviewButton: {
    flex: 1,
    minHeight: 44,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
  },
  again: {
    backgroundColor: '#2B141B',
    borderColor: colors.danger,
  },
  hard: {
    backgroundColor: '#31240D',
    borderColor: colors.warning,
  },
  easy: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },
  reviewText: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '800',
  },
  easyText: {
    color: '#042033',
  },
  empty: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  status: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});
