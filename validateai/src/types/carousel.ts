export type CarouselPlatform = 'linkedin' | 'instagram';
export type CarouselTheme = 'clean' | 'dark' | 'gradient';
export type SlideType = 'cover' | 'body' | 'cta';
export type GenerationStatus = 'idle' | 'generating' | 'done' | 'error';

export interface CarouselSlide {
  id: string;
  type: SlideType;
  headline: string;
  body: string;
  /** Emoji o ícono decorativo opcional */
  icon?: string;
}

export interface CarouselCampaign {
  id?: string;
  validationId: string;
  platform: CarouselPlatform;
  theme: CarouselTheme;
  title: string;
  slides: CarouselSlide[];
  version: number;
}

/** Respuesta esperada de la Edge Function generate-carousel */
export interface GenerateCarouselResponse {
  campaign_title: string;
  slides: CarouselSlide[];
}
