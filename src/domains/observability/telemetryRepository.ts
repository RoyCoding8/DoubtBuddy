import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../../storage/keys';
import { InferenceEvent } from './types';

const DEFAULT_MAX_EVENTS = 500;

const parseEvents = (raw: string | null): InferenceEvent[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as InferenceEvent[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

export interface TelemetryRepository {
  listEvents(): Promise<InferenceEvent[]>;
  appendEvent(event: InferenceEvent): Promise<void>;
  clearEvents(): Promise<void>;
}

export class AsyncStorageTelemetryRepository implements TelemetryRepository {
  private readonly maxEvents: number;

  constructor(maxEvents = DEFAULT_MAX_EVENTS) {
    this.maxEvents = maxEvents;
  }

  async listEvents(): Promise<InferenceEvent[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.inferenceEventsV2);
    return parseEvents(raw);
  }

  async appendEvent(event: InferenceEvent): Promise<void> {
    const events = await this.listEvents();
    const next = [...events, event];
    const trimmed = next.slice(-this.maxEvents);
    await AsyncStorage.setItem(STORAGE_KEYS.inferenceEventsV2, JSON.stringify(trimmed));
  }

  async clearEvents(): Promise<void> {
    await AsyncStorage.removeItem(STORAGE_KEYS.inferenceEventsV2);
  }
}

export const createDefaultTelemetryRepository = (): TelemetryRepository => new AsyncStorageTelemetryRepository();
