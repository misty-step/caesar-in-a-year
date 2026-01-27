import { NextResponse } from 'next/server';
import { generateAudioKey } from '@/lib/audio/audioKey';
import { audioStore } from '@/lib/audio/storage';
import { generateLatinAudio } from '@/lib/ai/tts';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const text = body?.text;

    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
    }

    const key = generateAudioKey(text);

    if (await audioStore.exists(key)) {
      return NextResponse.json({
        url: audioStore.getPublicUrl(key),
        fromCache: true,
      });
    }

    const audioBytes = await generateLatinAudio(text);
    const url = await audioStore.put(key, audioBytes);

    return NextResponse.json({ url, fromCache: false });
  } catch (error) {
    console.error('Error in POST /api/tts', error);
    return NextResponse.json({ error: 'TTS generation failed' }, { status: 500 });
  }
}
