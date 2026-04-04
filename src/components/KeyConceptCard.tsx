import { StyleSheet, Text, View } from 'react-native';

import { colors, radii, spacing, typography } from '../constants/theme';

interface KeyConceptCardProps {
  concept: string;
}

export const KeyConceptCard = ({ concept }: KeyConceptCardProps) => (
  <View style={styles.card}>
    <Text style={styles.title}>Key Concept</Text>
    <Text style={styles.body}>{concept}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    borderRadius: radii.md,
    backgroundColor: '#133125',
    borderWidth: 1,
    borderColor: '#2E614B',
    padding: spacing.md,
    gap: spacing.xs,
  },
  title: {
    color: colors.success,
    fontSize: typography.bodyLarge,
    fontWeight: '700',
  },
  body: {
    color: '#D3F7E6',
    fontSize: typography.body,
    lineHeight: 21,
  },
});
