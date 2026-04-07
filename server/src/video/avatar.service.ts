import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

const HEYGEN_BASE = 'https://api.heygen.com';

// ─── Built-in Veo presenter personas (no external API needed) ────────────────
// When HEYGEN_API_KEY is not set, these are used instead.
// Veo generates a photorealistic person speaking to camera about the product.
export const VEO_PRESENTER_AVATARS = [
  {
    avatar_id: 'veo_sarah',
    avatar_name: 'Sarah',
    gender: 'female',
    label: 'Young Professional',
    description: 'Confident young professional woman in her late 20s, warm smile, natural makeup, wearing smart casual attire',
    preview_image_url: '', // static placeholder shown in UI
    preview_video_url: '',
    premium: false,
    tags: ['female', 'professional', 'young'],
    default_voice_id: null,
    // Full Veo visual description injected into the prompt
    veoDescription: [
      'Medium close-up shot, eye level.',
      'A confident, warm young professional woman in her late 20s with a natural smile,',
      'wearing smart casual clothing, speaking directly to camera.',
      'Soft studio lighting, shallow depth of field, clean neutral background.',
      'She gestures naturally while speaking, engaging and friendly.',
    ].join(' '),
  },
  {
    avatar_id: 'veo_james',
    avatar_name: 'James',
    gender: 'male',
    label: 'Confident Narrator',
    description: 'Confident male presenter in his 30s, professional look, clean background',
    preview_image_url: '',
    preview_video_url: '',
    premium: false,
    tags: ['male', 'professional', 'narrator'],
    default_voice_id: null,
    veoDescription: [
      'Medium close-up shot, eye level.',
      'A confident well-dressed man in his early 30s with a calm authoritative presence,',
      'wearing a neat collared shirt, speaking directly to camera.',
      'Soft studio lighting, shallow depth of field, clean light background.',
      'He speaks clearly and naturally, gesturing to emphasize key points.',
    ].join(' '),
  },
];

export interface HeyGenAvatar {
  avatar_id: string;
  avatar_name: string;
  gender: string;
  preview_image_url: string;
  preview_video_url: string;
  premium: boolean;
  tags: string[];
  default_voice_id: string | null;
  // Veo-only fields (present on VEO_PRESENTER_AVATARS)
  veoDescription?: string;
  label?: string;
}

export interface AvatarVideoResult {
  videoUrl: string;
  thumbnailUrl: string;
  duration: number;
}

@Injectable()
export class AvatarService {
  private readonly logger = new Logger(AvatarService.name);

  private get heygenKey(): string {
    return process.env.HEYGEN_API_KEY || '';
  }

  private get heygenAvailable(): boolean {
    return Boolean(this.heygenKey && this.heygenKey !== 'your_heygen_api_key_here');
  }

  private get headers() {
    return {
      'x-api-key': this.heygenKey,
      'Content-Type': 'application/json',
    };
  }

  // ── List avatars — returns HeyGen avatars if key present, else Veo personas ──
  async listAvatars(): Promise<HeyGenAvatar[]> {
    if (this.heygenAvailable) {
      try {
        const res = await axios.get(`${HEYGEN_BASE}/v2/avatars`, {
          headers: this.headers,
          timeout: 15000,
        });
        const heygenAvatars: HeyGenAvatar[] = res.data?.data?.avatars || [];
        // Prepend Veo presenters so they always appear first
        return [...VEO_PRESENTER_AVATARS, ...heygenAvatars];
      } catch (err: any) {
        this.logger.warn(`HeyGen list failed, falling back to Veo presenters: ${err.message}`);
      }
    }
    // No HeyGen key — return built-in Veo presenters only
    this.logger.log('Using built-in Veo presenter avatars (no HeyGen key)');
    return VEO_PRESENTER_AVATARS;
  }

  // ── Check if an avatar_id is a built-in Veo presenter ──────────────────────
  isVeoAvatar(avatarId: string): boolean {
    return VEO_PRESENTER_AVATARS.some((a) => a.avatar_id === avatarId);
  }

