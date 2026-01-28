import { NextResponse } from 'next/server';
import { auth } from '@clerk/nextjs/server';
import { generateAudioKey } from '@/lib/audio/audioKey';
import { audioStore } from '@/lib/audio/storage';
import { generateLatinAudio } from '@/lib/ai/tts';
import { pcmToWav } from '@/lib/audio/pcmToWav';
import { consumeAiCall } from '@/lib/rateLimit/inMemoryRateLimit';

export const runtime = 'nodejs';

const MAX_TEXT_LENGTH = 5000;

export async function POST(req: Request) {
  const { userId } = await auth();

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => null);
    const text = body?.text;
    console.log('TTS request text:', JSON.stringify(text));

    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    if (text.length > MAX_TEXT_LENGTH) {
      return NextResponse.json({ error: 'Text too long' }, { status: 400 });
    }

    const rateLimitDecision = consumeAiCall(userId, Date.now());

    if (!rateLimitDecision.allowed) {
      return NextResponse.json(
        {
          error: 'Rate limit exceeded',
          rateLimit: {
            remaining: rateLimitDecision.remaining,
            resetAtMs: rateLimitDecision.resetAtMs,
          },
        },
        { status: 429 }
      );
    }

    const hasBlobToken = Boolean(process.env.BLOB_READ_WRITE_TOKEN);
    const key = generateAudioKey(text);

    if (hasBlobToken) {
      if (await audioStore.exists(key)) {
        return NextResponse.json({
          url: audioStore.getPublicUrl(key),
          fromCache: true,
        });
      }

      const pcmBytes = await generateLatinAudio(text);
      const wavBytes = pcmToWav(pcmBytes);
      const url = await audioStore.put(key, wavBytes);

      return NextResponse.json({ url, fromCache: false });
    }

    const pcmBytes = await generateLatinAudio(text);
    const wavBytes = pcmToWav(pcmBytes);
    const base64Audio = Buffer.from(wavBytes).toString('base64');
    const dataUrl = `data:audio/wav;base64,${base64Audio}`;
    return NextResponse.json({ url: dataUrl, fromCache: false });
  } catch (error) {
    console.error('Error in POST /api/tts', error);
    return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 });
  }
}
