import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, radii, spacing, typography } from '../constants/theme';
import { SyllabusChapter } from '../types/syllabus';
import { TopicChip } from './TopicChip';

interface ChapterListProps {
  chapters: readonly SyllabusChapter[];
  onSelectChapter: (chapterId: string, topic?: string) => void;
}

export const ChapterList = ({ chapters, onSelectChapter }: ChapterListProps) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return chapters;
    }

    return chapters.filter(
      (chapter) =>
        chapter.name.toLowerCase().includes(trimmed) ||
        chapter.topics.some((topic) => topic.toLowerCase().includes(trimmed)),
    );
  }, [chapters, query]);

  return (
    <View style={styles.wrapper}>
      <TextInput
        style={styles.search}
        value={query}
        onChangeText={setQuery}
        placeholder="Search chapter or topic"
        placeholderTextColor={colors.textSecondary}
      />
      {filtered.map((chapter) => (
        <Pressable
          key={chapter.id}
          style={styles.row}
          onPress={() => onSelectChapter(chapter.id)}
          android_ripple={{ color: '#1A2F4E' }}
        >
          <Text style={styles.chapterName}>{chapter.name}</Text>
          <View style={styles.topicRow}>
            {chapter.topics.slice(0, 4).map((topic) => (
              <TopicChip key={topic} label={topic} onPress={() => onSelectChapter(chapter.id, topic)} />
            ))}
          </View>
        </Pressable>
      ))}
      {filtered.length === 0 ? <Text style={styles.empty}>No chapter found for this search.</Text> : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.md,
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
  row: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  chapterName: {
    color: colors.textPrimary,
    fontSize: typography.bodyLarge,
    fontWeight: '700',
  },
  topicRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  empty: {
    color: colors.textSecondary,
    fontSize: typography.body,
    textAlign: 'center',
    marginTop: spacing.lg,
  },
});
