import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';

import { HistoryScreen } from '../screens/HistoryScreen';
import { PracticeScreen } from '../screens/PracticeScreen';
import { ProgressDashboardScreen } from '../screens/ProgressDashboardScreen';
import { RevisionScreen } from '../screens/RevisionScreen';
import { SettingsStackNavigator } from './SettingsStackNavigator';
import { StudyStackNavigator } from './StudyStackNavigator';
import { RootTabParamList } from './types';

const Tab = createBottomTabNavigator<RootTabParamList>();

const tabIconGlyphByRoute: Record<keyof RootTabParamList, string> = {
  Study: '◻',
  Practice: '◼',
  Revision: '▣',
  Progress: '▥',
  History: '◧',
  Settings: '▦',
};

const navTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    background: '#070B14',
    card: '#0C1322',
    text: '#F6F8FF',
    border: '#1D2A45',
    primary: '#35C2FF',
  },
};

export const RootNavigator = () => (
  <NavigationContainer theme={navTheme}>
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: '#0C1322' },
        headerTintColor: '#F6F8FF',
        tabBarStyle: { backgroundColor: '#0C1322', borderTopColor: '#1D2A45' },
        tabBarActiveTintColor: '#35C2FF',
        tabBarInactiveTintColor: '#8B9ABB',
        tabBarIcon: ({ color, size }) => (
          <Text style={{ color, fontSize: Math.max(16, size - 1), fontWeight: '700' }}>
            {tabIconGlyphByRoute[route.name as keyof RootTabParamList] ?? '◻'}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Study" component={StudyStackNavigator} options={{ headerShown: false }} />
      <Tab.Screen name="Practice" component={PracticeScreen} options={{ title: 'Practice' }} />
      <Tab.Screen name="Revision" component={RevisionScreen} options={{ title: 'Revision' }} />
      <Tab.Screen name="Progress" component={ProgressDashboardScreen} options={{ title: 'Progress' }} />
      <Tab.Screen name="History" component={HistoryScreen} options={{ title: 'My Doubts' }} />
      <Tab.Screen name="Settings" component={SettingsStackNavigator} options={{ headerShown: false }} />
    </Tab.Navigator>
  </NavigationContainer>
);
