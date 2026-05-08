import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { supabase } from '@/lib/supabase';
import type {
  CarouselSlide,
  CarouselPlatform,
  CarouselTheme,
  CarouselCampaign,
  GenerationStatus,
  GenerateCarouselResponse,
} from '@/types/carousel';

interface CarouselState {
  // ── Selección de usuario ────────────────────────────────────────────────────
  platform: CarouselPlatform;
  theme: CarouselTheme;

  // ── Campaña activa ──────────────────────────────────────────────────────────
  campaign: CarouselCampaign | null;

  // ── Estado de generación ────────────────────────────────────────────────────
  status: GenerationStatus;
  error: string | null;

  // ── Acciones de configuración ───────────────────────────────────────────────
  setPlatform: (p: CarouselPlatform) => void;
  setTheme: (t: CarouselTheme) => void;

  // ── Acciones del editor ─────────────────────────────────────────────────────
  reorderSlides: (slides: CarouselSlide[]) => void;
  updateSlide: (id: string, patch: Partial<Pick<CarouselSlide, 'headline' | 'body' | 'icon'>>) => void;

  // ── Generación y persistencia ───────────────────────────────────────────────
  generateCarousel: (validationId: string, context: Record<string, unknown>) => Promise<void>;
  generateStory: (center: string, frame: string, customData: string, adminData: Record<string, unknown>) => Promise<void>;
  saveCampaign: () => Promise<void>;
  reset: () => void;
}

const initialState = {
  platform: 'linkedin' as CarouselPlatform,
  theme: 'clean' as CarouselTheme,
  campaign: null,
  status: 'idle' as GenerationStatus,
  error: null,
};

export const useCarouselStore = create<CarouselState>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        setPlatform: (platform) => set({ platform }),
        setTheme: (theme) => set({ theme }),

        reorderSlides: (slides) =>
          set((s) => s.campaign ? { campaign: { ...s.campaign, slides } } : {}),

        updateSlide: (id, patch) =>
          set((s) => {
            if (!s.campaign) return {};
            return {
              campaign: {
                ...s.campaign,
                slides: s.campaign.slides.map((sl) =>
                  sl.id === id ? { ...sl, ...patch } : sl
                ),
              },
            };
          }),

        generateCarousel: async (validationId, context) => {
          set({ status: 'generating', error: null });
          try {
            const { data, error } = await supabase.functions.invoke<GenerateCarouselResponse>(
              'generate-carousel',
              {
                body: {
                  validation_id: validationId,
                  platform: get().platform,
                  context,
                },
              }
            );

            if (error) throw new Error(error.message);
            if (!data) throw new Error('Respuesta vacía del servidor');

            const { platform, theme } = get();
            set({
              status: 'done',
              campaign: {
                validationId,
                platform,
                theme,
                title: data.campaign_title,
                slides: data.slides,
                version: (get().campaign?.version ?? 0) + 1,
              },
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            set({ status: 'error', error: msg });
          }
        },

        generateStory: async (center, frame, customData, adminData) => {
          set({ status: 'generating', error: null });
          try {
            const { data, error } = await supabase.functions.invoke<GenerateCarouselResponse>(
              'generate-content-story',
              {
                body: {
                  platform: get().platform,
                  context: { center, frame, customData, adminData },
                },
              }
            );

            if (error) throw new Error(error.message);
            if (!data) throw new Error('Respuesta vacía del servidor');

            const { platform, theme } = get();
            set({
              status: 'done',
              campaign: {
                validationId: 'admin-story',
                platform,
                theme,
                title: data.campaign_title,
                slides: data.slides,
                version: (get().campaign?.version ?? 0) + 1,
              },
            });
          } catch (err) {
            const msg = err instanceof Error ? err.message : 'Error desconocido';
            set({ status: 'error', error: msg });
          }
        },

        saveCampaign: async () => {
          const { campaign } = get();
          if (!campaign) return;

          const { data: { user } } = await supabase.auth.getUser();
          if (!user) return;

          const payload = {
            validation_id: campaign.validationId,
            user_id: user.id,
            platform: campaign.platform,
            theme: campaign.theme,
            title: campaign.title,
            slides: campaign.slides,
            version: campaign.version,
          };

          if (campaign.id) {
            await supabase
              .from('content_campaigns')
              .update({ ...payload, updated_at: new Date().toISOString() })
              .eq('id', campaign.id);
          } else {
            const { data } = await supabase
              .from('content_campaigns')
              .insert(payload)
              .select('id')
              .single();

            if (data) {
              set((s) => s.campaign ? { campaign: { ...s.campaign, id: data.id } } : {});
            }
          }
        },

        reset: () => set(initialState),
      }),
      { name: 'validateai-carousel' }
    )
  )
);
