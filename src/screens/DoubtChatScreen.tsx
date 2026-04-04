import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { File } from 'expo-file-system';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { KeyConceptCard } from '../components/KeyConceptCard';
import { MarkdownMathView } from '../components/MarkdownMathView';
import { ScreenContainer } from '../components/ScreenContainer';
import { SolveModeSelector } from '../components/SolveModeSelector';
import { colors, radii, spacing, typography } from '../constants/theme';
import { useDoubtHistory } from '../hooks/DoubtHistoryContext';
import { useAppSettings } from '../hooks/SettingsContext';
import { useStudySession } from '../hooks/StudySessionContext';
import { prepareImageForGemini } from '../services/image';
import { StudyStackParamList } from '../navigation/types';
import { createId } from '../utils/ids';
import { syllabusData } from '../constants/syllabus';
import { DoubtRecord, DoubtRequest, SolveMode } from '../types/doubt';
import { getSubjectLabel } from '../utils/formatters';
import { solveDoubt } from '../domains/doubt/doubtService';
import { createDefaultDoubtRepository } from '../domains/doubt/doubtRepository';
import { logTask11EvidenceStartup, logTask11SaveSnapshot } from '../domains/doubt/task11EvidenceLogger';
import {
  checkInternetConnectivity,
  enqueueOfflineTextSolve,
  getOfflineQueueCount,
  isLikelyOfflineError,
  replayOfflineTextQueue,
} from '../domains/doubt/offlineQueueService';
import {
  logTask12ContextBeforeSolve,
  logTask12EvidenceStartup,
  logTask12FollowUpSaveAppend,
  logTask12ResetCompleted,
} from '../domains/doubt/task12EvidenceLogger';
import { logTask19ConfidenceRendered, logTask19ReportActionSaved } from '../domains/doubt/task19EvidenceLogger';

type Props = NativeStackScreenProps<StudyStackParamList, 'DoubtChat'>;

const HOTFIX_MATH_QA_SAMPLE =
  'Inline check: For $x^2 + y^2 = z^2$, substitute $x=3$ and $y=4$ to get $z=5$.\n\nDisplay check:\n$$\\int_0^1 x^2 \\, dx = \\frac{1}{3}$$';

const extractKeyConcept = (content: string): string => {
  const marker = /\*\*Key Concept\*\*\s*([\s\S]+)/i.exec(content);
  if (!marker) {
    return 'Revise chapter fundamentals, set equations carefully, and verify final units.';
  }
  return marker[1].trim().slice(0, 220);
};

