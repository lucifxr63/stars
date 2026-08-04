import { z } from 'zod';
import { raasGet } from '../client/raasClient.js';

/**
 * Mercado Público: organismos compradores y buscador unificado.
 *
 * Se pagina con `page_size`, NO con `limit`: el gateway ignora el segundo. Las
 * herramientas de Licitus enviaban `limit` y por eso devolvían siempre 20 ítems
 * (~92 KB) sin importar lo pedido — en un MCP eso llena el contexto del modelo
 * en cada llamada.
 */

export const MpOrganismosSchema = z
  .object({
    nombre: z
      .string()
      .optional()
      .describe('Búsqueda parcial por nombre. Ej: "MINEDUC", "MUNICIPALIDAD".'),
    page: z.number().optional(),
    page_size: z.number().optional().describe('Default 20.'),
  })
  .describe(
    'Directorio de organismos compradores del Estado de Chile (33.682 registros). ' +
      'Devuelve nombre y código de organismo, que sirve para cruzar con licitaciones.',
  );

export const MpOportunidadesSchema = z
  .object({
    q: z.string().optional().describe('Término de búsqueda libre.'),
    type: z.string().optional().describe('tender (licitación) | agile_purchase (compra ágil).'),
    status: z.string().optional().describe('publicada | cerrada | adjudicada.'),
    page: z.number().optional(),
    page_size: z.number().optional().describe('Default 20.'),
  })
  .describe(
    'Buscador UNIFICADO de oportunidades B2G: combina licitaciones tradicionales y compras ' +
      'ágiles en una sola consulta. Usar cuando no se sabe de antemano por cuál de las dos ' +
      'vías se publicó lo que se busca.',
  );

export const PjudEstadisticasSchema = z
  .object({
    serie: z
      .string()
      .optional()
      .describe('Coincidencia parcial. Ej: "cuenta-publica", "presupuesto", "adquisiciones".'),
    anio: z.number().optional(),
    page: z.number().optional(),
    page_size: z.number().optional(),
  })
  .describe(
    'Series AGREGADAS del Poder Judicial: presupuesto, dotación, adquisiciones y cuenta ' +
      'pública. Distintas de las causas individuales — acá no hay roles ni fallos, son ' +
      'totales institucionales.',
  );

const texto = (result: unknown) => ({
  content: [{ type: 'text', text: JSON.stringify(result) }],
});

const params = (args: Record<string, unknown>) => {
  const p: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(args)) {
    if (v !== undefined && v !== null) p[k] = v as string | number;
  }
  return p;
};

export async function executeMpOrganismos(args: z.infer<typeof MpOrganismosSchema>) {
  return texto(await raasGet('/mercado-publico/organismos', params(args)));
}

export async function executeMpOportunidades(args: z.infer<typeof MpOportunidadesSchema>) {
  return texto(await raasGet('/mercado-publico/opportunities', params(args)));
}

export async function executePjudEstadisticas(args: z.infer<typeof PjudEstadisticasSchema>) {
  return texto(await raasGet('/data/pjud/estadisticas', params(args)));
}
