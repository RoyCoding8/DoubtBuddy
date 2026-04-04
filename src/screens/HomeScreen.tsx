import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer';
import { colors, radii, spacing, typography } from '../constants/theme';
import { StudyStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<StudyStackParamList, 'Home'>;

export const HomeScreen = ({ navigation }: Props) => (
  <ScreenContainer>
    <View style={styles.heroCard}>
      <Text style={styles.title}>DoubtBuddy</Text>
      <Text style={styles.subtitle}>Step-by-step help for JEE doubts.</Text>
      <Text style={styles.meta}>Choose a subject, open a chapter, and ask your question.</Text>
    </View>

    <Pressable
      onPress={() => navigation.navigate('SubjectSelect')}
      style={styles.primaryButton}
      android_ripple={{ color: '#2A6C8A' }}
    >
      <Text style={styles.primaryText}>Start Studying</Text>
    </Pressable>

    <View style={styles.quickTips}>
      <Text style={styles.quickTitle}>Quick Tips</Text>
      <Text style={styles.quickBody}>1) Pick a chapter  2) Type or upload a question  3) Choose a solve mode</Text>
    </View>
  </ScreenContainer>
);

const styles = StyleSheet.create({
  heroCard: {
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  title: {
    color: colors.textPrimary,
    fontSize: typography.title,
    fontWeight: '800',
  },
  subtitle: {
    color: colors.textPrimary,
    fontSize: typography.bodyLarge,
    lineHeight: 24,
  },
  meta: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#042033',
    fontSize: typography.bodyLarge,
    fontWeight: '800',
  },
  quickTips: {
    borderRadius: radii.md,
    padding: spacing.md,
    backgroundColor: '#111D31',
    borderColor: colors.border,
    borderWidth: 1,
    gap: spacing.xs,
  },
  quickTitle: {
    color: colors.textPrimary,
    fontWeight: '700',
    fontSize: typography.bodyLarge,
  },
  quickBody: {
    color: colors.textSecondary,
    fontSize: typography.body,
  },
});
