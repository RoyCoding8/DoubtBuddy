import AsyncStorage from '@react-native-async-storage/async-storage';

import { STORAGE_KEYS } from '../../storage/keys';
import { ReportedSolutionIssue } from '../observability/types';

const parseJsonArray = <T>(raw: string | null): T[] => {
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
};

export interface DoubtRepository {
  listReportedSolutionIssues(): Promise<ReportedSolutionIssue[]>;
  appendReportedSolutionIssue(issue: ReportedSolutionIssue): Promise<void>;
  verifyReportedIssueTraceLink(issueId: string, traceId: string): Promise<boolean>;
}

export class AsyncStorageDoubtRepository implements DoubtRepository {
  async listReportedSolutionIssues(): Promise<ReportedSolutionIssue[]> {
    const raw = await AsyncStorage.getItem(STORAGE_KEYS.reportedIssuesV2);
    return parseJsonArray<ReportedSolutionIssue>(raw);
  }

  async appendReportedSolutionIssue(issue: ReportedSolutionIssue): Promise<void> {
    const existing = await this.listReportedSolutionIssues();
    await AsyncStorage.setItem(STORAGE_KEYS.reportedIssuesV2, JSON.stringify([issue, ...existing]));
  }

  async verifyReportedIssueTraceLink(issueId: string, traceId: string): Promise<boolean> {
    const existing = await this.listReportedSolutionIssues();
    const matched = existing.find((item) => item.id === issueId);
    return matched?.traceId === traceId;
  }
}

export const createDefaultDoubtRepository = (): DoubtRepository => new AsyncStorageDoubtRepository();
