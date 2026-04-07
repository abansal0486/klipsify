import { Injectable, Logger } from '@nestjs/common';
import OpenAI from 'openai';
import { VideoService, ScriptVoPair } from './video.service';

/**
 * UgcVideoService
 *
 * Handles script generation for UGC videos.
 * Key difference from the main VideoService:
 *   - When voiceover/narrator audio will be TTS-merged, the Veo prompt explicitly
 *     instructs "No dialogue. No speaking." so Veo 3.1 does NOT synthesise its own
 *     voice — preventing the double-voice issue.
 */
@Injectable()
export class UgcVideoService {
  private readonly logger = new Logger(UgcVideoService.name);
  private readonly client: OpenAI;

  constructor(private readonly videoService: VideoService) {
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  // ─────────────────────────────────────────────────────────────
  // PUBLIC: generate UGC script pairs
  // ─────────────────────────────────────────────────────────────
  async generateUGCScripts(
    storyboard: string,
    videoDuration: '8s' | '15s' | '30s',
    voiceOverText: string,
    narratorGender: string,
    audioType: 'voiceover' | 'narrator' | 'none',
    userScenes?: Array<{ script: string; voiceOver?: string }>,
  ): Promise<ScriptVoPair[]> {

    const durationMap:      Record<string, number>   = { '8s': 1, '15s': 2, '30s': 4 };
    const segmentDurations: Record<string, number[]> = {
      '8s':  [8],
      '15s': [8, 7],
      '30s': [8, 7, 7, 8],
    };

    const scriptCount = durationMap[videoDuration] ?? 1;
    const durations   = segmentDurations[videoDuration] ?? [8];
    const hasTTS      = audioType === 'voiceover' || audioType === 'narrator';

    // ── If the user pre-built scenes in the wizard, use them directly ──────
    if (userScenes?.length) {
      return this.buildFromUserScenes(userScenes, durations, narratorGender, audioType, voiceOverText);
    }

    // ── Otherwise ask GPT to generate scenes ──────────────────────────────
    const voChunks = voiceOverText.trim()
      ? this.splitText(voiceOverText.trim(), scriptCount)
      : Array(scriptCount).fill('');

    const systemPrompt = `You are a UGC video script writer for Google Veo 3.1.
Write exactly ${scriptCount} cinematic scene(s) for a ${videoDuration} video.
Each segment must flow naturally as one continuous uncut shot.

RULES:
- No scene cuts, no transitions between segments
- Describe only VISUAL action — what the camera sees
- No dialogue instructions — voiceover will be added separately
- Use Veo prompt formula: [Cinematography] + [Subject] + [Action] + [Context] + [Style]

CONTINUITY: Same environment, lighting, subject across all segments.

For each segment output EXACTLY:
SEGMENT [n]
SCRIPT: <visual scene description, 2-4 sentences>
END`;

    let aiScripts: string[] = [];

    try {
      const response = await this.client.chat.completions.create({
        model: 'gpt-4o-mini',
        temperature: 0.7,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user',   content: `Product/Brand: ${storyboard}` },
        ],
      });

      const raw = response.choices[0].message.content ?? '';
      const segments = raw.split(/SEGMENT\s+\d+/i).filter((s) => s.trim());

      for (let i = 0; i < scriptCount; i++) {
        const seg      = segments[i] ?? '';
        const match    = seg.match(/SCRIPT:\s*([\s\S]+?)(?=END|$)/i);
        aiScripts[i]   = match?.[1]?.trim() ?? storyboard;
      }
    } catch (err: any) {
      this.logger.warn(`GPT scene generation failed: ${err.message} — using storyboard`);
      aiScripts = Array(scriptCount).fill(storyboard);
    }

    // ── Build ScriptVoPair array with silent-video instruction ────────────
    let cumulativeTime = 0;

    return aiScripts.slice(0, scriptCount).map((visualScene, i) => {
      const segDuration   = durations[i] ?? 7;
      const voText        = voChunks[i] ?? '';
      const subtitleStart = parseFloat((cumulativeTime + 2.0).toFixed(2));
      const subtitleEnd   = parseFloat((cumulativeTime + segDuration - 1.0).toFixed(2));
      cumulativeTime     += segDuration;

      const veoPrompt     = this.buildVeoPrompt(
        visualScene, voText, hasTTS, i > 0, i === scriptCount - 1, scriptCount,
      );

      return {
        script:         veoPrompt,
        voiceOver:      audioType === 'voiceover' ? voText : '',
        narrator:       audioType === 'narrator'  ? voText : '',
        narratorGender,
        subtitleStart,
        subtitleEnd,
        isExtension:    i > 0,
        isLast:         i === scriptCount - 1,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE: build from user-supplied wizard scenes
  // ─────────────────────────────────────────────────────────────
  private buildFromUserScenes(
    userScenes: Array<{ script: string; voiceOver?: string }>,
    durations: number[],
    narratorGender: string,
    audioType: 'voiceover' | 'narrator' | 'none',
    fallbackVO: string,
  ): ScriptVoPair[] {
    const hasTTS        = audioType === 'voiceover' || audioType === 'narrator';
    const voParts       = fallbackVO.trim()
      ? this.splitText(fallbackVO.trim(), userScenes.length)
      : Array(userScenes.length).fill('');

    let cumulativeTime  = 0;

    return userScenes.map((scene, i) => {
      const segDuration   = durations[i] ?? 7;
      const voText        = scene.voiceOver?.trim() || voParts[i] || '';
      const subtitleStart = parseFloat((cumulativeTime + 2.0).toFixed(2));
      const subtitleEnd   = parseFloat((cumulativeTime + segDuration - 1.0).toFixed(2));
      cumulativeTime     += segDuration;

      const veoPrompt     = this.buildVeoPrompt(
        scene.script, voText, hasTTS,
        i > 0, i === userScenes.length - 1, userScenes.length,
      );

      return {
        script:         veoPrompt,
        voiceOver:      audioType === 'voiceover' ? voText : '',
        narrator:       audioType === 'narrator'  ? voText : '',
        narratorGender,
        subtitleStart,
        subtitleEnd,
        isExtension:    i > 0,
        isLast:         i === userScenes.length - 1,
      };
    });
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE: build one Veo prompt
  //
  // THE CRITICAL FIX: when hasTTS=true, add "No dialogue. No speaking."
  // so Veo does NOT generate its own native voice alongside the TTS audio.
  // ─────────────────────────────────────────────────────────────
  private buildVeoPrompt(
    visualScene: string,
    voText: string,
    hasTTS: boolean,
    isExtension: boolean,
    isLast: boolean,
    totalSegments: number,
  ): string {
    const parts: string[] = [];

    if (isExtension) {
      parts.push('CONTINUING FROM PREVIOUS CLIP. Same scene, same lighting, same framing.');
      parts.push('');
    }

    parts.push(`Medium close-up shot, eye level, 35mm lens, shallow depth of field. ${visualScene}`);
    parts.push('');

    if (isLast) {
      parts.push(
        totalSegments === 1
          ? 'End with a slow gentle camera hold on the subject. Natural calm finish.'
          : 'FINAL SEGMENT. Camera slowly pulls back and settles. Scene comes to a peaceful natural close.',
      );
      parts.push('');
    }

    // ── KEY FIX: suppress Veo native voice when TTS will be merged ─────────
    if (hasTTS && voText) {
      parts.push('No dialogue. No speaking. Silent scene. External voiceover will be added in post-production.');
      parts.push('');
    }

    parts.push('Ambient noise: subtle natural sounds of the scene.');
    parts.push('SFX: soft cinematic orchestral score, gentle and atmospheric, very soft background only.');
    parts.push('Cinematic realism, photorealistic, soft natural lighting, shallow depth of field.');

    return parts.join('\n').trim();
  }

  // ─────────────────────────────────────────────────────────────
  // PRIVATE: split voiceover text evenly across segments
  // ─────────────────────────────────────────────────────────────
  private splitText(text: string, count: number): string[] {
    if (count <= 1) return [text];
    const words     = text.split(/\s+/).filter(Boolean);
    const base      = Math.floor(words.length / count);
    const remainder = words.length % count;
    const chunks: string[] = [];
    let idx = 0;
    for (let i = 0; i < count; i++) {
      const size = base + (i < remainder ? 1 : 0);
      chunks.push(words.slice(idx, idx + size).join(' '));
      idx += size;
    }
    return chunks;
  }
}