  // ── Get Veo presenter by id ─────────────────────────────────────────────────
  getVeoAvatar(avatarId: string) {
    return VEO_PRESENTER_AVATARS.find((a) => a.avatar_id === avatarId) || null;
  }

  // ── Detect product category from name + description ─────────────────────────
  private detectProductCategory(name: string, desc: string): string {
    const text = `${name} ${desc}`.toLowerCase();
    if (/skin|face|serum|moistur|cleanser|toner|cream|glow|acne|spf|sunscreen|beauty|lip|eye|mask|peel/.test(text)) return 'skincare';
    if (/hair|shampoo|conditioner|scalp|curl|frizz|strand|volume|colour|dye/.test(text)) return 'haircare';
    if (/food|snack|drink|juice|coffee|tea|protein|nutrition|meal|eat|flavour|taste|supplement/.test(text)) return 'food';
    if (/fitness|gym|workout|yoga|sport|running|muscle|training|equipment|weight/.test(text)) return 'fitness';
    if (/tech|phone|app|device|gadget|software|laptop|earbuds|headphone|watch|smart/.test(text)) return 'tech';
    if (/cloth|fashion|wear|dress|shirt|shoes|bag|style|outfit|apparel/.test(text)) return 'fashion';
    if (/home|decor|kitchen|furniture|clean|spray|candle|diffuser|organiz/.test(text)) return 'home';
    return 'general';
  }

  // ── Build lifestyle B-roll description based on category ────────────────────
  private buildBRoll(category: string, product: string, imageHint: string): string {
    const img = imageHint ? ` The product appears exactly as in the reference image — matching packaging, label, and colours.` : '';
    switch (category) {
      case 'skincare':
        return `Close-up of hands gently applying ${product} onto smooth skin, massaging in small circular motions. Skin visibly glows under warm soft light.${img}`;
      case 'haircare':
        return `Slow-motion shot of hair flowing after applying ${product}, strands catching warm light and looking healthy and full.${img}`;
      case 'food':
        return `Macro shot of ${product} being poured, tasted, or plated — vibrant colours, steam rising, appetising texture visible.${img}`;
      case 'fitness':
        return `Dynamic action shot of someone using ${product} during a workout — energetic, sweat, motion blur on limbs, gym or outdoor setting.${img}`;
      case 'tech':
        return `Clean tech reveal: ${product} displayed on a minimal surface, screen lighting up, fingers interacting with the interface, sleek and modern.${img}`;
      case 'fashion':
        return `Stylish model wearing or carrying ${product}, rotating slowly in soft natural light, fabric texture and details clearly visible.${img}`;
      case 'home':
        return `${product} in a cosy home setting — natural light, tidy surface, product in use, warm lifestyle atmosphere.${img}`;
      default:
        return `The ${product} product shown in detail — rotating slowly on a clean surface under professional lighting, packaging and branding clearly visible.${img}`;
    }
  }

