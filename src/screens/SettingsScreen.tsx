import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useMemo, useState } from 'react';
import { Alert, Linking, Pressable, StyleSheet, Switch, Text, TextInput, View } from 'react-native';

import { ScreenContainer } from '../components/ScreenContainer';
import { colors, radii, spacing, typography } from '../constants/theme';
import { deleteProviderKey, saveProviderKey } from '../domains/settings/providerKeyService';
import { useAppSettings } from '../hooks/SettingsContext';
import { SettingsStackParamList } from '../navigation/types';
import { supportsBiometricLock } from '../services/apiKeyStorage';
import {
  SETTINGS_DIAGNOSTICS_CTA_TEST_ID,
  getEnabledModelProviders,
  providerKeyOptions,
  providerModelOptions,
  qualityModeOptions,
} from './settingsUi.contract';
import { AppFeatureFlags, GeminiModelId, ProviderId, ProviderKeyProviderId, QualityMode } from '../types/settings';

type Props = NativeStackScreenProps<SettingsStackParamList, 'SettingsHome'>;

const providerInfo: Record<ProviderId, { label: string; description: string }> = {
  gemini: {
    label: 'Gemini',
    description: 'Primary provider with strongest baseline for JEE structured outputs.',
  },
  openrouter: {
    label: 'OpenRouter',
    description: 'Tier-1 fallback route for broader model coverage.',
  },
  huggingface: {
    label: 'Hugging Face',
    description: 'Tier-2 fallback route for open-model inference.',
  },
  local_template: {
    label: 'Local Template',
    description: 'Offline deterministic scaffold fallback when remote providers fail.',
  },
};

const getProviderEnabled = (provider: ProviderId, flags: AppFeatureFlags): boolean => {
  if (provider === 'openrouter') {
    return flags.openRouterEnabled;
  }

  if (provider === 'huggingface') {
    return flags.huggingFaceEnabled;
  }

  return true;
};

const getProviderModelLabel = (providerId: ProviderKeyProviderId, modelId: string): string => {
  const option = providerModelOptions[providerId].find((candidate) => candidate.id === modelId);
  return option?.label ?? modelId;
};

const testGeminiKey = async (args: {
  key: string;
  model: string;
  signal: AbortSignal;
}): Promise<'ok' | 'unexpected'> => {
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${args.model}:generateContent?key=${encodeURIComponent(args.key)}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        generationConfig: { maxOutputTokens: 8, temperature: 0 },
        contents: [
          {
            role: 'user',
            parts: [{ text: 'Reply with exactly: OK' }],
          },
        ],
      }),
      signal: args.signal,
    },
  );

  if (!response.ok) {
    throw new Error(`status ${response.status}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  const text = payload.candidates?.[0]?.content?.parts?.map((part) => part.text ?? '').join('').trim().toUpperCase();
  return text?.includes('OK') ? 'ok' : 'unexpected';
};

const testOpenRouterKey = async (args: {
  key: string;
  model: string;
  signal: AbortSignal;
}): Promise<'ok' | 'unexpected'> => {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.key}`,
    },
    body: JSON.stringify({
      model: args.model,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 12,
      temperature: 0,
    }),
    signal: args.signal,
  });

  if (!response.ok) {
    throw new Error(`status ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim().toUpperCase() ?? '';
  return text.includes('OK') ? 'ok' : 'unexpected';
};

const testHuggingFaceKey = async (args: {
  key: string;
  model: string;
  signal: AbortSignal;
}): Promise<'ok' | 'unexpected'> => {
  const response = await fetch('https://router.huggingface.co/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${args.key}`,
    },
    body: JSON.stringify({
      model: args.model,
      messages: [{ role: 'user', content: 'Reply with exactly: OK' }],
      max_tokens: 12,
      temperature: 0,
    }),
    signal: args.signal,
  });

  if (!response.ok) {
    throw new Error(`status ${response.status}`);
  }

  const payload = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const text = payload.choices?.[0]?.message?.content?.trim().toUpperCase() ?? '';
  return text.includes('OK') ? 'ok' : 'unexpected';
};

const moveProvider = (order: ProviderId[], fromIndex: number, toIndex: number): ProviderId[] => {
  if (fromIndex < 0 || fromIndex >= order.length || toIndex < 0 || toIndex >= order.length || fromIndex === toIndex) {
    return order;
  }

  const next = [...order];
  const [item] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, item);
  return next;
};

