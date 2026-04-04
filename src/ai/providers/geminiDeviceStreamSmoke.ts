import { Platform } from 'react-native';

import { defaultAppSettings } from '../../types/settings';
import { streamGeminiText } from '../../services/gemini';
import { SolveRequest } from '../contracts/aiContracts';
import { GeminiAdapter } from './geminiAdapter';

const SMOKE_PREFIX = '[GEMINI_DEVICE_SMOKE]';
const EXPECTED_SEMANTIC_TEXT = "Newton's 2nd law: F = m*a";

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const encodeChunk = (value: string): Uint8Array => {
  if (typeof TextEncoder === 'function') {
    return new TextEncoder().encode(value);
  }

  const bytes = Array.from(value).map((char) => char.charCodeAt(0));
  return new Uint8Array(bytes);
};

const toSseStream = (events: string[]): ReadableStream<Uint8Array> =>
  new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of events) {
        controller.enqueue(encodeChunk(chunk));
      }
      controller.close();
    },
  });

const createSseResponse = (events: string[]): Response => {
  const stream = toSseStream(events);

  // Expo/RN runtimes can expose fetch + ReadableStream but still return a Response
  // with `body === null` when constructed with a custom stream. Keep smoke scoped and
  // provide a response-like fallback so adapter.stream can still validate SSE parsing.
  try {
    const response = new Response(stream, {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
      },
    });

    if (response.body) {
      return response;
    }
  } catch {
    // fall through to response-like fallback
  }

  return {
    ok: true,
    status: 200,
    headers: new Headers({
      'Content-Type': 'text/event-stream',
    }),
    body: stream,
    text: async () => events.join(''),
    json: async () => ({}),
  } as Response;
};

const createMockStreamingFetch = (label: string): typeof fetch =>
  (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    assert(url.includes(':streamGenerateContent?alt=sse&key='), `${label}: expected Gemini stream endpoint URL`);
    assert(init?.method === 'POST', `${label}: expected POST method`);
    assert(typeof init?.body === 'string', `${label}: expected JSON body`);

    const payload = JSON.parse(String(init?.body)) as {
      generationConfig?: { maxOutputTokens?: number };
      contents?: Array<{ parts?: Array<{ text?: string }> }>;
    };

    assert(payload.generationConfig?.maxOutputTokens === 1400, `${label}: expected maxOutputTokens=1400`);
    assert(
      typeof payload.contents?.[0]?.parts?.[0]?.text === 'string' && payload.contents[0].parts[0].text.length > 0,
      `${label}: expected prompt text in first content part`,
    );

    const sseChunks = [
      'data: {"candidates":[{"content":{"parts":[{"text":"Newton\'s 2nd"}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":" law:"}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":" F = m*a"}]}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    return createSseResponse(sseChunks);
  }) as typeof fetch;

const collectStream = async (iterator: AsyncGenerator<string>): Promise<{ deltas: string[]; finalText: string }> => {
  const deltas: string[] = [];

  for await (const delta of iterator) {
    deltas.push(delta);
  }

  return {
    deltas,
    finalText: deltas.join(''),
  };
};

const toSemanticFingerprint = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9=*]+/g, '')
    .trim();

const assertMeaningfulStreamResult = (
  label: 'adapter' | 'bridge',
  result: { deltas: string[]; finalText: string },
): void => {
  assert(result.deltas.length > 0, `${label}: expected at least one streamed delta`);
  assert(result.deltas.some((delta) => delta.length > 0), `${label}: expected non-empty streamed delta`);

  const expected = toSemanticFingerprint(EXPECTED_SEMANTIC_TEXT);
  const actual = toSemanticFingerprint(result.finalText);
  assert(actual.includes(expected), `${label}: semantic final text mismatch`);

  console.log(
    `${SMOKE_PREFIX} ${label} semantic`,
    JSON.stringify({
      expected,
      actual,
      containsExpected: actual.includes(expected),
      deltaCount: result.deltas.length,
    }),
  );
};

const buildSolveRequest = (): SolveRequest => ({
  requestId: 'device-stream-smoke-1',
  prompt: {
    system: 'You are a concise physics tutor.',
    user: 'State Newton\'s second law in one line.',
  },
  mode: 'quick_answer',
  qualityMode: 'balanced',
  sessionContext: [
    {
      role: 'user',
      text: 'We are revising mechanics.',
    },
  ],
});

export const runGeminiDeviceStreamSmoke = async (): Promise<void> => {
  const responseCtorStreamBodyAvailable = (() => {
    try {
      return !!new Response(toSseStream(['data: [DONE]\n\n'])).body;
    } catch {
      return false;
    }
  })();

  const environment = {
    platform: Platform.OS,
    hasFetch: typeof fetch === 'function',
    hasReadableStream: typeof ReadableStream === 'function',
    hasTextDecoder: typeof TextDecoder === 'function',
    hasTextEncoder: typeof TextEncoder === 'function',
    responseCtorStreamBodyAvailable,
  };

  console.log(`${SMOKE_PREFIX} environment`, JSON.stringify(environment));

  const adapter = new GeminiAdapter({
    model: 'gemini-2.5-flash',
    apiKeyResolver: async () => 'smoke-test-key',
    fetchImpl: createMockStreamingFetch('adapter'),
  });

  const adapterResult = await collectStream(adapter.stream!(buildSolveRequest(), new AbortController().signal));
  assertMeaningfulStreamResult('adapter', adapterResult);
  console.log(`${SMOKE_PREFIX} adapter.stream deltas`, JSON.stringify(adapterResult.deltas));
  console.log(`${SMOKE_PREFIX} adapter.stream final`, adapterResult.finalText);

  const bridgeResult = await collectStream(
    streamGeminiText({
      systemPrompt: 'You are a concise physics tutor.',
      userPrompt: "State Newton's second law in one line.",
      apiKey: 'smoke-test-key',
      settings: {
        ...defaultAppSettings,
        geminiModel: 'gemini-2.5-flash',
      },
      signal: new AbortController().signal,
      fetchImpl: createMockStreamingFetch('bridge'),
    }),
  );

  assertMeaningfulStreamResult('bridge', bridgeResult);
  console.log(`${SMOKE_PREFIX} services/gemini bridge deltas`, JSON.stringify(bridgeResult.deltas));
  console.log(`${SMOKE_PREFIX} services/gemini bridge final`, bridgeResult.finalText);

  console.log(`${SMOKE_PREFIX} PASS`);
};
