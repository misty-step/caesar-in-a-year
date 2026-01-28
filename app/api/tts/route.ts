import { NextResponse } from 'next/server';
import { generateAudioKey } from '@/lib/audio/audioKey';
import { audioStore } from '@/lib/audio/storage';
import { generateLatinAudio } from '@/lib/ai/tts';
import { pcmToWav } from '@/lib/audio/pcmToWav';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => null);
    const text = body?.text;
    console.log('TTS request text:', JSON.stringify(text));

    if (typeof text !== 'string' || !text.trim()) {
      return NextResponse.json({ error: 'Text is required' }, { status: 400 });
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
