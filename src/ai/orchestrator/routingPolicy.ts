import { RoutingPolicyEngine } from '../contracts/aiContracts';
import { AppSettingsV2, ProviderId, QualityMode, defaultProviderPriority } from '../../types/settings';

type ProviderHealthInput = Record<ProviderId, { available: boolean; failureRate: number }>;

const MODE_PROVIDER_WEIGHT: Record<QualityMode, Record<ProviderId, number>> = {
  fast: {
    gemini: 0,
    openrouter: 4,
    huggingface: 20,
    local_template: 12,
  },
  balanced: {
    gemini: 0,
    openrouter: 0,
    huggingface: 0,
    local_template: 0,
  },
  high_accuracy: {
    gemini: 0,
    openrouter: 3,
    huggingface: 8,
    local_template: 25,
  },
};

const getPriorityOrder = (settings: AppSettingsV2): ProviderId[] => {
  const uniqueConfigured = settings.providerPriority.filter(
    (providerId, index, source) => source.indexOf(providerId) === index,
  );

  const missingDefaults = defaultProviderPriority.filter((providerId) => !uniqueConfigured.includes(providerId));
  return [...uniqueConfigured, ...missingDefaults];
};

const isProviderEnabledBySettings = (providerId: ProviderId, settings: AppSettingsV2): boolean => {
  if (providerId === 'openrouter') {
    return settings.featureFlags.openRouterEnabled;
  }

  if (providerId === 'huggingface') {
    return settings.featureFlags.huggingFaceEnabled;
  }

  return true;
};

export class DefaultRoutingPolicyEngine implements RoutingPolicyEngine {
  selectProviders(input: {
    settings: AppSettingsV2;
    qualityMode: QualityMode;
    health: ProviderHealthInput;
  }): ProviderId[] {
    const orderedByPriority = getPriorityOrder(input.settings);
    const qualityWeight = MODE_PROVIDER_WEIGHT[input.qualityMode];

    return orderedByPriority
      .filter((providerId) => isProviderEnabledBySettings(providerId, input.settings))
      .filter((providerId) => input.health[providerId]?.available ?? false)
      .map((providerId, priorityIndex) => {
        const failureRate = input.health[providerId]?.failureRate ?? 0;
        const healthPenalty = Math.round(Math.max(0, failureRate) * 400);
        const modePenalty = qualityWeight[providerId] ?? 0;

        return {
          providerId,
          score: priorityIndex * 100 + modePenalty + healthPenalty,
          priorityIndex,
        };
      })
      .sort((left, right) => {
        if (left.score !== right.score) {
          return left.score - right.score;
        }

        return left.priorityIndex - right.priorityIndex;
      })
      .map((entry) => entry.providerId);
  }
}

export const routingPolicyEngine = new DefaultRoutingPolicyEngine();
