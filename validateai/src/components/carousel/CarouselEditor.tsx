'use client';

import { useState } from 'react';
import { exportAsPdf, exportAsZip } from '@/lib/carouselExport';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useCarouselStore } from '@/stores/carouselStore';
import type { CarouselSlide, CarouselPlatform, CarouselTheme } from '@/types/carousel';

// ── SlideCard (sortable) ──────────────────────────────────────────────────────

interface SlideCardProps {
  slide: CarouselSlide;
  isActive: boolean;
  onClick: () => void;
  theme: CarouselTheme;
  platform: CarouselPlatform;
  index: number;
}

function SlideCard({ slide, isActive, onClick, theme, platform, index }: SlideCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slide.id, disabled: slide.type === 'cover' || slide.type === 'cta' });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  const aspectClass = platform === 'instagram' ? 'aspect-[4/5]' : 'aspect-square';

  const themeClasses: Record<CarouselTheme, string> = {
    clean:    'bg-white border border-gray-200 text-gray-900',
    dark:     'bg-gray-900 border border-gray-700 text-white',
    gradient: 'bg-gradient-to-br from-teal-500 to-violet-600 text-white border-0',
  };

  const typeLabel: Record<CarouselSlide['type'], string> = {
    cover: 'PORTADA',
    body:  `SLIDE ${index}`,
    cta:   'CTA',
  };

  const canDrag = slide.type === 'body';

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="relative group"
    >
      {/* Drag handle — solo slides body */}
      {canDrag && (
        <button
          {...attributes}
          {...listeners}
          aria-label="Arrastrar slide"
          className="absolute top-1 right-1 z-10 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
        >
          ⠿
        </button>
      )}

      <button
        onClick={onClick}
        className={`w-full ${aspectClass} rounded-xl overflow-hidden flex flex-col justify-between p-3
          ${themeClasses[theme]}
          ${isActive ? 'ring-2 ring-teal-500 ring-offset-2' : 'hover:ring-1 hover:ring-gray-300'}
          transition-all text-left`}
      >
        <span className={`text-[9px] font-black tracking-widest opacity-50 ${slide.type === 'cta' ? 'text-teal-400' : ''}`}>
          {typeLabel[slide.type]}
        </span>
        <div className="space-y-1">
          {slide.icon && <div className="text-lg">{slide.icon}</div>}
          <p className="text-[11px] font-bold leading-tight line-clamp-3">{slide.headline}</p>
          <p className="text-[9px] opacity-60 line-clamp-2">{slide.body}</p>
        </div>
      </button>
    </div>
  );
}

// ── SlideEditDrawer ───────────────────────────────────────────────────────────

interface DrawerProps {
  slide: CarouselSlide;
  onUpdate: (patch: Partial<Pick<CarouselSlide, 'headline' | 'body' | 'icon'>>) => void;
  onClose: () => void;
}

