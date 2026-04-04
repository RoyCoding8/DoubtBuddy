export const STORAGE_VERSION = 'v2' as const;

const NAMESPACE = 'doubtbuddy';

export const STORAGE_KEYS = {
  settingsV2: `${NAMESPACE}:settings:${STORAGE_VERSION}`,
  doubtRecordsV2: `${NAMESPACE}:doubtRecords:${STORAGE_VERSION}`,
  studySessionsV2: `${NAMESPACE}:studySessions:${STORAGE_VERSION}`,
  practiceSetsV2: `${NAMESPACE}:practiceSets:${STORAGE_VERSION}`,
  practiceAttemptsV2: `${NAMESPACE}:practiceAttempts:${STORAGE_VERSION}`,
  revisionCardsV2: `${NAMESPACE}:revisionCards:${STORAGE_VERSION}`,
  progressSnapshotsV2: `${NAMESPACE}:progressSnapshots:${STORAGE_VERSION}`,
  inferenceEventsV2: `${NAMESPACE}:inferenceEvents:${STORAGE_VERSION}`,
  reportedIssuesV2: `${NAMESPACE}:reportedIssues:${STORAGE_VERSION}`,
  offlineQueueV2: `${NAMESPACE}:offlineQueue:${STORAGE_VERSION}`,
} as const;

export const LEGACY_STORAGE_KEYS = {
  settingsV1: `${NAMESPACE}:settings:v1`,
  historyV1: `${NAMESPACE}:history:v1`,
  studySessionsV1: `${NAMESPACE}:studySessions:v1`,
} as const;
