import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../constants/theme';
import { SyllabusSubject } from '../types/syllabus';

interface SubjectCardProps {
  subject: SyllabusSubject;
  onPress: () => void;
}

export const SubjectCard = ({ subject, onPress }: SubjectCardProps) => (
  <Pressable style={styles.card} onPress={onPress} android_ripple={{ color: '#20304D' }}>
    <View style={styles.badge}>
      <Text style={styles.badgeText}>{subject.shortLabel}</Text>
    </View>
    <View style={styles.content}>
      <Text style={styles.title}>{subject.name}</Text>
      <Text style={styles.description}>{subject.description}</Text>
      <Text style={styles.meta}>{subject.chapters.length} chapter groups</Text>
    </View>
  </Pressable>
);

const styles = StyleSheet.create({
  card: {
    minHeight: 94,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
  },
  badge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: '#183356',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: colors.accent,
    fontSize: 14,
    fontWeight: '700',
  },
  content: {
    flex: 1,
    gap: 2,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.heading,
    fontWeight: '700',
  },
  description: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  meta: {
    color: colors.accent,
    fontSize: 13,
    marginTop: 4,
  },
});
