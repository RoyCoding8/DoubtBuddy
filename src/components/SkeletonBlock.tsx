import { StyleSheet, View } from 'react-native';

import { colors, radii } from '../constants/theme';

export const SkeletonBlock = () => <View style={styles.block} />;

const styles = StyleSheet.create({
  block: {
    height: 112,
    borderRadius: radii.md,
    backgroundColor: '#1A243B',
    borderWidth: 1,
    borderColor: colors.border,
  },
});