function SlideEditDrawer({ slide, onUpdate, onClose }: DrawerProps) {
  return (
    <div className="border-t border-gray-100 dark:border-white/5 pt-4 mt-4 space-y-3 animate-in slide-in-from-bottom-2 duration-200">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-bold text-gray-500 dark:text-[#8B8AA0] uppercase tracking-wide">
          Editar slide
        </p>
        <button onClick={onClose} className="text-xs text-gray-400 hover:text-gray-600">Cerrar ×</button>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
          Emoji / Ícono
        </label>
        <input
          type="text"
          value={slide.icon ?? ''}
          onChange={(e) => onUpdate({ icon: e.target.value })}
          maxLength={4}
          placeholder="🚀"
          className="w-16 text-center border border-gray-200 dark:border-white/10 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-white/5 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
      </div>

      <div>
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
          Titular
        </label>
        <input
          type="text"
          value={slide.headline}
          onChange={(e) => onUpdate({ headline: e.target.value })}
          maxLength={slide.type === 'body' ? 60 : 80}
          className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-400"
        />
        <p className="text-[10px] text-gray-300 text-right mt-0.5">{slide.headline.length} chars</p>
      </div>

      <div>
        <label className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1 block">
          Cuerpo
        </label>
        <textarea
          value={slide.body}
          onChange={(e) => onUpdate({ body: e.target.value })}
          maxLength={slide.type === 'cta' ? 120 : 200}
          rows={3}
          className="w-full border border-gray-200 dark:border-white/10 rounded-lg px-3 py-2 text-sm bg-white dark:bg-white/5 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-400 resize-none"
        />
        <p className="text-[10px] text-gray-300 text-right">{slide.body.length} chars</p>
      </div>
    </div>
  );
}

// ── CarouselPreview ───────────────────────────────────────────────────────────

interface PreviewProps {
  slides: CarouselSlide[];
  theme: CarouselTheme;
  platform: CarouselPlatform;
}

const THEME_PREVIEW: Record<CarouselTheme, { bg: string; text: string; sub: string }> = {
  clean:    { bg: 'bg-white',                         text: 'text-gray-900',  sub: 'text-gray-500' },
  dark:     { bg: 'bg-gray-900',                      text: 'text-white',     sub: 'text-gray-400' },
  gradient: { bg: 'bg-gradient-to-br from-teal-500 to-violet-600', text: 'text-white', sub: 'text-white/70' },
};

function CarouselPreview({ slides, theme, platform }: PreviewProps) {
  const [current, setCurrent] = useState(0);
  const slide = slides[current];
  const tc = THEME_PREVIEW[theme];
  const aspectClass = platform === 'instagram' ? 'aspect-[4/5]' : 'aspect-square';

  return (
    <div className="flex flex-col items-center gap-3">
      {/* Slide preview */}
      <div
        className={`w-full max-w-[280px] ${aspectClass} ${tc.bg} rounded-2xl shadow-xl flex flex-col justify-between p-6 border border-gray-100 dark:border-white/10`}
      >
        <span className="text-[9px] font-black tracking-widest opacity-40 uppercase"
          style={{ color: theme === 'gradient' ? 'white' : undefined }}>
          {platform === 'linkedin' ? 'LinkedIn' : 'Instagram'} · {current + 1}/{slides.length}
        </span>

        <div className="space-y-2">
          {slide.icon && <div className="text-3xl">{slide.icon}</div>}
          <p className={`text-base font-black leading-tight ${tc.text}`}>{slide.headline}</p>
          <p className={`text-xs leading-relaxed ${tc.sub}`}>{slide.body}</p>
        </div>

        {slide.type === 'cta' && (
          <div className={`px-4 py-2 rounded-xl text-xs font-bold text-center ${
            theme === 'dark' ? 'bg-teal-500 text-white' :
            theme === 'gradient' ? 'bg-white text-teal-600' :
            'bg-teal-500 text-white'
          }`}>
            Acción
          </div>
        )}
      </div>

      {/* Navigation dots */}
      <div className="flex gap-1.5">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => setCurrent(i)}
            aria-label={`Slide ${i + 1}`}
            className={`rounded-full transition-all ${
              i === current ? 'w-4 h-2 bg-teal-500' : 'w-2 h-2 bg-gray-300 dark:bg-gray-600'
            }`}
          />
        ))}
      </div>

      {/* Prev / Next */}
      <div className="flex gap-2">
        <button
          onClick={() => setCurrent((c) => Math.max(0, c - 1))}
          disabled={current === 0}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-white/10 dark:text-white disabled:opacity-30 hover:bg-gray-200 transition"
        >
          ← Anterior
        </button>
        <button
          onClick={() => setCurrent((c) => Math.min(slides.length - 1, c + 1))}
          disabled={current === slides.length - 1}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-white/10 dark:text-white disabled:opacity-30 hover:bg-gray-200 transition"
        >
          Siguiente →
        </button>
      </div>
    </div>
  );
}

// ── Main CarouselEditor ───────────────────────────────────────────────────────

interface CarouselEditorProps {
  validationId?: string;
  context?: Record<string, unknown>;
  hideConfig?: boolean;
}

const PLATFORMS: { value: CarouselPlatform; label: string; desc: string; icon: string }[] = [
  { value: 'linkedin', label: 'LinkedIn', desc: 'PDF · Cuadrado 1:1 · B2B', icon: '💼' },
  { value: 'instagram', label: 'Instagram', desc: 'PNG ZIP · Vertical 4:5 · B2C', icon: '📸' },
];

const THEMES: { value: CarouselTheme; label: string; icon: string }[] = [
  { value: 'clean',    label: 'Clean',    icon: '⬜' },
  { value: 'dark',     label: 'Dark',     icon: '⬛' },
  { value: 'gradient', label: 'Gradient', icon: '🌈' },
];

