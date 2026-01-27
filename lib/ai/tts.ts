import 'server-only';

import { callWithRetry, getGeminiClient } from '@/lib/ai/grading-utils';

// === Config ===
const MODEL_NAME = 'gemini-2.5-flash-tts';
const LANGUAGE_CODE = 'la-VA';
const VOICE_NAME = 'Charon';
const TIMEOUT_MS = 8000;

// === Circuit Breaker ===
// State machine: CLOSED -> OPEN (after 5 failures) -> HALF_OPEN (after 60s)
// HALF_OPEN: single trial call - success -> CLOSED, failure -> OPEN
let consecutiveFailures = 0;
const FAILURE_THRESHOLD = 5;
const OPEN_CIRCUIT_RESET_MS = 60000;
let lastFailureTime = 0;

function isCircuitOpen(): boolean {
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    if (Date.now() - lastFailureTime > OPEN_CIRCUIT_RESET_MS) {
      return false; // Half-open: try again
    }
    return true;
  }
  return false;
}

function recordSuccess() {
  consecutiveFailures = 0;
}

function recordFailure() {
  consecutiveFailures++;
  lastFailureTime = Date.now();
}

export async function generateLatinAudio(text: string): Promise<Uint8Array> {
  if (!text?.trim()) {
    throw new Error('Text is required for TTS');
  }

  if (isCircuitOpen()) {
    console.warn('TTS circuit breaker open - skipping AI call');
    throw new Error('TTS circuit breaker open');
  }

  const ai = getGeminiClient();
  if (!ai) {
    throw new Error('Gemini client unavailable');
  }

  try {
    const response = await callWithRetry(
      () =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: text,
          config: {
            responseModalities: ['AUDIO'],
            speechConfig: {
              voiceConfig: {
                prebuiltVoiceConfig: {
                  voiceName: VOICE_NAME,
                },
              },
              languageCode: LANGUAGE_CODE,
            },
          },
        }),
      { timeoutMs: TIMEOUT_MS }
    );

    const base64Audio =
      response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      throw new Error('Empty audio response from TTS');
    }

    recordSuccess();
    return new Uint8Array(Buffer.from(base64Audio, 'base64'));
  } catch (error) {
    console.error('TTS generation failed:', error);
    recordFailure();
    throw error instanceof Error ? error : new Error('TTS generation failed');
  }
}
