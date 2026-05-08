import { toPng } from 'html-to-image';
import JSZip from 'jszip';
import type { CarouselSlide, CarouselPlatform, CarouselTheme } from '@/types/carousel';

// ── Dimensiones por plataforma ────────────────────────────────────────────────

const DIMS: Record<CarouselPlatform, { w: number; h: number }> = {
  linkedin:  { w: 1080, h: 1080 },
  instagram: { w: 1080, h: 1350 },
};

// ── Temas → colores de render ─────────────────────────────────────────────────

interface ThemeTokens {
  bg: string;
  text: string;
  sub: string;
  accent: string;
  tag: string;
}

const THEME_TOKENS: Record<CarouselTheme, ThemeTokens> = {
  clean: {
    bg:     '#ffffff',
    text:   '#111827',
    sub:    '#6B7280',
    accent: '#14B8A6',
    tag:    '#F3F4F6',
  },
  dark: {
    bg:     '#111827',
    text:   '#F9FAFB',
    sub:    '#9CA3AF',
    accent: '#14B8A6',
    tag:    '#1F2937',
  },
  gradient: {
    bg:     'linear-gradient(135deg, #14B8A6 0%, #7C3AED 100%)',
    text:   '#ffffff',
    sub:    'rgba(255,255,255,0.75)',
    accent: '#ffffff',
    tag:    'rgba(255,255,255,0.15)',
  },
};

// ── Render de un slide a dataURL PNG ─────────────────────────────────────────

/**
 * Genera un PNG de alta resolución de un slide directamente en un canvas off-screen,
 * sin depender del DOM visible. Esto garantiza renderizado determinista en cualquier
 * resolución de pantalla y evita problemas de scroll o clipping.
 */