  // ── Build per-segment prompts for an avatar UGC video ───────────────────────
  // Returns one prompt per segment (8s base + 7s per extension)
  buildVeoPresenterPrompts(params: {
    avatarId: string;
    script: string;
    productName: string;
    productDescription: string;
    referenceImages?: string[];   // array of image URLs/paths
    aspectRatio: string;
    tone?: string;
    segmentCount: number;         // 1 = 8s, 2 = 15s, 4 = 30s
  }): string[] {
    const { avatarId, script, productName, productDescription, referenceImages = [], aspectRatio, tone, segmentCount } = params;
    const persona = this.getVeoAvatar(avatarId);

    const isVertical = aspectRatio === '9:16';
    const frameDesc = isVertical
      ? 'Vertical 9:16 portrait format, mobile-first short-form video.'
      : 'Widescreen 16:9 cinematic format.';

    const presenterDesc = persona?.veoDescription || 'A confident professional presenter.';
    const product = productName || 'the featured product';
    const prodDesc = productDescription ? productDescription.substring(0, 150) : '';
    const toneDesc = tone && tone !== 'Default tone' ? `${tone} tone. ` : '';
    const category = this.detectProductCategory(product, prodDesc);

    const productContext = prodDesc
      ? `The product is "${product}" — ${prodDesc}.`
      : `The product is "${product}".`;

    const cinematic = `Photorealistic. Professional studio lighting, soft fill light, subtle rim light. Shallow depth of field. Smooth camera movement, no shaky cam. High-end commercial colour grade, clean and slightly warm. ${toneDesc}`;

    const voiceLock = `The presenter's voice is warm, confident, and natural — same consistent pitch, cadence and energy throughout the entire video. No change in vocal quality between cuts.`;

    // Build image reference hints — cycle through provided images across segments
    const getImageHint = (segIdx: number): string => {
      if (!referenceImages.length) return '';
      const img = referenceImages[segIdx % referenceImages.length];
      return img ? `Reference image provided — match the product's exact packaging, colours, and branding shown in it.` : '';
    };

    const broll = this.buildBRoll(category, product, referenceImages.length > 0 ? 'yes' : '');

    // Segment-specific scene beats
    const sceneBeat = (idx: number): string => {
      const imageHint = getImageHint(idx);
      const imgNote = imageHint ? ` ${imageHint}` : '';

      switch (idx % 4) {
        case 0: // Opening — product reveal + presenter intro
          return `Opens with a cinematic close-up of ${product} on a clean surface, camera slowly pushing in for 2 seconds. ${presenterDesc} The presenter appears from the side stepping into frame, turns to face camera, and begins speaking with genuine enthusiasm. The product stays visible in soft focus in the background.${imgNote}`;

        case 1: // Lifestyle B-roll — product in action
          return `Full-screen lifestyle sequence — no presenter visible. ${broll} The camera moves slowly, revealing product details. Product fills the frame. Text callouts or key benefit words appear briefly as lower-thirds.${imgNote}`;

        case 2: // PiP layout — presenter small, product dominant
          return `${presenterDesc} The presenter appears as a small picture-in-picture overlay in the bottom-left corner — like a live reaction on a shopping stream. The rest of the frame is filled with a large, detailed product showcase of ${product} — packaging front and back, textures, colours. The presenter nods and reacts as if watching the product demo.${imgNote}`;

        case 3: // CTA close — presenter full screen, product badge
          return `${presenterDesc} The presenter is back full-frame, speaking directly to camera with confident gestures, wrapping up their pitch for ${product}. A branded product badge or overlay appears bottom-right showing the product name. Ends with the presenter smiling and a final wide shot that includes both presenter and product side by side.${imgNote}`;

        default:
          return `${presenterDesc} The presenter speaks enthusiastically about ${product}, gesturing naturally. ${broll}${imgNote}`;
      }
    };

    return Array.from({ length: segmentCount }, (_, i) =>
      [frameDesc, productContext, sceneBeat(i), voiceLock, cinematic].filter(Boolean).join(' ')
    );
  }

  // ── Legacy single-prompt wrapper (kept for backwards compat) ─────────────────
  buildVeoPresenterPrompt(params: {
    avatarId: string;
    script: string;
    productName: string;
    productDescription: string;
    backgroundImageUrl?: string;
    referenceImages?: string[];
    aspectRatio: string;
    tone?: string;
  }): string {
    return this.buildVeoPresenterPrompts({
      ...params,
      referenceImages: params.referenceImages || (params.backgroundImageUrl ? [params.backgroundImageUrl] : []),
      segmentCount: 1,
    })[0];
  }

