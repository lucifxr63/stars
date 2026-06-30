// ─── Trust copy: fuente única de verdad para la procedencia y el disclaimer ────
// Fase 14 (#6): el texto legal/interpretativo del Trust Layer vivía solo en la UI
// (TrustLayer.tsx). Aquí se centraliza para reusarlo en la UI Y en los PDF
// investor-facing (dossier, dossier premium, pitch deck), evitando que el copy
// legal derive entre superficies. NO produce datos: solo guía de interpretación.

/** Disclaimer legal canónico. Debe ser idéntico en UI y en todos los PDF. */
export const TRUST_DISCLAIMER =
  'Validus no entrega asesoría legal, financiera ni de inversión. La IA puede cometer ' +
  'errores; los resultados son orientativos. Valida la información crítica de forma ' +
  'independiente antes de tomar decisiones.';

/** Nota breve por sección (versión corta del disclaimer). */
export const TRUST_SECTION_NOTE =
  'Este análisis combina datos del usuario, inferencias de IA y, cuando está disponible, ' +
  'fuentes externas. Es orientativo, no asesoría: valida la información crítica antes de decidir.';

/** Título del bloque de interpretación en el dossier. */
export const TRUST_LEGEND_TITLE = 'Cómo leer este dossier';

/** Subtítulo/intro del bloque de interpretación. */
export const TRUST_LEGEND_INTRO =
  'Validus separa lo que es dato, inferencia y supuesto para que decidas con criterio. ' +
  'Estas etiquetas son una guía de interpretación, no una certificación.';

/** Leyenda de procedencia como datos planos (label + descripción), apta para PDF y UI. */
export const TRUST_LEGEND: { label: string; description: string }[] = [
  { label: 'Dato del usuario', description: 'Información entregada por ti.' },
  { label: 'Fuente externa', description: 'Proviene de una fuente externa, cuando está disponible.' },
  { label: 'Inferencia IA', description: 'Conclusión derivada por la IA. Interpretación, no un hecho verificado.' },
  { label: 'Supuesto', description: 'Condición asumida ante falta de información. Hipótesis a validar.' },
  { label: 'No disponible', description: 'La fuente no está disponible. No se inventan datos para reemplazarla.' },
  { label: 'Datos demo', description: 'Contenido demostrativo / simulado. No representa evidencia real.' },
  { label: 'Requiere validación', description: 'Verifica esta información de forma independiente antes de decidir.' },
];

/** Niveles de confianza como datos planos, para la leyenda del PDF. */
export const TRUST_CONFIDENCE_LEVELS: { label: string }[] = [
  { label: 'Confianza alta' },
  { label: 'Confianza media' },
  { label: 'Confianza baja' },
  { label: 'Confianza no evaluada' },
];