function renderSlideToCanvas(
  slide: CarouselSlide,
  platform: CarouselPlatform,
  theme: CarouselTheme,
  index: number,
  total: number,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const { w, h } = DIMS[platform];
    const dpr = 2; // Factor de escala para alta resolución
    const canvas = document.createElement('canvas');
    canvas.width  = w * dpr;
    canvas.height = h * dpr;
    const ctx = canvas.getContext('2d');
    if (!ctx) return reject(new Error('Canvas context unavailable'));

    ctx.scale(dpr, dpr);
    const tk = THEME_TOKENS[theme];

    // ── Fondo ──────────────────────────────────────────────────────────────
    if (theme === 'gradient') {
      const grad = ctx.createLinearGradient(0, 0, w, h);
      grad.addColorStop(0, '#14B8A6');
      grad.addColorStop(1, '#7C3AED');
      ctx.fillStyle = grad;
    } else {
      ctx.fillStyle = tk.bg;
    }
    ctx.fillRect(0, 0, w, h);

    const pad = 64;

    // ── Tag tipo slide (ej. "SLIDE 3/7") ──────────────────────────────────
    const tagText = slide.type === 'cover' ? 'PORTADA'
                  : slide.type === 'cta'   ? 'CTA'
                  : `SLIDE ${index}/${total}`;
    ctx.font = `bold 22px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillStyle = tk.sub;
    ctx.fillText(tagText, pad, pad + 22);

    // ── Emoji / ícono ───────────────────────────────────────────────────────
    let contentY = h * 0.42;
    if (slide.icon) {
      ctx.font = `${h * 0.1}px sans-serif`;
      ctx.fillText(slide.icon, pad, contentY);
      contentY += h * 0.12;
    }

    // ── Headline ────────────────────────────────────────────────────────────
    ctx.fillStyle = tk.text;
    const headlineFontSize = slide.type === 'cover' ? 72 : 60;
    ctx.font = `900 ${headlineFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    const maxWidth = w - pad * 2;
    wrapText(ctx, slide.headline, pad, contentY, maxWidth, headlineFontSize * 1.2);
    const headlineLines = measureLines(ctx, slide.headline, maxWidth);
    contentY += headlineLines * headlineFontSize * 1.2 + 24;

    // ── Body ────────────────────────────────────────────────────────────────
    ctx.fillStyle = tk.sub;
    const bodyFontSize = 36;
    ctx.font = `400 ${bodyFontSize}px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    wrapText(ctx, slide.body, pad, contentY, maxWidth, bodyFontSize * 1.5);

    // ── CTA pill (solo slide tipo cta) ─────────────────────────────────────
    if (slide.type === 'cta') {
      const pillY = h - pad - 60;
      const pillW = 320;
      const pillH = 60;
      const pillX = pad;
      const radius = 16;

      ctx.fillStyle = tk.accent;
      ctx.beginPath();
      ctx.moveTo(pillX + radius, pillY);
      ctx.lineTo(pillX + pillW - radius, pillY);
      ctx.quadraticCurveTo(pillX + pillW, pillY, pillX + pillW, pillY + radius);
      ctx.lineTo(pillX + pillW, pillY + pillH - radius);
      ctx.quadraticCurveTo(pillX + pillW, pillY + pillH, pillX + pillW - radius, pillY + pillH);
      ctx.lineTo(pillX + radius, pillY + pillH);
      ctx.quadraticCurveTo(pillX, pillY + pillH, pillX, pillY + pillH - radius);
      ctx.lineTo(pillX, pillY + radius);
      ctx.quadraticCurveTo(pillX, pillY, pillX + radius, pillY);
      ctx.closePath();
      ctx.fill();

      ctx.fillStyle = theme === 'gradient' ? '#14B8A6' : '#ffffff';
      ctx.font = `bold 28px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Comenzar ahora →', pillX + pillW / 2, pillY + 38);
      ctx.textAlign = 'left';
    }

    // ── Número de slide (pie) ──────────────────────────────────────────────
    ctx.fillStyle = tk.sub;
    ctx.font = `400 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;
    ctx.fillText(`${index} / ${total}`, w - pad - 60, h - pad);

    resolve(canvas.toDataURL('image/png'));
  });
}

// ── Helpers de texto multilinea ───────────────────────────────────────────────

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  if (line) ctx.fillText(line, x, currentY);
}

function measureLines(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): number {
  const words = text.split(' ');
  let line = '';
  let lines = 1;
  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      lines++;
      line = word;
    } else {
      line = testLine;
    }
  }
  return lines;
}

// ── Exportación DOM → PNG (para slides ya renderizados en el editor) ──────────

/**
 * Captura un nodo DOM visible del editor. Útil como alternativa rápida
 * cuando el slide ya está renderizado con estilos Tailwind exactos.
 */
export async function captureDomNode(node: HTMLElement, platform: CarouselPlatform): Promise<string> {
  const { w, h } = DIMS[platform];
  return toPng(node, {
    width: w,
    height: h,
    pixelRatio: 2,
    cacheBust: true,
    style: { fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' },
  });
}

// ── API pública ───────────────────────────────────────────────────────────────

export interface ExportOptions {
  slides: CarouselSlide[];
  platform: CarouselPlatform;
  theme: CarouselTheme;
  title: string;
  onProgress?: (current: number, total: number) => void;
}

/**
 * Exporta el carrusel como PDF multipágina (LinkedIn).
 * Cada diapositiva ocupa una página con las dimensiones exactas 1080×1080.
 */
export async function exportAsPdf(opts: ExportOptions): Promise<void> {
  const { slides, platform, theme, title, onProgress } = opts;
  const { jsPDF } = await import('jspdf');
  const { w, h } = DIMS[platform];
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'px',
    format: [w, h],
    hotfixes: ['px_scaling'],
  });

  for (let i = 0; i < slides.length; i++) {
    onProgress?.(i + 1, slides.length);
    const dataUrl = await renderSlideToCanvas(slides[i], platform, theme, i + 1, slides.length);

    if (i > 0) doc.addPage([w, h], 'portrait');
    doc.addImage(dataUrl, 'PNG', 0, 0, w, h);
  }

  const filename = `${title.replace(/\s+/g, '_').toLowerCase()}_linkedin.pdf`;
  doc.save(filename);
}

/**
 * Exporta el carrusel como ZIP de PNGs (Instagram).
 * Cada diapositiva se guarda como slide_01.png … slide_07.png a 1080×1350.
 */
export async function exportAsZip(opts: ExportOptions): Promise<void> {
  const { slides, platform, theme, title, onProgress } = opts;
  const zip = new JSZip();
  const folder = zip.folder(title.replace(/\s+/g, '_').toLowerCase()) ?? zip;

  for (let i = 0; i < slides.length; i++) {
    onProgress?.(i + 1, slides.length);
    const dataUrl = await renderSlideToCanvas(slides[i], platform, theme, i + 1, slides.length);
    // Extraer base64 sin el prefijo data:image/png;base64,
    const base64 = dataUrl.split(',')[1];
    const filename = `slide_${String(i + 1).padStart(2, '0')}.png`;
    folder.file(filename, base64, { base64: true });
  }

  const blob = await zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${title.replace(/\s+/g, '_').toLowerCase()}_instagram.zip`;
  a.click();
  URL.revokeObjectURL(a.href);
}
