import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ChapterSelectScreen } from '../screens/ChapterSelectScreen';
import { DoubtChatScreen } from '../screens/DoubtChatScreen';
import { HomeScreen } from '../screens/HomeScreen';
import { SubjectSelectScreen } from '../screens/SubjectSelectScreen';
import { StudyStackParamList } from './types';

const Stack = createNativeStackNavigator<StudyStackParamList>();

export const StudyStackNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: '#0C1322' },
      headerTintColor: '#F6F8FF',
      contentStyle: { backgroundColor: '#070B14' },
    }}
  >
    <Stack.Screen name="Home" component={HomeScreen} options={{ title: 'DoubtBuddy' }} />
    <Stack.Screen name="SubjectSelect" component={SubjectSelectScreen} options={{ title: 'Subjects' }} />
    <Stack.Screen name="ChapterSelect" component={ChapterSelectScreen} options={{ title: 'Chapters' }} />
    <Stack.Screen name="DoubtChat" component={DoubtChatScreen} options={{ title: 'Doubt Solver' }} />
  </Stack.Navigator>
);
