import { z } from 'zod';
import { raasGet } from '../client/raasClient.js';

/**
 * Mercado Público: buscador unificado, ficha de detalle y organismos compradores.
 *
 * Se pagina con `page_size`, NO con `limit`: el gateway ignora el segundo. Las
 * herramientas retiradas en 0.1.1 (`animus_licitus_*`) enviaban `limit` y por eso
 * devolvían siempre 20 ítems (~92 KB) sin importar lo pedido — en un MCP eso
 * llena el contexto del modelo en cada llamada.
 *
 * POR QUÉ LAS DESCRIPCIONES SON CONSTANTES EXPORTADAS
 * ---------------------------------------------------
 * Lo que el modelo lee NO es el `.describe()` de estos esquemas Zod: es el
 * `inputSchema` que `index.ts` devuelve en `tools/list`. Los Zod sólo se usan
 * para `.parse()` al ejecutar. Mientras el texto estuvo escrito dos veces, las
 * dos copias divergieron sin que nada fallara: la 0.1.2 agregó acá la cobertura
 * real de la ficha (`COBERTURA_DETALLE`) y el modelo siguió recibiendo la
 * promesa vieja de "ítems, adjuntos, montos" — justo el texto que ese cambio
 * venía a corregir.
 *
 * Exportarlas y que `index.ts` las importe deja UNA sola fuente. Al agregar una
 * herramienta nueva, la descripción va acá y se importa, no se copia.
 */

/**
 * Los 33.682 que decía esta descripción no eran organismos: era el número de
 * FILAS de la tabla de oportunidades en la fecha en que se escribió. El endpoint
 * pagina sobre esas filas y deduplica sólo DENTRO de cada página, así que un
 * mismo organismo reaparece en muchas páginas y `meta.total` cuenta compras, no
 * compradores. Medido el 2026-08-12: 2.705 organismos distintos entre 60.528
 * filas — la cifra publicada estaba 12 veces inflada.
 */
export const DESC_ORGANISMOS =
  'Directorio de organismos compradores del Estado de Chile: 2.705 distintos ' +
  '(medido 2026-08-12). Devuelve nombre y código de organismo, que sirve para cruzar con ' +
  'licitaciones. Buscar por nombre parcial.\n' +
  'LÍMITE CONOCIDO: la deduplicación es por página, no global. `meta.total` informa las ' +
  '60.528 filas de oportunidades, NO la cantidad de organismos, y un mismo comprador puede ' +
  'repetirse entre páginas. No uses `meta.total` como conteo de organismos.';

export const MpOrganismosSchema = z
  .object({
    nombre: z
      .string()
      .optional()
      .describe('Búsqueda parcial por nombre. Ej: "MINEDUC", "MUNICIPALIDAD".'),
    page: z.number().optional(),
    page_size: z.number().optional().describe('Default 20.'),
  })
  .describe(DESC_ORGANISMOS);

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
/**
 * Volúmenes medidos contra producción el 2026-08-12. Los anteriores eran del
 * 04/08 y sumaban 38.305: la tabla creció 58 % en una semana y la cifra vieja
 * apareció como "inconsistencia" en la revisión de un integrador, que comparaba
 * nuestro `health` (correcto) contra nuestra documentación (vieja). Al tocarlos,
 * remedir — no arrastrar.
 */
export const DESC_VIAS_DE_COMPRA =
  'Vía de compra. Omitir para buscar en las cuatro. ' +
  'tender = licitación tradicional (15.669). ' +
  'agile_purchase = compra ágil, monto menor y proceso rápido (44.545). ' +
  'convenio_marco = compra contra catálogo ya licitado (274). ' +
  'trato_directo = adjudicación SIN competencia, por excepción legal (40) — es la vía con ' +
  'menos competencia y la de mayor interés para auditoría. ' +
  'Total 60.528 al 2026-08-12.';

export const DESC_OPORTUNIDADES =
  'Buscador UNIFICADO de compras del Estado de Chile (Mercado Público). Es la puerta de ' +
  'entrada a las cuatro vías por las que el Estado compra, en una sola consulta. Usar ' +
  'siempre que no se sepa de antemano por cuál se publicó lo que se busca.';

