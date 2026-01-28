import 'server-only';

// === Config ===
const MODEL_NAME = 'gemini-2.5-flash-preview-tts';
const VOICE_NAME = 'Charon';
const TIMEOUT_MS = 15000;

// === Circuit Breaker ===
let consecutiveFailures = 0;
const FAILURE_THRESHOLD = 5;
const OPEN_CIRCUIT_RESET_MS = 60000;
let lastFailureTime = 0;

function isCircuitOpen(): boolean {
  if (consecutiveFailures >= FAILURE_THRESHOLD) {
    if (Date.now() - lastFailureTime > OPEN_CIRCUIT_RESET_MS) {
      return false;
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

  // Gemini TTS fails on single words - wrap with instruction
  const trimmedText = text.trim();
  const isSingleWord = !/\s/.test(trimmedText);
  const isVeryShort = trimmedText.length < 15;
  const textToSend =
    isSingleWord || isVeryShort ? `Please say: ${trimmedText}` : trimmedText;

  if (isCircuitOpen()) {
    console.warn('TTS circuit breaker open - skipping AI call');
    throw new Error('TTS circuit breaker open');
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY not configured');
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

  const body = {
    contents: [
      {
        parts: [{ text: textToSend }],
      },
    ],
    generationConfig: {
      responseModalities: ['AUDIO'],
      speechConfig: {
        voiceConfig: {
          prebuiltVoiceConfig: {
            voiceName: VOICE_NAME,
          },
        },
      },
    },
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('TTS API error:', response.status, errorText);
      throw new Error(`TTS API error: ${response.status}`);
    }

    const data = await response.json();

    const base64Audio = data.candidates?.[0]?.content?.parts?.[0]?.inlineData
      ?.data;
    if (!base64Audio) {
      throw new Error('Empty audio response from TTS');
    }

    recordSuccess();
    return new Uint8Array(Buffer.from(base64Audio, 'base64'));
  } catch (error) {
    console.error('TTS generation failed:', error);
    recordFailure();
    throw error instanceof Error ? error : new Error('TTS generation failed');
  } finally {
    clearTimeout(timeoutId);
  }
}
