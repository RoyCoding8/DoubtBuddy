import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text } from 'react-native';

import { ChapterList } from '../components/ChapterList';
import { ScreenContainer } from '../components/ScreenContainer';
import { syllabusData } from '../constants/syllabus';
import { colors, typography } from '../constants/theme';
import { StudyStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<StudyStackParamList, 'ChapterSelect'>;

export const ChapterSelectScreen = ({ navigation, route }: Props) => {
  const subject = syllabusData.find((item) => item.id === route.params.subjectId);

  if (!subject) {
    return (
      <ScreenContainer>
        <Text style={styles.error}>Subject not found.</Text>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer>
      <Text style={styles.heading}>{subject.name}</Text>
      <Text style={styles.subheading}>Select a chapter or topic to continue.</Text>
      <ChapterList
        chapters={subject.chapters}
        onSelectChapter={(chapterId, topic) =>
          navigation.navigate('DoubtChat', {
            subjectId: subject.id,
            chapterId,
            topic,
          })
        }
      />
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
  error: {
    color: colors.danger,
    fontSize: typography.bodyLarge,
  },
});
