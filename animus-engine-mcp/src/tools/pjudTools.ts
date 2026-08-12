import { z } from 'zod';
import { raasGet } from '../client/raasClient.js';

/**
 * Herramientas de la Corte Suprema para el MCP.
 *
 * POR QUÉ EXISTEN
 * ---------------
 * El servidor exponía 7 herramientas y ninguna llegaba a los datos judiciales,
 * así que desde Claude Desktop no había forma de consultar las 1.706.941 causas
 * de la Corte Suprema — sólo se las podía rozar con `animus_intel_query`, que
 * devuelve los nodos de síntesis en prosa pero no las cifras.
 *
 * Quien valida el dato necesita justamente las cifras: la serie por año, los
 * totales por dimensión y causas concretas para revisar a mano.
 *
 * DESCRIPCIONES ORIENTADAS AL MODELO
 * ----------------------------------
 * Las descripciones dicen QUÉ MIDE cada cosa y, sobre todo, qué NO mide. Un
 * modelo que lee "tendencias" sin más asume que puede comparar ingresos con
 * términos del mismo año y sacar un saldo pendiente — que es exactamente el
 * error que el dato no soporta, porque una causa ingresada un año puede fallarse
 * en otro.
 */

export const PjudTendenciasSchema = z
  .object({
    libro: z.string().optional().describe('Civil, Criminal, Familia, Reforma Laboral, etc.'),
    tipo_recurso: z
      .string()
      .optional()
      .describe('Coincidencia parcial. Ej: "Protección", "Amparo", "Casación".'),
    sala: z
      .string()
      .optional()
      .describe('Coincidencia parcial. Ej: "CONSTITUCIONAL", "PENAL", "MIXTA".'),
  })
  .describe(
    'Serie por año de la Corte Suprema de Chile: volumen de causas falladas, ' +
      'porcentaje de confirmados y revocados, y duración media entre ingreso y fallo. ' +
      'Cubre 2020-2025 y SÓLO la serie de términos (causas ya falladas).',
  );

export const PjudResumenSchema = z
  .object({
    anio: z.number().optional().describe('Año a consultar. Sin esto agrega los seis años.'),
    serie: z
      .string()
      .optional()
      .describe(
        'terminos_suprema_detalle (falladas) | ingresos_recursos_suprema_detalle (ingresadas) | ' +
          'inventario_suprema_detalle (pendientes). Sin esto mezcla las tres.',
      ),
  })
  .describe(
    'Totales de la Corte Suprema por año, serie, libro, tipo de recurso, sala y grupo de término.',
  );

export const PjudCausasSchema = z
  .object({
    anio: z.number().optional(),
    libro: z.string().optional(),
    tipo_recurso: z.string().optional().describe('Coincidencia parcial.'),
    grupo_termino: z
      .string()
      .optional()
      .describe(
        'Coincidencia EXACTA, no parcial: Confirmados, Revocados, Rechazados, Inadmisibles, ' +
          'Acogidos, Desistidos. La lista no es exhaustiva y un valor inexistente devuelve 0 ' +
          'filas sin error.',
      ),
    sala: z.string().optional().describe('Coincidencia parcial.'),
    serie: z
      .string()
      .optional()
      .describe(
        'terminos_suprema_detalle (falladas) | ingresos_recursos_suprema_detalle (ingresadas) | ' +
          'inventario_suprema_detalle (pendientes). Otro valor devuelve 400.',
      ),
    page: z.number().optional(),
    page_size: z.number().optional().describe('Máximo 200.'),
  })
  .describe(
    'Causas individuales de la Corte Suprema, con rol, libro, tipo de recurso, sala y fechas. ' +
      'Sirve para revisar casos concretos detrás de una cifra agregada.',
  );

export const PjudCausaSchema = z
  .object({
    libro: z.string().describe('Ej: Reforma, Civil, Criminal, Familia.'),
    rol: z.number().describe('Número de rol.'),
    ano_rol: z.number().describe('Año del rol.'),
  })
  .describe(
    'Historia completa de UNA causa. Devuelve un ARREGLO: la misma causa puede aparecer ' +
      'como ingresada, en inventario y con más de un término — una causa puede terminarse ' +
      'más de una vez, con distinto resultado cada vez.',
  );

/**
 * ADVERTENCIAS QUE VIAJAN CON LOS DATOS
 * -------------------------------------
 * Estas tres cosas se sabían desde antes y estaban escritas en el README y en
 * `docs/PJUD_VALIDACION_EXPERTO.md`. El problema es que **el modelo que llama la
 * herramienta no lee ninguno de los dos**: sólo ve la descripción de la
 * herramienta —que compite con otras 13— y la respuesta.
 *
 * El resultado previsible es que alguien pida tendencias y publique "la Corte
 * Suprema revoca el 56 % de las causas", que es exactamente el error de lectura
 * que le estamos pidiendo a un abogado que detecte. Poner el aviso en la
 * RESPUESTA es lo único que garantiza que el modelo lo tenga delante en el
 * momento de interpretar.
 *
 * Las cifras están verificadas contra la base el 2026-08-04.
 */
