import { GeminiAdapter } from './geminiAdapter';
import { streamGeminiText } from '../../services/gemini';
import { SolveRequest } from '../contracts/aiContracts';
import { defaultAppSettings } from '../../types/settings';

const assert = (condition: unknown, message: string): void => {
  if (!condition) {
    throw new Error(message);
  }
};

const toSseStream = (events: string[]): ReadableStream<Uint8Array> => {
  const encoder = new TextEncoder();

  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of events) {
        controller.enqueue(encoder.encode(chunk));
      }
      controller.close();
    },
  });
};

const createMockStreamingFetch = (label: string): typeof fetch =>
  (async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = String(input);
    assert(url.includes(':streamGenerateContent?alt=sse&key='), `${label}: expected Gemini stream endpoint URL`);
    assert(init?.method === 'POST', `${label}: expected POST method`);
    assert(typeof init?.body === 'string', `${label}: expected JSON body`);

    const body = JSON.parse(String(init?.body)) as {
      generationConfig?: { maxOutputTokens?: number };
      contents?: Array<{ parts?: Array<{ text?: string }> }>;
    };

    assert(body.generationConfig?.maxOutputTokens === 1400, `${label}: expected maxOutputTokens=1400`);
    assert(
      typeof body.contents?.[0]?.parts?.[0]?.text === 'string' && body.contents[0].parts[0].text.length > 0,
      `${label}: expected prompt text in first content part`,
    );

    const sseChunks = [
      'data: {"candidates":[{"content":{"parts":[{"text":"Newton\'s 2nd"}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"Newton\'s 2nd law:"}]}}]}\n\n',
      'data: {"candidates":[{"content":{"parts":[{"text":"Newton\'s 2nd law: F = m·a"}]}}]}\n\n',
      'data: [DONE]\n\n',
    ];

    return new Response(toSseStream(sseChunks), {
      status: 200,
      headers: {
        'Content-Type': 'text/event-stream',
      },
    });
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

const buildSolveRequest = (): SolveRequest => ({
  requestId: 'stream-smoke-1',
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

const runAdapterStreamSmoke = async (): Promise<void> => {
  const adapter = new GeminiAdapter({
    model: 'gemini-2.5-flash',
    apiKeyResolver: async () => 'smoke-test-key',
    fetchImpl: createMockStreamingFetch('adapter'),
  });

  const result = await collectStream(adapter.stream!(buildSolveRequest(), new AbortController().signal));

  assert(result.deltas.length === 3, 'adapter: expected 3 streamed deltas');
  assert(result.finalText === "Newton's 2nd law: F = m·a", 'adapter: final text mismatch');

  console.log('adapter.stream deltas:', JSON.stringify(result.deltas));
  console.log('adapter.stream final:', result.finalText);
};

const runLegacyBridgeStreamSmoke = async (): Promise<void> => {
  const bridgeFetch = createMockStreamingFetch('bridge');
  const adapterStream = streamGeminiText({
    systemPrompt: 'You are a concise physics tutor.',
    userPrompt: "State Newton's second law in one line.",
    apiKey: 'smoke-test-key',
    settings: {
      ...defaultAppSettings,
      geminiModel: 'gemini-2.5-flash',
    },
    signal: new AbortController().signal,
    fetchImpl: bridgeFetch,
  });

  const deltas: string[] = [];
  for await (const delta of adapterStream) {
    deltas.push(delta);
  }

  const finalText = deltas.join('');
  assert(deltas.length === 3, 'bridge: expected 3 streamed deltas');
  assert(finalText === "Newton's 2nd law: F = m·a", 'bridge: final text mismatch');

  console.log('services/gemini bridge deltas:', JSON.stringify(deltas));
  console.log('services/gemini bridge final:', finalText);
};

const main = async (): Promise<void> => {
  console.log('Runtime smoke environment:', JSON.stringify({
    node: process.version,
    hasFetch: typeof fetch === 'function',
    hasReadableStream: typeof ReadableStream === 'function',
    hasTextDecoder: typeof TextDecoder === 'function',
  }));

  await runAdapterStreamSmoke();
  await runLegacyBridgeStreamSmoke();

  console.log('PASS: gemini streaming smoke test (device-like runtime simulation)');
};

main().catch((error) => {
  const message = error instanceof Error ? error.message : String(error);
  console.error('FAIL: gemini streaming smoke test');
  console.error(message);
  process.exit(1);
});