  // ── Generate avatar video ────────────────────────────────────────────────────
  // Returns: { mode: 'veo', prompt } for Veo avatars
  //          { mode: 'heygen', videoId } for HeyGen avatars
  async generateAvatarVideo(params: {
    avatarId: string;
    voiceId?: string;
    script: string;
    backgroundImageUrl?: string;
    referenceImages?: string[];
    aspectRatio: '16:9' | '9:16' | '1:1';
    caption: boolean;
    title?: string;
    productName?: string;
    productDescription?: string;
    tone?: string;
    segmentCount?: number;
  }): Promise<{ mode: 'veo'; prompts: string[] } | { mode: 'heygen'; videoId: string }> {

    // ── Veo presenter path ──────────────────────────────────────────────────
    if (this.isVeoAvatar(params.avatarId)) {
      const segmentCount = params.segmentCount || 1;
      const allImages = [
        ...(params.referenceImages || []),
        ...(params.backgroundImageUrl ? [params.backgroundImageUrl] : []),
      ].filter(Boolean);

      const prompts = this.buildVeoPresenterPrompts({
        avatarId:           params.avatarId,
        script:             params.script,
        productName:        params.productName || '',
        productDescription: params.productDescription || '',
        referenceImages:    allImages,
        aspectRatio:        params.aspectRatio,
        tone:               params.tone,
        segmentCount,
      });
      this.logger.log(`Veo presenter avatar selected: ${params.avatarId}, segments: ${segmentCount}`);
      return { mode: 'veo', prompts };
    }

    // ── HeyGen path ─────────────────────────────────────────────────────────
    if (!this.heygenAvailable) {
      throw new Error('HeyGen API key not configured. Only built-in Veo avatars are available.');
    }

    const dimensions: Record<string, { width: number; height: number }> = {
      '16:9': { width: 1920, height: 1080 },
      '9:16': { width: 1080, height: 1920 },
      '1:1':  { width: 1080, height: 1080 },
    };

    const background = params.backgroundImageUrl
      ? { type: 'image', url: params.backgroundImageUrl, fit: 'cover' }
      : { type: 'color', value: '#0f0f0f' };

    const payload = {
      title: params.title || 'UGC Avatar Video',
      caption: params.caption,
      dimension: dimensions[params.aspectRatio] || dimensions['16:9'],
      video_inputs: [{
        character: {
          type: 'avatar',
          avatar_id: params.avatarId,
          avatar_style: 'normal',
          scale: 1.0,
          matting: Boolean(params.backgroundImageUrl),
        },
        voice: {
          type: 'text',
          voice_id: params.voiceId || AvatarService.defaultVoiceId('female'),
          input_text: params.script.substring(0, 5000),
          speed: 1.0,
        },
        background,
      }],
    };

    this.logger.log(`HeyGen generate — avatar: ${params.avatarId}`);
    const res = await axios.post(`${HEYGEN_BASE}/v2/video/generate`, payload, {
      headers: this.headers,
      timeout: 30000,
    });

    const videoId = res.data?.data?.video_id;
    if (!videoId) throw new Error(`HeyGen returned no video_id: ${JSON.stringify(res.data)}`);
    return { mode: 'heygen', videoId };
  }

  // ── Poll HeyGen until done ───────────────────────────────────────────────────
  async pollUntilDone(videoId: string, maxWaitMs = 300000): Promise<AvatarVideoResult> {
    const interval = 8000;
    const maxAttempts = Math.ceil(maxWaitMs / interval);

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      await this.sleep(interval);
      const res = await axios.get(
        `${HEYGEN_BASE}/v1/video_status.get?video_id=${videoId}`,
        { headers: this.headers, timeout: 15000 },
      );
      const data = res.data?.data;
      const status: string = data?.status;
      this.logger.log(`HeyGen poll [${attempt + 1}/${maxAttempts}] — ${videoId}: ${status}`);
      if (status === 'completed') return { videoUrl: data.video_url, thumbnailUrl: data.thumbnail_url || '', duration: data.duration || 0 };
      if (status === 'failed') throw new Error(`HeyGen video failed: ${data?.error || 'Unknown error'}`);
    }
    throw new Error(`HeyGen polling timed out after ${maxWaitMs / 1000}s`);
  }

  // ── Default voice IDs (HeyGen built-in) ────────────────────────────────────
  static defaultVoiceId(gender: 'male' | 'female' | 'neutral'): string {
    const voices: Record<string, string> = {
      female:  '2d5b0e6cf36f460aa7fc47e3eee4ba54',
      male:    'e5f9a4b8c2d341f6a8b3c7e0d1f2a5b9',
      neutral: '2d5b0e6cf36f460aa7fc47e3eee4ba54',
    };
    return voices[gender] || voices.female;
  }

  private sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
  }
}
