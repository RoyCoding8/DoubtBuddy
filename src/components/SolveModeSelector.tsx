import { View } from 'react-native';

import { solveModeOptions } from '../constants/solveModes';
import { SolveMode } from '../types/doubt';
import { TopicChip } from './TopicChip';

interface SolveModeSelectorProps {
  selectedMode: SolveMode;
  onChange: (mode: SolveMode) => void;
}

export const SolveModeSelector = ({ selectedMode, onChange }: SolveModeSelectorProps) => {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
      {solveModeOptions.map((mode) => (
        <TopicChip
          key={mode.id}
          label={`${mode.emoji} ${mode.label}`}
          active={selectedMode === mode.id}
          disableActiveContainerStyle
          onPress={() => onChange(mode.id)}
        />
      ))}
    </View>
  );
};
