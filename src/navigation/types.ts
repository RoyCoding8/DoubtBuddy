import { NavigatorScreenParams } from '@react-navigation/native';

import { DoubtRecord } from '../types/doubt';
import { SubjectId } from '../types/syllabus';

export type StudyStackParamList = {
  Home: undefined;
  SubjectSelect: undefined;
  ChapterSelect: { subjectId: SubjectId };
  DoubtChat: {
    subjectId: SubjectId;
    chapterId: string;
    topic?: string;
    historyRecord?: DoubtRecord;
  };
};

export type SettingsStackParamList = {
  SettingsHome: undefined;
  ProviderDiagnostics: undefined;
};

export type RootTabParamList = {
  Study: NavigatorScreenParams<StudyStackParamList>;
  Practice: undefined;
  Revision: undefined;
  Progress: undefined;
  History: undefined;
  Settings: NavigatorScreenParams<SettingsStackParamList>;
};