export const SettingsScreen = ({ navigation }: Props) => {
  const { settings, hasApiKey, providerKeyStatus, updateSettings, setHasApiKey, setProviderKeyStatus, setAppLocked } =
    useAppSettings();

  const [apiKeyInput, setApiKeyInput] = useState('');
  const [selectedKeyProvider, setSelectedKeyProvider] = useState<ProviderKeyProviderId>('gemini');
  const [isBusy, setIsBusy] = useState(false);
  const [isTestingKey, setIsTestingKey] = useState(false);
  const [testStatus, setTestStatus] = useState<string>('');

  const providerSlotEnabled = selectedKeyProvider === 'gemini' || getProviderEnabled(selectedKeyProvider, settings.featureFlags);
  const isActionBusy = useMemo(() => isBusy || isTestingKey, [isBusy, isTestingKey]);
  const hasSelectedProviderKey = providerKeyStatus[selectedKeyProvider];
  const enabledModelProviders = useMemo(
    () => getEnabledModelProviders(settings.featureFlags),
    [settings.featureFlags],
  );

  const onMoveProvider = async (providerId: ProviderId, direction: 'up' | 'down') => {
    const currentIndex = settings.providerPriority.indexOf(providerId);
    if (currentIndex < 0) {
      return;
    }

    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    const nextPriority = moveProvider(settings.providerPriority, currentIndex, targetIndex);
    if (nextPriority === settings.providerPriority) {
      return;
    }

    const firstRemote = nextPriority.find(
      (provider): provider is Exclude<ProviderId, 'local_template'> => provider !== 'local_template',
    );

    await updateSettings({
      ...settings,
      providerPriority: nextPriority,
      provider: firstRemote ?? 'gemini',
    });
  };

  const onSelectQualityMode = async (qualityMode: QualityMode) => {
    await updateSettings({
      ...settings,
      qualityMode,
    });
  };

  const onToggleProviderFlag = async (provider: 'openrouter' | 'huggingface', value: boolean) => {
    if (provider === 'openrouter') {
      await updateSettings({
        ...settings,
        featureFlags: {
          ...settings.featureFlags,
          openRouterEnabled: value,
        },
      });
      return;
    }

    await updateSettings({
      ...settings,
      featureFlags: {
        ...settings.featureFlags,
        huggingFaceEnabled: value,
      },
    });
  };

  const onSelectProviderModel = async (providerId: ProviderKeyProviderId, modelId: string) => {
    await updateSettings({
      ...settings,
      providerModels: {
        ...settings.providerModels,
        [providerId]: modelId,
      },
      geminiModel: providerId === 'gemini' ? (modelId as GeminiModelId) : settings.geminiModel,
    });
  };

  const onSaveApiKey = async () => {
    if (!apiKeyInput.trim()) {
      Alert.alert('Missing key', `Paste your ${selectedKeyProvider} API key first.`);
      return;
    }

    setIsBusy(true);
    try {
      await saveProviderKey(selectedKeyProvider, apiKeyInput.trim());
      setProviderKeyStatus({
        ...providerKeyStatus,
        [selectedKeyProvider]: true,
      });
      if (selectedKeyProvider === 'gemini') {
        setHasApiKey(true);
      }
      setApiKeyInput('');
      Alert.alert('Saved', `${selectedKeyProvider} API key saved securely on this device.`);
    } catch {
      Alert.alert('Could not save', 'Saving key failed. Try again.');
    } finally {
      setIsBusy(false);
    }
  };

  const onDeleteApiKey = async () => {
    setIsBusy(true);
    try {
      await deleteProviderKey(selectedKeyProvider);
      setProviderKeyStatus({
        ...providerKeyStatus,
        [selectedKeyProvider]: false,
      });
      if (selectedKeyProvider === 'gemini') {
        setHasApiKey(false);
      }
      Alert.alert('Deleted', `${selectedKeyProvider} API key removed from this device.`);
    } catch {
      Alert.alert('Delete failed', 'Could not remove API key.');
    } finally {
      setIsBusy(false);
    }
  };

  const onTestApiKey = async () => {
    if (!providerSlotEnabled) {
      setTestStatus('Enable this provider feature flag before running key test.');
      return;
    }

    const key = apiKeyInput.trim();
    if (!key) {
      setTestStatus('Paste key first to run test.');
      return;
    }

    setIsTestingKey(true);
    setTestStatus('Testing key...');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);

    try {
      const selectedModel = settings.providerModels[selectedKeyProvider];

      let result: 'ok' | 'unexpected';
      if (selectedKeyProvider === 'gemini') {
        result = await testGeminiKey({ key, model: selectedModel, signal: controller.signal });
      } else if (selectedKeyProvider === 'openrouter') {
        result = await testOpenRouterKey({ key, model: selectedModel, signal: controller.signal });
      } else {
        result = await testHuggingFaceKey({ key, model: selectedModel, signal: controller.signal });
      }

      if (result === 'ok') {
        setTestStatus('Key test passed. You can save this key.');
      } else {
        setTestStatus('Key responded, but output was unexpected. You can still try saving.');
      }
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        setTestStatus('Test timed out. Check internet and retry.');
      } else if (error instanceof Error && error.message.includes('status 401')) {
        setTestStatus('Invalid key (401).');
      } else if (error instanceof Error && error.message.includes('status 403')) {
        setTestStatus('Key lacks access to selected model/API (403).');
      } else if (error instanceof Error && error.message.includes('status 429')) {
        setTestStatus('Rate limit reached (429).');
      } else {
        setTestStatus('Test failed. Check internet, model selection, or key validity.');
      }
    } finally {
      clearTimeout(timer);
      setIsTestingKey(false);
    }
  };

  const onToggleBiometric = async (nextValue: boolean) => {
    if (nextValue) {
      const supported = await supportsBiometricLock();
      if (!supported) {
        Alert.alert('Not available', 'App lock is not available on this device.');
        return;
      }
    }

    await updateSettings({
      ...settings,
      enableAppLock: nextValue,
    });

    setTestStatus('');

    if (nextValue) {
      setAppLocked(true);
    }
  };

  return (
    <ScreenContainer>
      <Text style={styles.heading}>Settings</Text>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Provider Priority</Text>
        <Text style={styles.optionBody}>Configure routing order used by the orchestrator failover chain.</Text>
        {settings.providerPriority.map((providerId, index) => {
          const enabled = getProviderEnabled(providerId, settings.featureFlags);
          const info = providerInfo[providerId];

          return (
            <View key={providerId} style={[styles.priorityRow, !enabled && styles.optionDisabled]}>
              <View style={styles.priorityMain}>
                <Text style={styles.optionTitle}>
                  {index + 1}. {info.label}
                </Text>
                <Text style={styles.optionBody}>{info.description}</Text>
                <Text style={styles.statusText}>Status: {enabled ? 'Enabled' : 'Disabled by feature flag'}</Text>
              </View>
              <View style={styles.reorderControls}>
                <Pressable
                  style={[styles.reorderButton, index === 0 && styles.buttonDisabled]}
                  onPress={() => {
                    void onMoveProvider(providerId, 'up');
                  }}
                  disabled={index === 0}
                  testID={`provider-reorder-${providerId}-up`}
                >
                  <Text style={styles.reorderText}>↑</Text>
                </Pressable>
                <Pressable
                  style={[styles.reorderButton, index === settings.providerPriority.length - 1 && styles.buttonDisabled]}
                  onPress={() => {
                    void onMoveProvider(providerId, 'down');
                  }}
                  disabled={index === settings.providerPriority.length - 1}
                  testID={`provider-reorder-${providerId}-down`}
                >
                  <Text style={styles.reorderText}>↓</Text>
                </Pressable>
              </View>
            </View>
          );
        })}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quality Mode</Text>
        <Text style={styles.optionBody}>Controls cost/latency preference used in provider routing decisions.</Text>
        {qualityModeOptions.map((mode) => (
          <Pressable
            key={mode.id}
            style={[styles.option, settings.qualityMode === mode.id && styles.optionActive]}
            onPress={() => {
              void onSelectQualityMode(mode.id);
            }}
            testID={`quality-mode-${mode.id}`}
          >
            <Text style={styles.optionTitle}>{mode.label}</Text>
            <Text style={styles.optionBody}>{mode.description}</Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Provider Model Selection</Text>
        <Text style={styles.optionBody}>Select default model per enabled provider for routing and diagnostics checks.</Text>
        {enabledModelProviders.map((providerId) => (
          <View key={providerId} style={styles.modelCard}>
            <Text style={styles.optionTitle}>{providerInfo[providerId].label}</Text>
            <Text style={styles.statusText}>Current: {getProviderModelLabel(providerId, settings.providerModels[providerId])}</Text>
            <View style={styles.modelOptionWrap}>
              {providerModelOptions[providerId].map((model) => {
                const active = settings.providerModels[providerId] === model.id;
                return (
                  <Pressable
                    key={model.id}
                    style={[styles.modelChip, active && styles.modelChipActive]}
                    onPress={() => {
                      void onSelectProviderModel(providerId, model.id);
                    }}
                    testID={`model-option-${providerId}-${model.id}`}
                  >
                    <Text style={styles.slotChipText}>{model.label}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        ))}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Provider Feature Flags</Text>
        <View style={styles.switchRowInline}>
          <View style={styles.switchCopyArea}>
            <Text style={styles.optionTitle}>Enable OpenRouter</Text>
            <Text style={styles.optionBody}>Allow OpenRouter in routing priority.</Text>
          </View>
          <Switch
            value={settings.featureFlags.openRouterEnabled}
            onValueChange={(value) => {
              void onToggleProviderFlag('openrouter', value);
            }}
            thumbColor={settings.featureFlags.openRouterEnabled ? colors.accent : '#8B9ABB'}
            trackColor={{ false: '#32415F', true: '#1C5C7A' }}
          />
        </View>
        <View style={styles.switchRowInline}>
          <View style={styles.switchCopyArea}>
            <Text style={styles.optionTitle}>Enable Hugging Face</Text>
            <Text style={styles.optionBody}>Allow Hugging Face in routing priority.</Text>
          </View>
          <Switch
            value={settings.featureFlags.huggingFaceEnabled}
            onValueChange={(value) => {
              void onToggleProviderFlag('huggingface', value);
            }}
            thumbColor={settings.featureFlags.huggingFaceEnabled ? colors.accent : '#8B9ABB'}
            trackColor={{ false: '#32415F', true: '#1C5C7A' }}
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Provider API Key (BYOK)</Text>
        <Text style={styles.optionBody}>Choose a provider slot and validate save/delete key presence from this screen.</Text>
        <View style={styles.providerSlotRow}>
          {providerKeyOptions.map((provider) => (
            <Pressable
              key={provider.id}
              style={[styles.slotChip, selectedKeyProvider === provider.id && styles.slotChipActive]}
              onPress={() => {
                setSelectedKeyProvider(provider.id);
                setApiKeyInput('');
                setTestStatus('');
              }}
            >
              <Text style={styles.slotChipText}>{provider.label}</Text>
            </Pressable>
          ))}
        </View>
        {selectedKeyProvider === 'gemini' ? (
          <>
            <Text style={styles.guideTitle}>How to get your Gemini key</Text>
            <Text style={styles.optionBody}>1) Open Google AI Studio</Text>
            <Text style={styles.optionBody}>2) Create API key</Text>
            <Text style={styles.optionBody}>3) Paste here and test before saving</Text>
            <Pressable
              style={styles.linkButton}
              onPress={() => {
                void Linking.openURL('https://aistudio.google.com/app/apikey');
              }}
            >
              <Text style={styles.linkText}>Open AI Studio Key Page</Text>
            </Pressable>
          </>
        ) : null}
        <Text style={styles.optionBody}>Key is stored in device secure storage. We never commit it to code.</Text>
        <TextInput
          style={styles.input}
          value={apiKeyInput}
          onChangeText={setApiKeyInput}
          placeholder={`Paste ${selectedKeyProvider} API key`}
          placeholderTextColor={colors.textSecondary}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!isActionBusy}
        />
        <View style={styles.actionRow}>
          <Pressable
            style={[styles.secondaryButton, (!providerSlotEnabled || isActionBusy) && styles.buttonDisabled]}
            onPress={() => {
              void onTestApiKey();
            }}
            disabled={!providerSlotEnabled || isActionBusy}
          >
            <Text style={styles.secondaryText}>{isTestingKey ? 'Testing...' : 'Test Key'}</Text>
          </Pressable>
          <Pressable
            style={[styles.primaryButton, isBusy && styles.buttonDisabled]}
            onPress={() => {
              void onSaveApiKey();
            }}
            disabled={isBusy}
          >
            <Text style={styles.primaryText}>Save Key</Text>
          </Pressable>
          <Pressable
            style={[styles.dangerButton, (!hasSelectedProviderKey || isBusy) && styles.buttonDisabled]}
            onPress={() => {
              void onDeleteApiKey();
            }}
            disabled={!hasSelectedProviderKey || isBusy}
          >
            <Text style={styles.dangerText}>Delete Key</Text>
          </Pressable>
        </View>
        <Text style={styles.statusText}>Selected slot status: {providerKeyStatus[selectedKeyProvider] ? 'Present' : 'Not set'}</Text>
        <Text style={styles.statusText}>Gemini active status: {hasApiKey ? 'Present' : 'Not set'}</Text>
        <Text style={styles.statusText}>
          All slots → Gemini: {providerKeyStatus.gemini ? 'Present' : 'Not set'} · OpenRouter:{' '}
          {providerKeyStatus.openrouter ? 'Present' : 'Not set'} · Hugging Face:{' '}
          {providerKeyStatus.huggingface ? 'Present' : 'Not set'}
        </Text>
        {testStatus ? <Text style={styles.statusText}>{testStatus}</Text> : null}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Diagnostics</Text>
        <Text style={styles.optionBody}>Run provider health checks and inspect local telemetry performance summary.</Text>
        <Pressable
          style={styles.primaryButton}
          testID={SETTINGS_DIAGNOSTICS_CTA_TEST_ID}
          onPress={() => {
            navigation.navigate('ProviderDiagnostics');
          }}
        >
          <Text style={styles.primaryText}>Open Provider Diagnostics</Text>
        </Pressable>
      </View>

      <View style={styles.switchRow}>
        <View style={{ flex: 1 }}>
          <Text style={styles.sectionTitle}>App Lock</Text>
          <Text style={styles.optionBody}>Lock entire app with fingerprint/face/device passcode like Google/Signal.</Text>
        </View>
        <Switch
          value={settings.enableAppLock}
          onValueChange={(value) => {
            void onToggleBiometric(value);
          }}
          thumbColor={settings.enableAppLock ? colors.accent : '#8B9ABB'}
          trackColor={{ false: '#32415F', true: '#1C5C7A' }}
        />
      </View>
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  heading: {
    color: colors.textPrimary,
    fontSize: typography.title,
    fontWeight: '800',
  },
  section: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    gap: spacing.sm,
  },
  sectionTitle: {
    color: colors.textPrimary,
    fontSize: typography.bodyLarge,
    fontWeight: '700',
  },
  option: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    gap: 2,
  },
  optionActive: {
    borderColor: colors.accent,
    backgroundColor: '#143A59',
  },
  optionDisabled: {
    opacity: 0.65,
  },
  optionTitle: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '700',
  },
  optionBody: {
    color: colors.textSecondary,
    fontSize: 13,
    lineHeight: 18,
  },
  priorityRow: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
  },
  priorityMain: {
    flex: 1,
    gap: 2,
  },
  reorderControls: {
    gap: spacing.xs,
  },
  reorderButton: {
    minWidth: 38,
    minHeight: 34,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#11283F',
    alignItems: 'center',
    justifyContent: 'center',
  },
  reorderText: {
    color: colors.textPrimary,
    fontWeight: '800',
    fontSize: 16,
  },
  switchRowInline: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  switchCopyArea: {
    flex: 1,
    gap: 2,
  },
  modelCard: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  modelOptionWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
  },
  modelChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: '#11283F',
    paddingHorizontal: 10,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modelChipActive: {
    borderColor: colors.accent,
    backgroundColor: '#143A59',
  },
  providerSlotRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  slotChip: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.sm,
    backgroundColor: colors.surfaceMuted,
    paddingHorizontal: 10,
    minHeight: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  slotChipActive: {
    borderColor: colors.accent,
    backgroundColor: '#143A59',
  },
  slotChipText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  guideTitle: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '700',
  },
  linkButton: {
    minHeight: 40,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.accent,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#11283F',
  },
  linkText: {
    color: colors.accent,
    fontWeight: '700',
    fontSize: 13,
  },
  input: {
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: '#0F182B',
    color: colors.textPrimary,
    paddingHorizontal: 12,
  },
  secondaryButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryText: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButton: {
    minHeight: 48,
    borderRadius: radii.sm,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.md,
  },
  primaryText: {
    color: '#032237',
    fontWeight: '800',
    textAlign: 'center',
  },
  dangerButton: {
    flex: 1,
    minHeight: 48,
    borderRadius: radii.sm,
    borderWidth: 1,
    borderColor: colors.danger,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2B141B',
  },
  dangerText: {
    color: colors.danger,
    fontWeight: '800',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  statusText: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  switchRow: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
});
