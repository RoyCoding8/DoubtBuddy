import { InferenceEvent } from './types';
import {
  TelemetryRepository,
  createDefaultTelemetryRepository,
} from './telemetryRepository';

export interface TelemetrySink {
  recordInferenceAttempt(event: InferenceEvent): Promise<void>;
}

export interface TelemetryService extends TelemetrySink {
  getEvents(): Promise<InferenceEvent[]>;
  clearEvents(): Promise<void>;
}

export class DefaultTelemetryService implements TelemetryService {
  private readonly repository: TelemetryRepository;

  constructor(repository?: TelemetryRepository) {
    this.repository = repository ?? createDefaultTelemetryRepository();
  }

  async recordInferenceAttempt(event: InferenceEvent): Promise<void> {
    await this.repository.appendEvent(event);
  }

  async getEvents(): Promise<InferenceEvent[]> {
    return this.repository.listEvents();
  }

  async clearEvents(): Promise<void> {
    await this.repository.clearEvents();
  }
}

export const createDefaultTelemetryService = (): TelemetryService => new DefaultTelemetryService();