const AVISOS = {
  SOLO_FALLADAS:
    'Cubre SÓLO causas ya falladas (serie de términos). No sirve para medir causas pendientes.',

  SERIES_DISJUNTAS:
    'Ingresos (797.187), inventario (114.819) y términos (794.935) son series DISJUNTAS. ' +
    'Restar ingresos menos términos NO da causas pendientes: una causa ingresada un año puede ' +
    'fallarse en otro, y esa resta arroja 153 % de "resolución" en 2024. El pendiente real es el inventario.',

  PROTECCION_DOMINA:
    'Cualquier porcentaje global describe casi sólo recursos de PROTECCIÓN: 694.025 de los 794.935 ' +
    'términos (87,3 %) son "(Civil) Apelación Protección". No lo presentes como "la Corte Suprema" ' +
    'sin decir de qué recurso se trata.',

  SERIE_INESTABLE:
    'La tasa de revocación NO es estable: dentro de apelación de protección va 17,0 % (2020) → ' +
    '80,6 % (2022) → 20,0 % (2025). Un promedio del período no describe la serie. Si el salto de ' +
    '2022-2023 corresponde a la ola de recursos contra isapres está PENDIENTE DE VALIDACIÓN por un experto: ' +
    'no lo afirmes como causa.',

  VOCABULARIO_POR_RECURSO:
    'El vocabulario de resultados depende del TIPO DE RECURSO, no del libro. En apelación se ' +
    'confirma/revoca; en casación y unificación se declara inadmisible, se rechaza o se acoge. En ' +
    'Reforma Laboral confirmados+revocados suman 0,4 %: un 0 % ahí no significa que no pase nada.',

  CAUSA_ES_ARREGLO:
    'Esto es un ARREGLO, no un registro. La misma causa aparece en ingresos, inventario y con uno o ' +
    'más términos, con distinto resultado cada vez (ej: Civil 289-2023 es Inadmisible en 2023-08-16 y ' +
    'Rechazado en 2025-01-24). Cuál de los términos vale está PENDIENTE DE CRITERIO EXPERTO: no asumas ' +
    'que la primera fila ni la última es la definitiva.',
} as const;

/**
 * `JSON.stringify` SIN indentar: esto lo lee un modelo, no una persona, y la
 * indentación inflaba las respuestas entre 20 % y 30 % sin aportar nada
 * (`animus_intel_query` llegaba a 25.455 caracteres, ~7.000 tokens).
 */
const texto = (result: unknown, avisos: readonly string[] = []) => {
  const encabezado = avisos.length
    ? `⚠️ CÓMO LEER ESTOS DATOS — aplica esto ANTES de afirmar nada:\n` +
      avisos.map((a) => `• ${a}`).join('\n') +
      `\n\n`
    : '';
  return { content: [{ type: 'text', text: `${encabezado}${JSON.stringify(result)}` }] };
};

export async function executePjudTendencias(args: z.infer<typeof PjudTendenciasSchema>) {
  const params: Record<string, string> = {};
  if (args.libro) params.libro = args.libro;
  if (args.tipo_recurso) params.tipo_recurso = args.tipo_recurso;
  if (args.sala) params.sala = args.sala;

  const avisos = [AVISOS.SOLO_FALLADAS, AVISOS.SERIE_INESTABLE, AVISOS.VOCABULARIO_POR_RECURSO];
  // Si ya filtró por tipo de recurso, la cifra no es global y advertir que
  // "esto es casi todo protección" sería ruido que contradice lo que pidió.
  if (!args.tipo_recurso) avisos.splice(1, 0, AVISOS.PROTECCION_DOMINA);

  return texto(await raasGet('/data/pjud/suprema/tendencias', params), avisos);
}

export async function executePjudResumen(args: z.infer<typeof PjudResumenSchema>) {
  const params: Record<string, string | number> = {};
  if (args.anio) params.anio = args.anio;
  if (args.serie) params.serie = args.serie;

  // Sin `serie` la respuesta mezcla las tres, que es justo donde nace la resta
  // inválida; con `serie` explícita ya eligió una y el aviso sobra.
  const avisos = args.serie
    ? [AVISOS.VOCABULARIO_POR_RECURSO]
    : [AVISOS.SERIES_DISJUNTAS, AVISOS.VOCABULARIO_POR_RECURSO];

  return texto(await raasGet('/data/pjud/suprema/resumen', params), avisos);
}

export async function executePjudCausas(args: z.infer<typeof PjudCausasSchema>) {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(args)) {
    if (v !== undefined && v !== null) params[k] = v as string | number;
  }
  return texto(await raasGet('/data/pjud/suprema/causas', params), [AVISOS.SERIES_DISJUNTAS]);
}

export async function executePjudCausa(args: z.infer<typeof PjudCausaSchema>) {
  const ruta = `/data/pjud/suprema/causas/${encodeURIComponent(args.libro)}/${args.rol}/${args.ano_rol}`;
  return texto(await raasGet(ruta), [AVISOS.CAUSA_ES_ARREGLO]);
}