/** Los cinco valores reales de `status_code`, contados el 2026-08-12. */
export const DESC_STATUS =
  'publicada (32.146) | cerrada (16.293) | adjudicada (8.483) | revocada (1.804) | ' +
  'desierta (1.802). Coincidencia exacta.';

export const DESC_SORT =
  'closing_at | published_at | amount_estimated. Por defecto published_at. ' +
  'Para "las que cierran primero": sort=closing_at con order=asc.';

export const MpOportunidadesSchema = z
  .object({
    q: z.string().optional().describe('Término de búsqueda libre sobre el título.'),
    type: z.string().optional().describe(DESC_VIAS_DE_COMPRA),
    status: z.string().optional().describe(DESC_STATUS),
    region: z.string().optional().describe('Coincidencia parcial. Ej: "Biobío", "Metropolitana".'),
    buyer_rut: z.string().optional().describe('RUT del organismo comprador, exacto.'),
    buyer_name: z.string().optional().describe('Nombre del organismo, coincidencia parcial.'),
    amount_min: z.number().optional().describe('Monto estimado mínimo, en la moneda del proceso.'),
    amount_max: z
      .number()
      .optional()
      .describe(
        'Monto estimado máximo. OJO: filtrar por monto EXCLUYE los procesos con presupuesto ' +
          'oculto (amount_is_public = false), porque su 0 no es un cero real.',
      ),
    closing_from: z.string().optional().describe('Cierre desde (ISO 8601, ej: 2026-08-20).'),
    closing_to: z.string().optional().describe('Cierre hasta (ISO 8601).'),
    sort: z.string().optional().describe(DESC_SORT),
    order: z.string().optional().describe('asc | desc. Por defecto desc.'),
    page: z.number().optional(),
    page_size: z.number().optional().describe('Default 20, máximo 100. Cada ítem es voluminoso.'),
  })
  .describe(DESC_OPORTUNIDADES);

export const DESC_OFERTAS =
  'La COMPETENCIA real de las compras del Estado: quién cotizó, por cuánto, quién ganó y con ' +
  'qué argumento se declaró inadmisible al resto. Requiere `codigo` (para ver quiénes ' +
  'compitieron por una compra) o `rut` (para ver cómo le va a un proveedor, con su tasa de ' +
  'adjudicación).\n' +
  'COBERTURA (medida 2026-08-12): 16.919 ofertas de 3.990 proveedores sobre 3.122 compras, ' +
  'con 2.633 adjudicaciones y 2.583 motivos de inadmisibilidad.\n' +
  'LÍMITE: sólo compras ágiles concluidas. Licitaciones, convenios marco y tratos directos ' +
  'no publican oferentes en esta fuente, y las compras aún abiertas todavía no los muestran: ' +
  'hay datos de 3.122 de las 44.545 compras ágiles (7 %). Un `codigo` sin ofertas casi siempre ' +
  'significa que el proceso sigue abierto o no es compra ágil, no que nadie se haya presentado.';

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
  .describe(DESC_OFERTAS);

export const DESC_PRECIOS =
  'Precios de referencia por producto: cuánto se paga en el Estado, según lo que realmente ' +
  'cotizaron los proveedores.\n' +
  'CÓMO LEER EL RESULTADO: usa `mediana` junto al rango `p25`–`p75`, nunca mínimo/máximo. ' +
  'Cada fila trae `fiabilidad` y `ratio_p75_p25`: si el ratio es alto, ese código UNSPSC ' +
  'agrupa productos distintos y la mediana NO es un precio, es el promedio de cosas que no ' +
  'se comparan. No presentes un número sin mirar antes esa señal.';

export const MpPreciosSchema = z
  .object({
    q: z.string().optional().describe('Búsqueda por nombre de producto. Ej: "guantes", "toner", "papel".'),
    codigo_producto: z.string().optional().describe('Código UNSPSC exacto, si ya se conoce.'),
    min_muestras: z.number().optional().describe('Mínimo de cotizaciones para incluir un código. Default 5.'),
  })
  .describe(DESC_PRECIOS);

