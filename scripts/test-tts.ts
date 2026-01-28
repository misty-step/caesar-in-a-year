#!/usr/bin/env tsx
/**
 * Test script for Gemini TTS API
 * Run: pnpm tsx scripts/test-tts.ts
 */

import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const MODEL_NAME = 'gemini-2.5-flash-preview-tts';
const VOICE_NAME = 'Charon';
const TEST_TEXTS = [
  {
    name: 'Gallia est omnis divisa in partes tres.',
    text: 'Gallia est omnis divisa in partes tres.',
  },
  {
    name: 'priusquam',
    text: 'priusquam',
  },
  {
    name: 'Hello',
    text: 'Hello',
  },
  {
    name: 'Say the word priusquam',
    text: 'Say the word priusquam',
  },
  {
    name: 'Please say: priusquam',
    text: 'Please say: priusquam',
  },
];

type TestCase = {
  name: string;
  body: Record<string, unknown>;
};

const testCases: TestCase[] = [
  {
    name: 'camelCase generationConfig',
    body: {
      contents: [],
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
    },
  },
];

async function testTTS() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('❌ GEMINI_API_KEY not set');
    process.exit(1);
  }

  console.log('Testing Gemini TTS API...');
  console.log('Model:', MODEL_NAME);
  console.log('Voice:', VOICE_NAME);
  console.log('---');

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${apiKey}`;

  for (const testCase of testCases) {
    for (const testText of TEST_TEXTS) {
      console.log(`Case: ${testCase.name}`);
      console.log(`Text: ${testText.name}`);

      const body = {
        ...testCase.body,
        contents: [
          {
            parts: [{ text: testText.text }],
          },
        ],
      };

      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });

        const responseText = await response.text();
        let data: any;
        try {
          data = JSON.parse(responseText);
        } catch (error) {
          console.log('Result: ❌ Failed');
          console.log('Finish reason: parse_error');
          console.log('===');
          continue;
        }

        const audioData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
        const finishReason = data.candidates?.[0]?.finishReason ?? 'unknown';

        if (audioData) {
          console.log('Result: ✅ Succeeded');
        } else {
          console.log('Result: ❌ Failed');
        }
        console.log('Finish reason:', finishReason);
      } catch (error) {
        console.log('Result: ❌ Failed');
        console.log('Finish reason: request_error');
      }

      console.log('===');
    }
  }
}

testTTS();