export function CarouselEditor({ validationId, context, hideConfig }: CarouselEditorProps) {
  const {
    platform, theme, campaign, status, error,
    setPlatform, setTheme,
    generateCarousel, reorderSlides, updateSlide, saveCampaign, reset,
  } = useCarouselStore();

  const [activeSlideId, setActiveSlideId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [exportProgress, setExportProgress] = useState<{ current: number; total: number } | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id || !campaign) return;

    const oldIndex = campaign.slides.findIndex((s) => s.id === active.id);
    const newIndex = campaign.slides.findIndex((s) => s.id === over.id);
    reorderSlides(arrayMove(campaign.slides, oldIndex, newIndex));
  };

  const handleGenerate = () => {
    if (!validationId || !context) return;
    generateCarousel(validationId, context);
    setActiveSlideId(null);
    setShowPreview(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try { await saveCampaign(); } finally { setSaving(false); }
  };

  const handleExport = async (format: 'pdf' | 'zip') => {
    if (!campaign) return;
    const onProgress = (current: number, total: number) => setExportProgress({ current, total });
    setExportProgress({ current: 0, total: campaign.slides.length });
    try {
      const opts = {
        slides: campaign.slides,
        platform,
        theme,
        title: campaign.title,
        onProgress,
      };
      if (format === 'pdf') await exportAsPdf(opts);
      else await exportAsZip(opts);
    } finally {
      setExportProgress(null);
    }
  };

  const activeSlide = campaign?.slides.find((s) => s.id === activeSlideId) ?? null;

  // ── Estados: idle / generating / error / done ────────────────────────────

  if (status === 'idle' || (!campaign && status !== 'generating')) {
    if (hideConfig) return null;
    return (
      <div className="space-y-6">
        {/* Platform selector */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
            Red social de destino
          </p>
          <div className="grid grid-cols-2 gap-3">
            {PLATFORMS.map((p) => (
              <button
                key={p.value}
                onClick={() => setPlatform(p.value)}
                className={`flex items-start gap-3 p-4 rounded-xl border-2 text-left transition-all
                  ${platform === p.value
                    ? 'border-teal-500 bg-teal-50/60 dark:bg-teal-500/10'
                    : 'border-gray-100 dark:border-white/10 hover:border-gray-300'
                  }`}
              >
                <span className="text-2xl">{p.icon}</span>
                <div>
                  <p className="font-bold text-sm text-gray-900 dark:text-[#F0EFF8]">{p.label}</p>
                  <p className="text-[10px] text-gray-400">{p.desc}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Theme selector */}
        <div>
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">Tema visual</p>
          <div className="flex gap-2">
            {THEMES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all
                  ${theme === t.value
                    ? 'border-teal-500 bg-teal-50 dark:bg-teal-500/10 text-teal-700 dark:text-teal-400'
                    : 'border-gray-200 dark:border-white/10 text-gray-600 dark:text-[#8B8AA0] hover:border-gray-400'
                  }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>
        </div>

        <button
          onClick={handleGenerate}
          className="w-full py-3 bg-teal-500 text-white font-bold rounded-xl hover:bg-teal-600 active:scale-[0.98] transition-all shadow-sm shadow-teal-500/20"
        >
          ✨ Generar carrusel con IA
        </button>
      </div>
    );
  }

  if (status === 'generating') {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-4">
        <div className="w-10 h-10 border-[3px] border-teal-500 border-t-transparent rounded-full animate-spin" />
        <div className="text-center">
          <p className="text-sm font-semibold text-gray-700 dark:text-[#C4C4D4]">Generando narrativa…</p>
          <p className="text-xs text-gray-400 mt-1">La IA está estructurando tu historia</p>
        </div>
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div className="text-center py-10 space-y-4">
        <p className="text-3xl">⚠️</p>
        <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
        <button
          onClick={handleGenerate}
          className="px-5 py-2.5 bg-teal-500 text-white font-semibold rounded-xl text-sm hover:bg-teal-600 transition"
        >
          Reintentar
        </button>
      </div>
    );
  }

  // ── Editor ────────────────────────────────────────────────────────────────

  const slides = campaign!.slides;

  return (
    <div className="space-y-5">
      {/* Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-gray-500 dark:text-[#8B8AA0]">
            {campaign!.title}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-100 dark:bg-teal-500/20 text-teal-700 dark:text-teal-400 font-bold">
            v{campaign!.version}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Theme quick-switch */}
          <div className="flex gap-1">
            {THEMES.map((t) => (
              <button
                key={t.value}
                onClick={() => setTheme(t.value)}
                title={t.label}
                className={`w-6 h-6 rounded text-sm transition-all ${theme === t.value ? 'ring-2 ring-teal-500 scale-110' : 'opacity-50 hover:opacity-100'}`}
              >
                {t.icon}
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowPreview((v) => !v)}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-gray-100 dark:bg-white/10 dark:text-white hover:bg-gray-200 transition"
          >
            {showPreview ? 'Editar' : '👁 Preview'}
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-teal-500 text-white hover:bg-teal-600 transition disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar'}
          </button>
        </div>
      </div>

      {showPreview ? (
        <CarouselPreview slides={slides} theme={theme} platform={platform} />
      ) : (
        <>
          {/* Sortable grid */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={slides.map((s) => s.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-3">
                {slides.map((slide, i) => (
                  <SlideCard
                    key={slide.id}
                    slide={slide}
                    index={i + 1}
                    isActive={activeSlideId === slide.id}
                    onClick={() => setActiveSlideId(activeSlideId === slide.id ? null : slide.id)}
                    theme={theme}
                    platform={platform}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <p className="text-[10px] text-gray-300 dark:text-gray-600 text-center">
            Arrastra las slides intermedias para reordenar · Haz clic para editar
          </p>

          {/* Inline editor */}
          {activeSlide && (
            <SlideEditDrawer
              slide={activeSlide}
              onUpdate={(patch) => updateSlide(activeSlide.id, patch)}
              onClose={() => setActiveSlideId(null)}
            />
          )}
        </>
      )}

      {/* Export panel */}
      <div className="rounded-2xl border border-gray-100 dark:border-white/5 p-4 space-y-3">
        <p className="text-xs font-bold text-gray-400 uppercase tracking-wide">Exportar</p>

        {exportProgress ? (
          <div className="space-y-2">
            <div className="w-full bg-gray-100 dark:bg-white/10 rounded-full h-2 overflow-hidden">
              <div
                className="bg-teal-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${(exportProgress.current / exportProgress.total) * 100}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 text-center">
              Renderizando slide {exportProgress.current} de {exportProgress.total}…
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleExport('pdf')}
              disabled={!!exportProgress}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-gray-100 dark:border-white/10
                hover:border-teal-400 dark:hover:border-teal-500 transition-all group disabled:opacity-40"
            >
              <span className="text-2xl">📄</span>
              <span className="text-xs font-bold text-gray-700 dark:text-[#C4C4D4] group-hover:text-teal-600">
                LinkedIn PDF
              </span>
              <span className="text-[10px] text-gray-400">1080×1080 · Multipágina</span>
            </button>

            <button
              onClick={() => handleExport('zip')}
              disabled={!!exportProgress || platform !== 'instagram'}
              className="flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 border-gray-100 dark:border-white/10
                hover:border-violet-400 dark:hover:border-violet-500 transition-all group disabled:opacity-40"
            >
              <span className="text-2xl">📦</span>
              <span className="text-xs font-bold text-gray-700 dark:text-[#C4C4D4] group-hover:text-violet-600">
                Instagram ZIP
              </span>
              <span className="text-[10px] text-gray-400">1080×1350 · PNGs</span>
            </button>
          </div>
        )}

        {platform === 'linkedin' && (
          <p className="text-[10px] text-gray-300 dark:text-gray-600 text-center">
            El ZIP de Instagram solo está disponible con plataforma Instagram
          </p>
        )}
      </div>

      {/* Footer actions */}
      <div className="flex justify-between pt-2 border-t border-gray-100 dark:border-white/5">
        <button
          onClick={() => { reset(); }}
          className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
        >
          Nueva campaña
        </button>
        <button
          onClick={handleGenerate}
          className="text-xs text-teal-600 dark:text-teal-400 hover:underline font-semibold"
        >
          Regenerar ↺
        </button>
      </div>
    </div>
  );
}