const renderPreviewInlineMarkdown = (content: string) => {
  const segments = content
    .split(/(`[^`\n]+`|\*\*[^*]+\*\*|\*[^*\n]+\*|_[^_\n]+_)/g)
    .filter((segment) => segment.length > 0);

  return segments.map((segment, index) => {
    const isCode = segment.startsWith('`') && segment.endsWith('`') && segment.length > 2;
    const isBold = segment.startsWith('**') && segment.endsWith('**') && segment.length > 4;
    const isItalicStar = segment.startsWith('*') && segment.endsWith('*') && !isBold && segment.length > 2;
    const isItalicUnderscore = segment.startsWith('_') && segment.endsWith('_') && segment.length > 2;
    const isItalic = isItalicStar || isItalicUnderscore;

    const value = isCode
      ? segment.slice(1, -1)
      : isBold
        ? segment.slice(2, -2)
        : isItalic
          ? segment.slice(1, -1)
          : segment;

    const textStyle = isCode
      ? styles.sessionPreviewCode
      : isBold
        ? styles.sessionPreviewBold
        : isItalic
          ? styles.sessionPreviewItalic
          : undefined;

    return (
      <Text key={`preview-segment-${index}`} style={textStyle}>
        {value}
      </Text>
    );
  });
};

export const DoubtChatScreen = ({ route }: Props) => {
  const [text, setText] = useState(route.params.historyRecord?.questionText ?? '');
  const [mode, setMode] = useState<SolveMode>('step_by_step');
  const [isBusy, setIsBusy] = useState(false);
  const [responseMarkdown, setResponseMarkdown] = useState(route.params.historyRecord?.responseMarkdown ?? '');
  const [capturedImageUri, setCapturedImageUri] = useState<string | null>(null);
  const [capturedImageMimeType, setCapturedImageMimeType] = useState<string | undefined>(undefined);
  const [selectedAssistantTurnIndex, setSelectedAssistantTurnIndex] = useState<number | null>(null);
  const [isUserPreviewExpanded, setIsUserPreviewExpanded] = useState(false);
  const [isAssistantPreviewExpanded, setIsAssistantPreviewExpanded] = useState(false);
  const [sourceModel, setSourceModel] = useState<string>('');
  const [imageInfoTag, setImageInfoTag] = useState<string>('');
  const [queueStatus, setQueueStatus] = useState<string>('');
  const [responseConfidence, setResponseConfidence] = useState<DoubtRecord['confidence'] | null>(
    route.params.historyRecord?.confidence ?? null,
  );
  const [verificationNote, setVerificationNote] = useState<string | undefined>(route.params.historyRecord?.verificationNote);
  const [latestInference, setLatestInference] = useState<DoubtRecord['inference'] | null>(
    route.params.historyRecord?.inference ?? null,
  );
  const [lastSolvedQuestionText, setLastSolvedQuestionText] = useState<string>(route.params.historyRecord?.questionText ?? '');
  const [reportStatus, setReportStatus] = useState<string>('');
  const { addRecord } = useDoubtHistory();
  const { settings, hasAnyEnabledProviderKey, setHasApiKey } = useAppSettings();
  const { getSessionContext, appendExchange, resetSession, turnLimit } = useStudySession();
  const doubtRepository = useMemo(() => createDefaultDoubtRepository(), []);
  const showHotfixMathQa = process.env.EXPO_PUBLIC_HOTFIX_MATH_QA === '1';
  const isReplayingQueueRef = useRef(false);

  const subject = syllabusData.find((item) => item.id === route.params.subjectId);
  const chapter = subject?.chapters.find((item) => item.id === route.params.chapterId);

  const contextLabel = `${getSubjectLabel(route.params.subjectId)} > ${chapter?.name ?? route.params.chapterId}${
    route.params.topic ? ` > ${route.params.topic}` : ''
  }`;

  const sessionScope = useMemo(
    () => ({
      subjectId: route.params.subjectId,
      chapterId: route.params.chapterId,
      topic: route.params.topic,
    }),
    [route.params.chapterId, route.params.subjectId, route.params.topic],
  );

  const sessionTurns = getSessionContext(sessionScope);
  const priorTurnCount = sessionTurns.length;
  const assistantPreviewTurns = useMemo(
    () => sessionTurns.map((turn, index) => ({ turn, index })).filter((entry) => entry.turn.role === 'assistant'),
    [sessionTurns],
  );
  const assistantPreviewCount = assistantPreviewTurns.length;
  const hasSessionNavigator = assistantPreviewCount > 0;

  useEffect(() => {
    if (!hasSessionNavigator) {
      setSelectedAssistantTurnIndex(null);
      return;
    }

    setSelectedAssistantTurnIndex((current) => {
      if (typeof current === 'number' && current >= 0 && current < assistantPreviewCount) {
        return current;
      }

      return assistantPreviewCount - 1;
    });
  }, [assistantPreviewCount, hasSessionNavigator]);

  useEffect(() => {
    setIsUserPreviewExpanded(false);
    setIsAssistantPreviewExpanded(false);
  }, [selectedAssistantTurnIndex]);

  const selectedAssistantEntry =
    typeof selectedAssistantTurnIndex === 'number' &&
    selectedAssistantTurnIndex >= 0 &&
    selectedAssistantTurnIndex < assistantPreviewCount
      ? assistantPreviewTurns[selectedAssistantTurnIndex]
      : null;
  const selectedUserTurn = selectedAssistantEntry
    ? sessionTurns
        .slice(0, selectedAssistantEntry.index)
        .reverse()
        .find((turn) => turn.role === 'user')
    : null;
  const selectedAssistantTurn = selectedAssistantEntry?.turn ?? null;
  const selectedAssistantModel = selectedAssistantTurn?.sourceModel?.trim() || 'model unknown';

  const keyConcept = useMemo(() => extractKeyConcept(responseMarkdown), [responseMarkdown]);

  const saveSolvedRecord = async (input: {
    request: DoubtRequest;
    questionText: string;
    responseMarkdownValue: string;
    sourceModelValue: string;
    confidence: 'high' | 'medium' | 'low';
    verificationNote?: string;
    inference: {
      requestId: string;
      provider: 'gemini' | 'openrouter' | 'huggingface' | 'local_template';
      model: string;
      fallbackLevel: number;
      retries: number;
      latencyMs: number;
      status: 'success' | 'fallback' | 'failed';
      errorCode?: string;
    };
  }) => {
    const { request, questionText, responseMarkdownValue, sourceModelValue, confidence, verificationNote, inference } = input;
    const subjectName = syllabusData.find((item) => item.id === request.subjectId)?.name ?? request.subjectId;

    const savedRecord = {
      id: createId('doubt'),
      subjectId: request.subjectId,
      subjectName,
      chapterId: request.chapterId,
      chapterName: request.chapterName,
      topic: request.topic,
      questionText,
      responseMarkdown: responseMarkdownValue,
      createdAt: new Date().toISOString(),
      bookmarked: false,
      confidence,
      verificationNote,
      inference,
      estimatedBytes: 0,
    };

    await addRecord(savedRecord);
    logTask11SaveSnapshot({
      inputType: request.inputType,
      record: savedRecord,
    });

    return {
      sourceModelValue,
      responseMarkdownValue,
    };
  };

  const runOfflineReplay = async () => {
    if (isReplayingQueueRef.current) {
      return;
    }

    isReplayingQueueRef.current = true;
    try {
      const result = await replayOfflineTextQueue({
        isConnected: checkInternetConnectivity,
        replay: async (queuedRequest) => {
          const solved = await solveDoubt({
            request: queuedRequest,
            settings,
            sessionContext: [],
          });

          await saveSolvedRecord({
            request: queuedRequest,
            questionText: queuedRequest.text?.trim() || '[Queued text doubt]',
            responseMarkdownValue: solved.responseMarkdown,
            sourceModelValue: solved.sourceModel,
            confidence: solved.confidence,
            verificationNote: solved.verificationNote,
            inference: solved.inference,
          });
        },
      });

      if (result.replayedCount > 0) {
        setQueueStatus(`Replayed ${result.replayedCount} queued solve${result.replayedCount > 1 ? 's' : ''}.`);
      }
    } finally {
      isReplayingQueueRef.current = false;
    }
  };

  useEffect(() => {
    logTask11EvidenceStartup();
    logTask12EvidenceStartup();
  }, []);

  useEffect(() => {
    if (!responseConfidence || !latestInference?.requestId) {
      return;
    }

    logTask19ConfidenceRendered({
      confidence: responseConfidence,
      disclaimerShown: responseConfidence === 'low',
      traceId: latestInference.requestId,
    });
  }, [latestInference?.requestId, responseConfidence]);

  useEffect(() => {
    void (async () => {
      const count = await getOfflineQueueCount();
      if (count > 0) {
        setQueueStatus(`${count} solve${count > 1 ? 's are' : ' is'} queued for replay.`);
      }
      await runOfflineReplay();
    })();

    const timer = setInterval(() => {
      void runOfflineReplay();
    }, 8000);

    return () => {
      clearInterval(timer);
    };
  }, [settings]);

  const onPickImage = async (source: 'camera' | 'gallery') => {
    const launcher = source === 'camera' ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;

    if (source === 'camera') {
      const cameraPermission = await ImagePicker.requestCameraPermissionsAsync();
      if (!cameraPermission.granted) {
        Alert.alert('Permission needed', 'Camera permission is required to capture a photo.');
        return;
      }
    } else {
      const mediaPermission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!mediaPermission.granted) {
        Alert.alert('Permission needed', 'Media permission is required to pick from gallery.');
        return;
      }
    }

    const result = await launcher({
      mediaTypes: ['images'],
      allowsEditing: false,
      quality: 1,
      base64: false,
      exif: false,
      cameraType: ImagePicker.CameraType.back,
      preferredAssetRepresentationMode: ImagePicker.UIImagePickerPreferredAssetRepresentationMode.Current,
    });

    if (result.canceled || !result.assets?.[0]) {
      return;
    }

    const asset = result.assets[0];
    const prepared = await prepareImageForGemini({
      uri: asset.uri,
      mimeType: asset.mimeType,
    });

    setCapturedImageUri(prepared.uri);
    setCapturedImageMimeType(prepared.mimeType);
    setImageInfoTag(
      prepared.transformed
        ? `Image optimized (${Math.round(prepared.bytes / 1024)} KB)`
        : `Image kept original (${Math.round(prepared.bytes / 1024)} KB)`,
    );
  };

  const onSolve = async () => {
    if (!subject || !chapter) {
      return;
    }

    if (text.trim().length === 0 && !capturedImageUri) {
      Alert.alert('Missing doubt', 'Type your doubt or capture a photo first.');
      return;
    }

    if (!hasAnyEnabledProviderKey) {
      Alert.alert('API key required', 'Please add at least one enabled provider API key in Settings first.');
      return;
    }

    setIsBusy(true);
    setResponseMarkdown('');
    setResponseConfidence(null);
    setVerificationNote(undefined);
    setLatestInference(null);
    setReportStatus('');

    const contextTurnCountBeforeSolve = getSessionContext(sessionScope).length;
    logTask12ContextBeforeSolve(contextTurnCountBeforeSolve);

    const request: DoubtRequest = {
      subjectId: subject.id,
      chapterId: chapter.id,
      chapterName: chapter.name,
      topic: route.params.topic,
      difficultyLevel: 'medium',
      mode,
      inputType: capturedImageUri ? 'image' : 'text',
      text,
      imageMimeType: capturedImageMimeType,
      imageBase64: capturedImageUri ? await new File(capturedImageUri).base64() : undefined,
    };

    try {
      const solved = await solveDoubt({
        request,
        settings,
        sessionContext: getSessionContext(sessionScope),
      });
      setResponseMarkdown(solved.responseMarkdown);
      setSourceModel(solved.sourceModel);
      setQueueStatus('');
      setResponseConfidence(solved.confidence);
      setVerificationNote(solved.verificationNote);
      setLatestInference(solved.inference);
      setLastSolvedQuestionText(text || '[Image doubt] Question submitted by photo');
      setReportStatus('');

      await appendExchange({
        scope: sessionScope,
        userText: text || '[Image doubt] Question submitted by photo',
        assistantText: solved.responseMarkdown,
        sourceModel: solved.sourceModel,
      });
      logTask12FollowUpSaveAppend({
        postAppendTurnCount: Math.min(turnLimit, contextTurnCountBeforeSolve + 2),
      });

      await saveSolvedRecord({
        request,
        questionText: text || '[Image doubt] Question submitted by photo',
        responseMarkdownValue: solved.responseMarkdown,
        sourceModelValue: solved.sourceModel,
        confidence: solved.confidence,
        verificationNote: solved.verificationNote,
        inference: solved.inference,
      });
    } catch (error) {
      if (error instanceof Error && (error.message === 'NO_API_KEY' || /Missing\s+Gemini\s+API\s+key/i.test(error.message))) {
        setHasApiKey(false);
        Alert.alert('API key missing', 'Please add your Gemini API key in Settings.');
        return;
      }

      if (isLikelyOfflineError(error)) {
        if (request.inputType === 'image') {
          const count = await getOfflineQueueCount();
          const status = count > 0 ? `${count} text solve${count > 1 ? 's are' : ' is'} queued.` : 'No queued text solves yet.';
          setQueueStatus(status);
          Alert.alert(
            'Offline: image solve not queued',
            'Image doubts cannot be queued in v1. Please reconnect to submit this image, or send as text to queue for replay.',
          );
          return;
        }

        const enqueueResult = await enqueueOfflineTextSolve(request);
        setQueueStatus(
          `Offline queue updated: ${enqueueResult.queueLength} pending text solve${enqueueResult.queueLength > 1 ? 's' : ''}.`,
        );
        Alert.alert(
          'Queued for replay',
          'You appear offline. Your text doubt was queued and will replay automatically when connectivity returns.',
        );
        return;
      }

      Alert.alert('Error', 'Could not solve now. Please retry in a few seconds.');
    } finally {
      setIsBusy(false);
    }
  };

  const onReportIncorrectSolution = async () => {
    if (!latestInference || !responseMarkdown) {
      Alert.alert('No solved response', 'Solve a doubt first, then report if the solution looks incorrect.');
      return;
    }

    const issueId = createId('issue');

    await doubtRepository.appendReportedSolutionIssue({
      id: issueId,
      createdAt: new Date().toISOString(),
      traceId: latestInference.requestId,
      reason: 'incorrect_solution',
      provider: latestInference.provider,
      model: latestInference.model,
      confidence: responseConfidence ?? 'low',
      questionText: lastSolvedQuestionText || '[Question unavailable]',
      chapterId: route.params.chapterId,
      topic: route.params.topic,
    });

    const traceIdPersistedMatch = await doubtRepository.verifyReportedIssueTraceLink(issueId, latestInference.requestId);
    logTask19ReportActionSaved({
      traceId: latestInference.requestId,
      storedIssueId: issueId,
      traceIdPersistedMatch,
    });

    setReportStatus(`Issue reported with trace ID: ${latestInference.requestId}`);
    Alert.alert('Thanks for reporting', 'We saved this issue and linked it to the solve trace for diagnosis.');
  };

  const confidenceLabel =
    responseConfidence === 'high'
      ? 'High confidence'
      : responseConfidence === 'medium'
        ? 'Medium confidence'
        : responseConfidence === 'low'
          ? 'Low confidence'
          : null;

  return (
    <ScreenContainer>
      <Text style={styles.contextLabel}>{contextLabel}</Text>
      <Text style={styles.sessionHint}>
        Session context active ({priorTurnCount}/8 turns){priorTurnCount > 0 ? ' - follow-up doubts use recent turns.' : ''}
      </Text>
      <Text style={styles.sessionHelpText}>
        Session context means this chapter/topic remembers your recent doubts and solutions, so follow-up questions stay in flow.
      </Text>

      {hasSessionNavigator ? (
        <View style={styles.sessionNavigatorCard}>
          <View style={styles.sessionNavigatorHeader}>
            <Text style={styles.sessionNavigatorTitle}>Recent turn preview</Text>
            <Text style={styles.sessionNavigatorMeta}>
              {selectedAssistantTurnIndex! + 1}/{assistantPreviewCount}
            </Text>
          </View>
          <View style={styles.sessionNavigatorControls}>
            <Pressable
              accessibilityLabel="Previous preview"
              style={styles.sessionNavArrowButton}
              onPress={() => {
                setSelectedAssistantTurnIndex((index) => {
                  if (typeof index !== 'number') {
                    return 0;
                  }

                  return Math.max(0, index - 1);
                });
              }}
              disabled={selectedAssistantTurnIndex === 0}
            >
              <Text style={styles.sessionNavArrowText}>{'‹'}</Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Next preview"
              style={styles.sessionNavArrowButton}
              onPress={() => {
                setSelectedAssistantTurnIndex((index) => {
                  if (typeof index !== 'number') {
                    return assistantPreviewCount - 1;
                  }

                  return Math.min(assistantPreviewCount - 1, index + 1);
                });
              }}
              disabled={selectedAssistantTurnIndex === assistantPreviewCount - 1}
            >
              <Text style={styles.sessionNavArrowText}>{'›'}</Text>
            </Pressable>
          </View>
          {selectedAssistantTurn ? (
            <>
              <View style={styles.sessionPreviewRow}>
                <View style={styles.sessionPreviewRowHeader}>
                  <Text style={styles.sessionPreviewLabel}>You</Text>
                  <Pressable onPress={() => setIsUserPreviewExpanded((expanded) => !expanded)}>
                    <Text style={styles.sessionPreviewToggle}>{isUserPreviewExpanded ? 'Collapse' : 'Expand'}</Text>
                  </Pressable>
                </View>
                <Text style={styles.sessionPreviewText} numberOfLines={isUserPreviewExpanded ? undefined : 2}>
                  {renderPreviewInlineMarkdown(selectedUserTurn?.text ?? 'No user message available for this turn.')}
                </Text>
              </View>

              <View style={styles.sessionPreviewRow}>
                <View style={styles.sessionPreviewRowHeader}>
                  <Text style={styles.sessionPreviewLabel}>Assistant</Text>
                  <Pressable onPress={() => setIsAssistantPreviewExpanded((expanded) => !expanded)}>
                    <Text style={styles.sessionPreviewToggle}>{isAssistantPreviewExpanded ? 'Collapse' : 'Expand'}</Text>
                  </Pressable>
                </View>
                <Text style={styles.sessionPreviewText} numberOfLines={isAssistantPreviewExpanded ? undefined : 3}>
                  {renderPreviewInlineMarkdown(selectedAssistantTurn.text)}
                </Text>
              </View>

              <Text style={styles.sessionNavigatorModelMeta}>Model: {selectedAssistantModel}</Text>
            </>
          ) : null}
        </View>
      ) : null}
      <Text style={styles.heading}>Ask your doubt</Text>

      <TextInput
        value={text}
        onChangeText={setText}
        style={styles.input}
        placeholder="Ask your doubt"
        placeholderTextColor={colors.textSecondary}
        multiline
      />

      <SolveModeSelector selectedMode={mode} onChange={setMode} />

      <View style={styles.actionsRow}>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void onPickImage('camera');
          }}
        >
          <Text style={styles.secondaryText}>{capturedImageUri ? 'Retake Photo' : 'Take Photo'}</Text>
        </Pressable>
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            void onPickImage('gallery');
          }}
        >
          <Text style={styles.secondaryText}>From Gallery</Text>
        </Pressable>
        <Pressable style={styles.primaryButton} onPress={onSolve}>
          {isBusy ? <ActivityIndicator color="#042033" /> : <Text style={styles.primaryText}>Solve</Text>}
        </Pressable>
      </View>

      <Pressable
        style={[styles.secondaryButton, styles.resetButton]}
        onPress={() => {
          Alert.alert('Reset doubt session?', 'This clears the last 8-turn context for this chapter/topic.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Reset',
              style: 'destructive',
              onPress: () => {
                void (async () => {
                  await resetSession(sessionScope);
                  setSelectedAssistantTurnIndex(null);
                  logTask12ResetCompleted(0);
                })();
              },
            },
          ]);
        }}
      >
        <Text style={styles.secondaryText}>Reset Session Context</Text>
      </Pressable>

      {sourceModel ? <Text style={styles.modelTag}>Model: {sourceModel}</Text> : null}
      {capturedImageUri ? <Text style={styles.modelTag}>{imageInfoTag}</Text> : null}
      {queueStatus ? <Text style={styles.queueStatusTag}>{queueStatus}</Text> : null}
      {confidenceLabel ? (
        <View
          style={[
            styles.confidenceBadge,
            responseConfidence === 'high'
              ? styles.confidenceHigh
              : responseConfidence === 'medium'
                ? styles.confidenceMedium
                : styles.confidenceLow,
          ]}
        >
          <Text style={styles.confidenceBadgeText}>{confidenceLabel}</Text>
        </View>
      ) : null}
      {verificationNote ? <Text style={styles.verificationNote}>{verificationNote}</Text> : null}
      {responseConfidence === 'low' ? (
        <Text style={styles.lowConfidenceDisclaimer}>
          This answer has low confidence and may be partially unverified. Please cross-check key steps before relying on it.
        </Text>
      ) : null}

      {showHotfixMathQa ? (
        <Pressable
          style={styles.secondaryButton}
          onPress={() => {
            setResponseMarkdown(HOTFIX_MATH_QA_SAMPLE);
            setSourceModel('hotfix-math-qa-sample');
          }}
        >
          <Text style={styles.secondaryText}>Load Math Render QA Sample</Text>
        </Pressable>
      ) : null}

      <MarkdownMathView markdown={responseMarkdown} />
      <KeyConceptCard concept={keyConcept} />

      <Pressable
        style={styles.secondaryButton}
        onPress={() => {
          void Clipboard.setStringAsync(responseMarkdown);
        }}
      >
        <Text style={styles.secondaryText}>Copy Solution</Text>
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={() => void onReportIncorrectSolution()}>
        <Text style={styles.secondaryText}>Report Incorrect Solution</Text>
      </Pressable>
      {latestInference?.requestId ? <Text style={styles.traceTag}>Trace ID: {latestInference.requestId}</Text> : null}
      {reportStatus ? <Text style={styles.reportStatusTag}>{reportStatus}</Text> : null}
    </ScreenContainer>
  );
};

const styles = StyleSheet.create({
  contextLabel: {
    color: colors.accent,
    fontSize: typography.body,
    fontWeight: '600',
  },
  heading: {
    color: colors.textPrimary,
    fontSize: typography.heading,
    fontWeight: '800',
  },
  input: {
    minHeight: 120,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.textPrimary,
    padding: spacing.md,
    textAlignVertical: 'top',
    fontSize: typography.body,
    lineHeight: 20,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  primaryButton: {
    flex: 1,
    minHeight: 52,
    borderRadius: radii.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryText: {
    color: '#042033',
    fontSize: typography.bodyLarge,
    fontWeight: '800',
  },
  secondaryButton: {
    minHeight: 52,
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  secondaryText: {
    color: colors.textPrimary,
    fontSize: typography.body,
    fontWeight: '700',
  },
  modelTag: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  queueStatusTag: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  confidenceBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
  },
  confidenceHigh: {
    borderColor: '#2E7D32',
    backgroundColor: '#17331D',
  },
  confidenceMedium: {
    borderColor: '#B28704',
    backgroundColor: '#322A12',
  },
  confidenceLow: {
    borderColor: '#C62828',
    backgroundColor: '#371B1B',
  },
  confidenceBadgeText: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '800',
  },
  verificationNote: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  lowConfidenceDisclaimer: {
    color: '#FFB4B4',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '600',
  },
  traceTag: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  reportStatusTag: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  sessionHint: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  sessionHelpText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  sessionNavigatorCard: {
    borderRadius: radii.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    padding: spacing.sm,
    gap: spacing.sm,
  },
  sessionNavigatorHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionNavigatorTitle: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  sessionNavigatorMeta: {
    color: colors.textSecondary,
    fontSize: 12,
  },
  sessionNavigatorControls: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  sessionNavArrowButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sessionNavArrowText: {
    color: colors.textPrimary,
    fontSize: 14,
    fontWeight: '800',
    lineHeight: 16,
  },
  sessionPreviewRow: {
    gap: 4,
  },
  sessionPreviewRowHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionPreviewLabel: {
    color: colors.textPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  sessionPreviewToggle: {
    color: colors.accent,
    fontSize: 12,
    fontWeight: '700',
  },
  sessionPreviewText: {
    color: colors.textSecondary,
    fontSize: 12,
    lineHeight: 16,
  },
  sessionPreviewBold: {
    color: colors.textPrimary,
    fontWeight: '700',
  },
  sessionPreviewItalic: {
    fontStyle: 'italic',
  },
  sessionPreviewCode: {
    fontFamily: 'monospace',
    backgroundColor: '#1E2329',
    color: colors.textPrimary,
  },
  sessionNavigatorModelMeta: {
    color: colors.textSecondary,
    fontSize: 11,
  },
  resetButton: {
    alignSelf: 'flex-start',
  },
});
