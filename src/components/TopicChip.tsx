import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radii } from '../constants/theme';

interface TopicChipProps {
  label: string;
  active?: boolean;
  onPress?: () => void;
  disableActiveContainerStyle?: boolean;
}

export const TopicChip = ({
  label,
  active = false,
  onPress,
  disableActiveContainerStyle = false,
}: TopicChipProps) => (
  <Pressable
    onPress={onPress}
    style={[styles.chip, active && !disableActiveContainerStyle && styles.activeChip]}
    hitSlop={6}
    android_ripple={{ color: '#21395F' }}
  >
    <Text style={[styles.label, active && styles.activeLabel]}>{label}</Text>
  </Pressable>
);

const styles = StyleSheet.create({
  chip: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    minHeight: 40,
    paddingHorizontal: 12,
    justifyContent: 'center',
    marginRight: 8,
    marginBottom: 8,
  },
  activeChip: {
    backgroundColor: '#143A59',
    borderColor: colors.accent,
  },
  label: {
    color: colors.textSecondary,
    fontSize: 13,
    fontWeight: '600',
  },
  activeLabel: {
    color: colors.textPrimary,
  },
});
