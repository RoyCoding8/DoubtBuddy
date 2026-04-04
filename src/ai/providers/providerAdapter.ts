import { ProviderAdapter as IProviderAdapter, SolveRequest, SolveResponse } from '../contracts/aiContracts';
import { NormalizedProviderError } from '../contracts/aiErrors';

export type ProviderHealthStatus = {
  ok: boolean;
  latencyMs: number;
  errorCode?: NormalizedProviderError['code'];
};

export type GenerateHandler = (req: SolveRequest, signal: AbortSignal) => Promise<SolveResponse>;
export type StreamHandler = (req: SolveRequest, signal: AbortSignal) => AsyncGenerator<string>;

export interface ProviderAdapter extends IProviderAdapter {}
