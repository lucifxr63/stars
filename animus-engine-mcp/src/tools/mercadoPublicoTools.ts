import { z } from 'zod';
import { raasGet } from '../client/raasClient.js';

/**
 * Mercado Público: buscador unificado, ficha de detalle y organismos compradores.
 *
 * Se pagina con `page_size`, NO con `limit`: el gateway ignora el segundo. Las
 * herramientas retiradas en 0.1.1 (`animus_licitus_*`) enviaban `limit` y por eso
 * devolvían siempre 20 ítems (~92 KB) sin importar lo pedido — en un MCP eso
 * llena el contexto del modelo en cada llamada.
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

/**
 * Las cuatro vías por las que el Estado de Chile compra, con su volumen real
 * verificado el 2026-08-04 contra `licitaciones_mercado_publico`.
 *
 * Acá decía sólo `tender | agile_purchase`. Las otras dos existen en la tabla y
 * son perfectamente consultables —`?type=trato_directo` devuelve sus 30 filas—
 * pero al no estar declaradas el modelo no tenía forma de saberlo y nunca las
 * pedía: 272 registros invisibles por una descripción incompleta, no por falta
 * de endpoint.
 */
const VIAS_DE_COMPRA =
  'Vía de compra. Omitir para buscar en las cuatro. ' +
  'tender = licitación tradicional (13.990). ' +
  'agile_purchase = compra ágil, monto menor y proceso rápido (24.043). ' +
  'convenio_marco = compra contra catálogo ya licitado (242). ' +
  'trato_directo = adjudicación SIN competencia, por excepción legal (30) — es la vía con ' +
  'menos competencia y la de mayor interés para auditoría.'

export const MpOportunidadesSchema = z
  .object({
    q: z.string().optional().describe('Término de búsqueda libre sobre el título.'),
    type: z.string().optional().describe(VIAS_DE_COMPRA),
    status: z.string().optional().describe('publicada | cerrada | adjudicada.'),
    page: z.number().optional(),
    page_size: z.number().optional().describe('Default 20. Súbelo sólo si hace falta: cada ítem es voluminoso.'),
  })
  .describe(
    'Buscador UNIFICADO de compras del Estado de Chile (Mercado Público). Es la puerta de ' +
      'entrada a las cuatro vías por las que el Estado compra, en una sola consulta. Usar ' +
      'siempre que no se sepa de antemano por cuál se publicó lo que se busca.',
  );

export const MpOfertasSchema = z
  .object({
    codigo: z
      .string()
      .optional()
      .describe('external_code de una compra ágil. Devuelve TODOS los que cotizaron por ella.'),
    rut: z
      .string()
      .optional()
      .describe('RUT del proveedor, con o sin puntos. Devuelve su historial y su tasa de adjudicación.'),
    solo_adjudicadas: z.boolean().optional().describe('Sólo las ofertas que ganaron.'),
    page: z.number().optional(),
    page_size: z.number().optional().describe('Default 20.'),
  })
  .describe(
    'La COMPETENCIA real de las compras del Estado: quién cotizó, por cuánto, quién ganó y con ' +
      'qué argumento se declaró inadmisible al resto. Requiere `codigo` (para ver quiénes ' +
      'compitieron por una compra) o `rut` (para ver cómo le va a un proveedor).\n' +
      'LÍMITE: sólo compras ágiles concluidas. Licitaciones, convenios marco y tratos directos ' +
      'no publican oferentes en esta fuente, y las compras aún abiertas todavía no los muestran: ' +
      'hay datos de 1.308 de las 24.043 compras ágiles.',
  );

export const MpDetalleSchema = z
  .object({
    codigo: z
      .string()
      .describe(
        'Código externo tal como lo devuelve el buscador en `external_code` ' +
          '(ej: "4429-45-L126" para licitación, "1233619-464-COT26" para compra ágil).',
      ),
  })
  .describe(
    'Ficha completa de UNA oportunidad: ítems, adjuntos, montos, organismo comprador y fechas. ' +
      'Usar después de `animus_mp_oportunidades`, cuando ya se identificó cuál interesa y hace ' +
      'falta el detalle que el listado no trae.',
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

/**
 * La ruta se llama `/licitaciones/:codigo` por historia, pero resuelve cualquier
 * `external_code`: verificado el 2026-08-04 contra los cuatro tipos —licitación
 * (4429-45-L126), compra ágil (1233619-464-COT26), convenio marco (3134-50-CO26)
 * y trato directo (3890-130-E226)—, los cuatro responden 200. Por eso la
 * herramienta puede prometer las cuatro vías sin mentir.
 */
export async function executeMpDetalle(args: z.infer<typeof MpDetalleSchema>) {
  const codigo = encodeURIComponent(args.codigo.trim());
  return texto(await raasGet(`/mercado-publico/licitaciones/${codigo}`));
}

/**
 * El gateway exige `codigo` o `rut` y devuelve 400 si no llega ninguno. Se
 * valida también acá para no gastar una llamada —y un crédito— en un error que
 * se puede detectar antes de salir.
 */
export async function executeMpOfertas(args: z.infer<typeof MpOfertasSchema>) {
  if (!args.codigo && !args.rut) {
    throw new Error(
      'Indica `codigo` (para ver quiénes compitieron por una compra ágil) o `rut` ' +
        '(para ver el historial de un proveedor). Sin filtro serían 7.111 ofertas.',
    );
  }
  return texto(await raasGet('/mercado-publico/ofertas', params(args)));
}

export async function executePjudEstadisticas(args: z.infer<typeof PjudEstadisticasSchema>) {
  return texto(await raasGet('/data/pjud/estadisticas', params(args)));
}
