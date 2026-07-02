import { describe, it, expect } from 'vitest';
import {
  summarizeGenerationProgress,
  getGenerationTaskLabel,
  getGenerationHealth,
} from '@/lib/generationProgress';

// Helpers puros que leen validations.generation_progress (Record<taskKey,'success'|'error'>,
// clave ausente = pendiente). Se testea comportamiento, no detalles visuales.

describe('summarizeGenerationProgress', () => {
  it('null / undefined → todo en cero, sin crashear', () => {
    for (const input of [null, undefined]) {
      const s = summarizeGenerationProgress(input);
      expect(s.total).toBe(0);
      expect(s.completed).toBe(0);
      expect(s.failed).toBe(0);
      expect(s.pending).toBe(0);
      expect(s.tasks).toEqual([]);
      expect(s.failedLabels).toEqual([]);
      expect(s.completedLabels).toEqual([]);
    }
  });

  it('objeto vacío → total 0', () => {
    expect(summarizeGenerationProgress({}).total).toBe(0);
  });

  it('todas success', () => {
    const s = summarizeGenerationProgress({ summary: 'success', market: 'success' });
    expect(s.total).toBe(2);
    expect(s.completed).toBe(2);
    expect(s.failed).toBe(0);
    expect(s.failedLabels).toEqual([]);
    expect(s.completedLabels).toEqual(['Resumen ejecutivo', 'Mercado']);
  });

  it('mezcla success + error → conteos y failedLabels legibles', () => {
    const s = summarizeGenerationProgress({ summary: 'success', market: 'error', competitors: 'success' });
    expect(s.total).toBe(3);
    expect(s.completed).toBe(2);
    expect(s.failed).toBe(1);
    expect(s.failedLabels).toEqual(['Mercado']);
  });

  it('todas error', () => {
    const s = summarizeGenerationProgress({ summary: 'error', market: 'error' });
    expect(s.total).toBe(2);
    expect(s.completed).toBe(0);
    expect(s.failed).toBe(2);
    expect(s.failedLabels).toEqual(['Resumen ejecutivo', 'Mercado']);
  });

  it('claves desconocidas → etiqueta legible en el resumen', () => {
    const s = summarizeGenerationProgress({ due_diligence: 'error' });
    expect(s.total).toBe(1);
    expect(s.failed).toBe(1);
    expect(s.failedLabels).toEqual(['Due Diligence']);
  });

  it('valores raros/no esperados se tratan como pendientes, sin romper', () => {
    const s = summarizeGenerationProgress({ summary: 'success', market: 'weird', competitors: '' } as Record<string, string>);
    expect(s.total).toBe(3);
    expect(s.completed).toBe(1);
    expect(s.failed).toBe(0);
    expect(s.pending).toBe(2);
  });
});

describe('getGenerationTaskLabel', () => {
  it('mapea claves conocidas', () => {
    expect(getGenerationTaskLabel('summary')).toBe('Resumen ejecutivo');
    expect(getGenerationTaskLabel('summary_quick')).toBe('Resumen ejecutivo');
    expect(getGenerationTaskLabel('market')).toBe('Mercado');
    expect(getGenerationTaskLabel('market_sizing')).toBe('Mercado');
    expect(getGenerationTaskLabel('competitors')).toBe('Competencia');
    expect(getGenerationTaskLabel('competitive_analysis')).toBe('Competencia');
  });

  it('clave desconocida → fallback legible (snake_case → Título)', () => {
    expect(getGenerationTaskLabel('due_diligence')).toBe('Due Diligence');
    expect(getGenerationTaskLabel('financial-analysis')).toBe('Financial Analysis');
  });

  it('no crashea con clave vacía', () => {
    expect(() => getGenerationTaskLabel('')).not.toThrow();
    expect(getGenerationTaskLabel('')).toBe('');
  });
});

describe('getGenerationHealth', () => {
  it('completed → completed', () => {
    expect(getGenerationHealth('completed', { summary: 'success' })).toBe('completed');
  });

  it('partial → partial', () => {
    expect(getGenerationHealth('partial', { summary: 'success', market: 'error' })).toBe('partial');
  });

  it('failed → failed', () => {
    expect(getGenerationHealth('failed', { summary: 'error' })).toBe('failed');
  });

  it('in_progress con solo éxitos → generating', () => {
    expect(getGenerationHealth('in_progress', { summary: 'success' })).toBe('generating');
  });

  it('in_progress con éxitos y errores → partial (refuerzo por progreso)', () => {
    expect(getGenerationHealth('in_progress', { summary: 'success', market: 'error' })).toBe('partial');
  });

  it('in_progress con progreso vacío → generating', () => {
    expect(getGenerationHealth('in_progress', {})).toBe('generating');
    expect(getGenerationHealth('in_progress', null)).toBe('generating');
  });

  it('status desconocido / null → unknown', () => {
    expect(getGenerationHealth(null)).toBe('unknown');
    expect(getGenerationHealth(undefined)).toBe('unknown');
    expect(getGenerationHealth('archived')).toBe('unknown');
  });
});
