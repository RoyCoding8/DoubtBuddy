import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer';
import { syllabusData } from '../constants/syllabus';
import { colors, radii, spacing, typography } from '../constants/theme';
import { createPracticeService } from '../domains/practice/practiceService';
import { PracticeDifficultyMix, PracticeSet, PracticeSubmissionResult } from '../domains/practice/types';
import { RootTabParamList } from '../navigation/types';

type Props = BottomTabScreenProps<RootTabParamList, 'Practice'>;

const practiceService = createPracticeService();

export const PracticeScreen = (_props: Props) => {
  const [subjectId, setSubjectId] = useState<'physics' | 'chemistry' | 'math'>('physics');
  const [chapterId, setChapterId] = useState(syllabusData[0]?.chapters[0]?.id ?? '');
  const [topic, setTopic] = useState('');
  const [questionCount, setQuestionCount] = useState<5 | 10 | 20>(10);
  const [difficultyMix, setDifficultyMix] = useState<PracticeDifficultyMix>({ easy: 4, medium: 4, hard: 2 });
  const [activeSet, setActiveSet] = useState<PracticeSet | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<PracticeSubmissionResult | null>(null);
  const [status, setStatus] = useState<string>('Ready to generate a practice set.');
  const [loading, setLoading] = useState(false);

  const currentSubject = useMemo(() => syllabusData.find((entry) => entry.id === subjectId), [subjectId]);
  const chapters = currentSubject?.chapters ?? [];

  const onChangeSubject = (next: 'physics' | 'chemistry' | 'math') => {
    setSubjectId(next);
    const firstChapterId = syllabusData.find((entry) => entry.id === next)?.chapters[0]?.id;
    if (firstChapterId) {
      setChapterId(firstChapterId);
    }
  };

  const updateDifficultyMix = (key: keyof PracticeDifficultyMix, delta: number) => {
    setDifficultyMix((prev) => ({
      ...prev,
      [key]: Math.max(0, prev[key] + delta),
    }));
  };

  const generateSet = async () => {
    setLoading(true);
    setStatus('Generating practice set...');
    try {
      const nextSet = await practiceService.generateSet({
        subjectId,
        chapterId,
        topic: topic.trim() || undefined,
        questionCount,
        difficultyMix,
      });
      setActiveSet(nextSet);
      setAnswers({});
      setResult(null);
      setStatus(`Generated ${nextSet.questionCount}-question set.`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Failed to generate set: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  const submitSet = async () => {
    if (!activeSet) {
      return;
    }

    setLoading(true);
    setStatus('Grading answers...');
    try {
      const graded = await practiceService.submitAnswers({
        setId: activeSet.id,
        submissions: activeSet.questions.map((question) => ({
          questionId: question.id,
          userAnswer: answers[question.id] ?? '',
          solveTimeMs: 0,
        })),
      });
      setResult(graded);
      setStatus('Set graded. Review weak areas below.');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setStatus(`Failed to grade set: ${message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Practice Mode</Text>
      <Text style={styles.subheading}>Generate a set, answer it, and review feedback.</Text>

      <Text style={styles.label}>Subject</Text>
      <View style={styles.row}>
        {(['physics', 'chemistry', 'math'] as const).map((entry) => (
          <Pressable
            key={entry}
            style={[styles.optionButton, subjectId === entry && styles.optionButtonActive]}
            onPress={() => onChangeSubject(entry)}
            disabled={loading}
          >
            <Text style={styles.optionText}>{entry.toUpperCase()}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Chapter</Text>
      <View style={styles.wrapRow}>
        {chapters.map((entry) => (
          <Pressable
            key={entry.id}
            style={[styles.optionButton, chapterId === entry.id && styles.optionButtonActive]}
            onPress={() => setChapterId(entry.id)}
            disabled={loading}
          >
            <Text style={styles.optionText}>{entry.name}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Topic (optional)</Text>
      <TextInput
        style={styles.input}
        value={topic}
        onChangeText={setTopic}
        placeholder="e.g. Kinematics"
        placeholderTextColor={colors.textSecondary}
        editable={!loading}
      />

      <Text style={styles.label}>Set Size</Text>
      <View style={styles.row}>
        {[5, 10, 20].map((count) => (
          <Pressable
            key={count}
            style={[styles.optionButton, questionCount === count && styles.optionButtonActive]}
            onPress={() => setQuestionCount(count as 5 | 10 | 20)}
            disabled={loading}
          >
            <Text style={styles.optionText}>{count}</Text>
          </Pressable>
        ))}
      </View>

      <Text style={styles.label}>Difficulty Mix (easy / medium / hard)</Text>
      <View style={styles.mixContainer}>
        {(['easy', 'medium', 'hard'] as const).map((level) => (
          <View key={level} style={styles.mixRow}>
            <Text style={styles.mixLabel}>{level.toUpperCase()}</Text>
            <Pressable
              style={styles.mixButton}
              onPress={() => updateDifficultyMix(level, -1)}
              disabled={loading || difficultyMix[level] <= 0}
            >
              <Text style={styles.mixButtonText}>−</Text>
            </Pressable>
            <Text style={styles.mixValue}>{difficultyMix[level]}</Text>
            <Pressable style={styles.mixButton} onPress={() => updateDifficultyMix(level, 1)} disabled={loading}>
              <Text style={styles.mixButtonText}>+</Text>
            </Pressable>
          </View>
        ))}
      </View>
      <Text style={styles.mixHint}>If totals differ from set size, mix is normalized automatically.</Text>

      <Pressable style={styles.primaryButton} onPress={generateSet} disabled={loading}>
        <Text style={styles.primaryText}>Generate Set</Text>
      </Pressable>

      {activeSet ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Practice Questions</Text>
          {activeSet.questions.map((question, index) => (
            <View key={question.id} style={styles.questionBlock}>
              <Text style={styles.questionText}>
                {index + 1}. {question.prompt}
              </Text>
              <TextInput
                style={styles.input}
                value={answers[question.id] ?? ''}
                onChangeText={(text) => setAnswers((prev) => ({ ...prev, [question.id]: text }))}
                placeholder="Your answer"
                placeholderTextColor={colors.textSecondary}
                editable={!loading}
              />
            </View>
          ))}

          <Pressable style={styles.primaryButton} onPress={submitSet} disabled={loading}>
            <Text style={styles.primaryText}>Submit Answers</Text>
          </Pressable>
        </View>
      ) : null}

      {result ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Score Summary</Text>
          <Text style={styles.summaryText}>
            Correct: {result.correctCount}/{result.totalQuestions} ({Math.round(result.accuracy * 100)}%)
          </Text>
          <Text style={styles.summaryText}>Incorrect: {result.incorrectCount}</Text>

          <Text style={styles.cardSubtitle}>Weak Area Tags</Text>
          {result.weakAreas.length ? (
            result.weakAreas.map((weak, index) => (
              <Text key={`${weak.chapterId}-${weak.topic ?? 'general'}-${index}`} style={styles.weakText}>
                • {weak.topic ?? 'Chapter-wide'} — {Math.round(weak.errorRate * 100)}% errors — {weak.tag}
              </Text>
            ))
          ) : (
            <Text style={styles.summaryText}>No weak areas tagged. Great work.</Text>
          )}
        </View>
      ) : null}

      <Text style={styles.statusText}>{status}</Text>
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
  label: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '700',
  },
  row: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  wrapRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    flexWrap: 'wrap',
  },
  optionButton: {
    minHeight: 36,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    justifyContent: 'center',
    paddingHorizontal: 12,
  },
  optionButtonActive: {
    borderColor: colors.accent,
    backgroundColor: '#123049',
  },
  optionText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  input: {
    minHeight: 44,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    paddingHorizontal: 12,
    fontSize: typography.body,
  },
  primaryButton: {
    minHeight: 46,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
  },
  primaryText: {
    color: '#042033',
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
  cardSubtitle: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '700',
  },
  questionBlock: {
    gap: spacing.xs,
  },
  questionText: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  summaryText: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  weakText: {
    color: colors.warning,
    fontSize: typography.body,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  mixContainer: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  mixRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  mixLabel: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '700',
    minWidth: 70,
  },
  mixButton: {
    minWidth: 28,
    minHeight: 28,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0f2232',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mixButtonText: {
    color: colors.textPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
  mixValue: {
    color: colors.textPrimary,
    fontSize: typography.body,
    minWidth: 20,
    textAlign: 'center',
    fontWeight: '700',
  },
  mixHint: {
    color: colors.textSecondary,
    fontSize: 12,
  },
});
