import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useMemo, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer';
import { SkeletonBlock } from '../components/SkeletonBlock';
import { colors, radii, spacing, typography } from '../constants/theme';
import { useDoubtHistory } from '../hooks/DoubtHistoryContext';
import { RootTabParamList } from '../navigation/types';
import { formatDateTime } from '../utils/formatters';

type Props = BottomTabScreenProps<RootTabParamList, 'History'>;

export const HistoryScreen = ({ navigation }: Props) => {
  const { loading, records, toggleBookmark, deleteRecord, clearAllRecords } = useDoubtHistory();
  const [query, setQuery] = useState('');
  const canClearAll = !loading && records.length > 0;

  const filtered = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      return records;
    }

    return records.filter((record) => {
      const haystack = `${record.subjectName} ${record.chapterName} ${record.questionText}`.toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [query, records]);

  return (
    <ScreenContainer>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>My Doubts</Text>
        <Pressable
          style={[styles.clearButton, !canClearAll && styles.buttonDisabled]}
          onPress={() => {
            Alert.alert('Clear all doubts', 'This will remove all saved doubts on this device.', [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Clear All',
                style: 'destructive',
                onPress: () => {
                  void clearAllRecords();
                },
              },
            ]);
          }}
          disabled={!canClearAll}
        >
          <Text style={styles.clearText}>Clear All</Text>
        </Pressable>
      </View>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search by subject, chapter, or doubt"
        placeholderTextColor={colors.textSecondary}
      />

      {loading ? <SkeletonBlock /> : null}

      {!loading && filtered.length === 0 ? (
        <View style={styles.emptyBox}>
          <Text style={styles.emptyTitle}>No saved doubts yet</Text>
          <Text style={styles.emptyBody}>Your solved doubts will appear here for quick revision.</Text>
        </View>
      ) : null}

      {filtered.map((record) => (
        <Pressable
          key={record.id}
          style={styles.card}
          onPress={() =>
            navigation.navigate('Study', {
              screen: 'DoubtChat',
              params: {
                subjectId: record.subjectId,
                chapterId: record.chapterId,
                topic: record.topic,
                historyRecord: record,
              },
            })
          }
        >
          <View style={styles.cardHeader}>
            <Text style={styles.subjectLabel}>{record.subjectName}</Text>
            <Pressable
              style={styles.bookmarkButton}
              onPress={() => {
                void toggleBookmark(record.id, !record.bookmarked);
              }}
            >
              <Text style={styles.bookmarkText}>{record.bookmarked ? 'Bookmarked' : 'Bookmark'}</Text>
            </Pressable>
            <Pressable
              style={styles.deleteButton}
              onPress={() => {
                Alert.alert('Delete doubt', 'Remove this saved doubt from history?', [
                  { text: 'Cancel', style: 'cancel' },
                  {
                    text: 'Delete',
                    style: 'destructive',
                    onPress: () => {
                      void deleteRecord(record.id);
                    },
                  },
                ]);
              }}
            >
              <Text style={styles.deleteText}>Delete</Text>
            </Pressable>
          </View>
          <Text style={styles.chapter}>{record.chapterName}</Text>
          <Text style={styles.question} numberOfLines={2}>
            {record.questionText}
          </Text>
          <Text style={styles.timestamp}>{formatDateTime(record.createdAt)}</Text>
        </Pressable>
      ))}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  heading: {
    color: colors.textPrimary,
    fontSize: typography.title,
    fontWeight: '800',
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  clearButton: {
    minHeight: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: 12,
    justifyContent: 'center',
    backgroundColor: '#2B141B',
  },
  clearText: {
    color: colors.danger,
    fontWeight: '700',
    fontSize: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  search: {
    minHeight: 48,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    fontSize: typography.body,
  },
  emptyBox: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  emptyTitle: {
    color: colors.textPrimary,
    fontSize: typography.bodyLarge,
    fontWeight: '700',
  },
  emptyBody: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  card: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.xs,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    flexWrap: 'wrap',
  },
  subjectLabel: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  bookmarkButton: {
    minHeight: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 10,
    justifyContent: 'center',
  },
  bookmarkText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  deleteButton: {
    minHeight: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    paddingHorizontal: 10,
    justifyContent: 'center',
    backgroundColor: '#2B141B',
  },
  deleteText: {
    color: colors.danger,
    fontSize: 12,
    fontWeight: '700',
  },
  chapter: {
    color: colors.textPrimary,
    fontSize: typography.bodyLarge,
    fontWeight: '700',
  },
  question: {
    color: colors.textSecondary,
    fontSize: typography.body,
    lineHeight: 20,
  },
  timestamp: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});
