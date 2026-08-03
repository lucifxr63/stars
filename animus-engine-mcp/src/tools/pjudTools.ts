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
      .describe('Confirmados, Revocados, Rechazados, Inadmisibles, Acogidos, Desistidos.'),
    sala: z.string().optional().describe('Coincidencia parcial.'),
    serie: z.string().optional(),
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

const texto = (result: unknown) => ({
  content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
});

export async function executePjudTendencias(args: z.infer<typeof PjudTendenciasSchema>) {
  const params: Record<string, string> = {};
  if (args.libro) params.libro = args.libro;
  if (args.tipo_recurso) params.tipo_recurso = args.tipo_recurso;
  if (args.sala) params.sala = args.sala;
  return texto(await raasGet('/data/pjud/suprema/tendencias', params));
}

export async function executePjudResumen(args: z.infer<typeof PjudResumenSchema>) {
  const params: Record<string, string | number> = {};
  if (args.anio) params.anio = args.anio;
  if (args.serie) params.serie = args.serie;
  return texto(await raasGet('/data/pjud/suprema/resumen', params));
}

export async function executePjudCausas(args: z.infer<typeof PjudCausasSchema>) {
  const params: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(args)) {
    if (v !== undefined && v !== null) params[k] = v as string | number;
  }
  return texto(await raasGet('/data/pjud/suprema/causas', params));
}

export async function executePjudCausa(args: z.infer<typeof PjudCausaSchema>) {
  const ruta = `/data/pjud/suprema/causas/${encodeURIComponent(args.libro)}/${args.rol}/${args.ano_rol}`;
  return texto(await raasGet(ruta));
}