/**
 * Qué trae y qué NO trae la ficha, con los números medidos el 2026-08-11 sobre
 * las 59.932 filas de `licitaciones_mercado_publico`.
 *
 * La descripción anterior prometía "ítems, adjuntos, montos, organismo comprador
 * y fechas". Los adjuntos salían SIEMPRE vacíos —el mapper canónico los
 * descartaba— y los ítems faltan en 4 de cada 5 licitaciones. Un modelo que lee
 * esa promesa y encuentra `[]` no puede distinguir un bug de un proceso que
 * genuinamente no tiene bases, así que rellena el hueco. Es el mismo defecto
 * que las advertencias de PJUD vinieron a cerrar: lo que la fuente no da hay
 * que decirlo donde el modelo lo lea, no en el README.
 */
export const DESC_DETALLE =
  'Ficha completa de UNA oportunidad. Usar después de `animus_mp_oportunidades`, cuando ya se ' +
  'identificó cuál interesa y hace falta el detalle que el listado no trae.\n' +
  'TRAE: cronograma completo (publicación, cierre, foro de preguntas, publicación de respuestas, ' +
  'apertura técnica y económica, adjudicación estimada), comprador con RUT, región, comuna, ' +
  'dirección y encargado, monto con su visibilidad, e ítems por línea.\n' +
  'COBERTURA REAL — no asumir que un campo vacío es un error:\n' +
  '· Ítems: presentes en el 87,7 % de las compras ágiles pero sólo en el 21,3 % de las ' +
  'licitaciones (medido 2026-08-12).\n' +
  // Medido contra producción el 2026-08-12. La versión anterior afirmaba que en
  // licitación `attachments` "va vacío siempre porque la fuente no lo expone", y
  // es falso: hay 5.584 con enlace de descarga real. Lo que NO hay es adjuntos
  // en las licitaciones ABIERTAS — aparecen recién al cerrar. La distinción
  // importa porque quien prepara una oferta sólo mira procesos abiertos, y
  // decirle "no existe" lo manda a buscar a otra parte en vez de a la ficha web.
  '· `attachments`: en Compra Ágil hay 31.906 fichas con documentos, con `id` y `nombre` pero ' +
  'SIN enlace de descarga (`url` va en null); 936 de las 1.162 abiertas los traen. En ' +
  'licitación hay 5.584 CON enlace de descarga real, pero NINGUNA de las 2.273 abiertas: los ' +
  'adjuntos aparecen recién cuando el proceso cierra. Para preparar una oferta sobre un ' +
  'proceso abierto hay que ir a la ficha web de Mercado Público (`official_url`).\n' +
  '· `amount_estimated = 0` NO significa que no haya presupuesto: mirar `amount_is_public` ' +
  '(false = el organismo lo ocultó) y `amount_estimation_type` (3 = no estimable).\n' +
  '· Contacto SÍ disponible en licitación: contacto del comprador 100 %, dirección 92 %, ' +
  'nombre del responsable de contrato 90 %.\n' +
  '· Visita a terreno, entrega de antecedentes y EMAIL del responsable: MP devuelve la clave ' +
  'pero nunca la llena — 0 de 15.983 fichas. No es un fallo de ingesta, la fuente va vacía.\n' +
  'NO EXISTEN en esta fuente, no los inventes ni los busques en otra herramienta: criterios de ' +
  'evaluación con ponderación, garantías exigidas y requisitos de habilidad de los oferentes.';

export const MpDetalleSchema = z
  .object({
    codigo: z
      .string()
      .describe(
        'Código externo tal como lo devuelve el buscador en `external_code` ' +
          '(ej: "4429-45-L126" para licitación, "1233619-464-COT26" para compra ágil).',
      ),
  })
  .describe(DESC_DETALLE);

export const DESC_PJUD_ESTADISTICAS =
  'Series AGREGADAS del Poder Judicial: presupuesto, dotación, adquisiciones y cuenta ' +
  'pública. Distintas de las causas individuales — acá no hay roles ni fallos, son ' +
  'totales institucionales.';

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
  .describe(DESC_PJUD_ESTADISTICAS);

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

export async function executeMpPrecios(args: z.infer<typeof MpPreciosSchema>) {
  return texto(await raasGet('/mercado-publico/precios', params(args)));
}

export async function executePjudEstadisticas(args: z.infer<typeof PjudEstadisticasSchema>) {
  return texto(await raasGet('/data/pjud/estadisticas', params(args)));
}
