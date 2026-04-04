import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { ProviderDiagnosticsScreen } from '../screens/ProviderDiagnosticsScreen';
import { SettingsScreen } from '../screens/SettingsScreen';
import { SettingsStackParamList } from './types';

const Stack = createNativeStackNavigator<SettingsStackParamList>();

export const SettingsStackNavigator = () => (
  <Stack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: '#0C1322' },
      headerTintColor: '#F6F8FF',
      contentStyle: { backgroundColor: '#070B14' },
    }}
  >
    <Stack.Screen name="SettingsHome" component={SettingsScreen} options={{ title: 'Settings' }} />
    <Stack.Screen
      name="ProviderDiagnostics"
      component={ProviderDiagnosticsScreen}
      options={{ title: 'Provider Diagnostics' }}
    />
  </Stack.Navigator>
);
