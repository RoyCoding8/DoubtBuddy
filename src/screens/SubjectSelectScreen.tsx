import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StyleSheet, Text } from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer';
import { SubjectCard } from '../components/SubjectCard';
import { syllabusData } from '../constants/syllabus';
import { colors, typography } from '../constants/theme';
import { StudyStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<StudyStackParamList, 'SubjectSelect'>;

export const SubjectSelectScreen = ({ navigation }: Props) => (
  <ScreenContainer>
    <Text style={styles.heading}>Choose a Subject</Text>
    <Text style={styles.subheading}>Select the subject you want to study now.</Text>

    {syllabusData.map((subject) => (
      <SubjectCard
        key={subject.id}
        subject={subject}
        onPress={() => navigation.navigate('ChapterSelect', { subjectId: subject.id })}
      />
    ))}
  </ScreenContainer>
);

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
});
