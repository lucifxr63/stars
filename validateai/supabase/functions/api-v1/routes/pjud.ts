/**
 * Corte Suprema — causas y estadísticas del Poder Judicial.
 *
 * POR QUÉ EXISTEN ESTOS ENDPOINTS
 * -------------------------------
 * `pjud_suprema_detalle` tiene 124.245 causas con rol, libro, sala, tipo de
 * recurso y fechas de ingreso y fallo, y `pjud_estadisticas` otras 266 series
 * agregadas. Hasta ahora no había NINGUNA forma de consultarlas desde la API:
 * era el único lugar del sistema con dato valioso y cero superficie.
 *
 * Es además dato que nadie más tiene empaquetado — la fuente lo publica como un
 * JSON de 36 MB sin paginar, por año.
 *
 * DECISIONES QUE NO SON OBVIAS
 * ----------------------------
 * 1. La paginación es a nivel de BASE (`range` + `count: exact`), no cortando
 *    un arreglo en memoria. Con 124.245 filas, traer todo para quedarse con 20
 *    es la diferencia entre responder y morir por timeout.
 *
 * 2. El detalle de una causa devuelve un ARREGLO, no un objeto. Una causa puede
 *    terminarse MÁS DE UNA VEZ: en 2024 hay 11 con dos términos (por ejemplo
 *    Familia|241225|2023, "Inadmisibles" en enero y "Rechazados" en diciembre).
 *    Devolver `data[0]` escondería la mitad de la historia procesal, que es
 *    justamente lo que hace interesante al dato.
 *
 * 3. `serie` se expone como filtro porque distingue causas TERMINADAS de
 *    INGRESADAS y de las que están en INVENTARIO. Sin ese filtro, contar
 *    "causas de 2025" mezcla tres cosas distintas y da un número sin sentido.
 */

import { getSupabase } from '../middleware/auth.ts'

const TABLA = 'pjud_suprema_detalle'

/** Series disponibles. Se valida contra esta lista para no filtrar por texto libre. */
const SERIES_VALIDAS = [
  'terminos_suprema_detalle',
  'ingresos_recursos_suprema_detalle',
  'inventario_suprema_detalle',
] as const

const PAGE_SIZE_DEFAULT = 20
const PAGE_SIZE_MAX = 200

const meta = (page: number, pageSize: number, total: number, extra: Record<string, unknown> = {}) => ({
  source: 'pjud',
  timestamp: new Date().toISOString(),
  page,
  pageSize,
  total,
  totalPages: pageSize > 0 ? Math.ceil(total / pageSize) : 0,
  ...extra,
})

const paginacion = (c: any) => {
  const page = Math.max(Number(c.req.query('page') ?? 1) || 1, 1)
  const pedido = Number(c.req.query('page_size') ?? PAGE_SIZE_DEFAULT) || PAGE_SIZE_DEFAULT
  const pageSize = Math.min(Math.max(pedido, 1), PAGE_SIZE_MAX)
  return { page, pageSize, desde: (page - 1) * pageSize, hasta: page * pageSize - 1 }
}

/** Columnas que se devuelven. `raw` queda fuera: son 36 MB por año si se pide entero. */
const COLUMNAS =
  'serie, anio, libro, rol, ano_rol, recursos, agrupador_recursos, cod_recurso, ' +
  'tipo_recurso, fecha_ingreso, fecha_fallo, grupo_termino, sala_fallo, ' +
  'descripcion_sala, materia, materia_proteccion'

/**
 * GET /api/v1/data/pjud/suprema/causas
 *
 * Filtros: serie, anio, libro, tipo_recurso, grupo_termino, sala, desde, hasta.
 * `desde`/`hasta` aplican sobre fecha_ingreso (hay índice).
 */
export const pjudSupremaCausasHandler = async (c: any) => {
  try {
    const supabase = getSupabase()
    const { page, pageSize, desde, hasta } = paginacion(c)

    let q = supabase.from(TABLA).select(COLUMNAS, { count: 'exact' })

    const serie = c.req.query('serie')
    if (serie) {
      if (!SERIES_VALIDAS.includes(serie)) {
        return c.json(
          {
            data: null,
            meta: meta(page, pageSize, 0),
            errors: [{ code: 'INVALID_PARAM', message: `serie debe ser una de: ${SERIES_VALIDAS.join(', ')}` }],
          },
          400,
        )
      }
      q = q.eq('serie', serie)
    }

    const anio = c.req.query('anio')
    if (anio) q = q.eq('anio', Number(anio))

    const libro = c.req.query('libro')
    if (libro) q = q.eq('libro', libro)

    // `ilike` y no `eq`: los tipos de recurso son descripciones largas
    // ("(Civil) Apelación Protección") y nadie las va a escribir completas.
    const tipo = c.req.query('tipo_recurso')
    if (tipo) q = q.ilike('tipo_recurso', `%${tipo}%`)

    const grupo = c.req.query('grupo_termino')
    if (grupo) q = q.eq('grupo_termino', grupo)

    const sala = c.req.query('sala')
    if (sala) q = q.ilike('descripcion_sala', `%${sala}%`)

    const fDesde = c.req.query('desde')
    if (fDesde) q = q.gte('fecha_ingreso', fDesde)

    const fHasta = c.req.query('hasta')
    if (fHasta) q = q.lte('fecha_ingreso', fHasta)

    const { data, error, count } = await q
      .order('fecha_ingreso', { ascending: false, nullsFirst: false })
      .range(desde, hasta)

    if (error) {
      console.error('[pjud] causas:', error)
      return c.json(
        { data: null, meta: meta(page, pageSize, 0), errors: [{ code: 'QUERY_FAILED', message: error.message }] },
        500,
      )
    }

    c.set('tokens_used', 5)
    return c.json({ data: data ?? [], meta: meta(page, pageSize, count ?? 0) })
  } catch (err) {
    console.error('[pjud] causas handler:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
}

/**
 * GET /api/v1/data/pjud/suprema/causas/:libro/:rol/:ano_rol
 *
 * Devuelve TODAS las filas de esa causa —puede tener varios términos y
 * aparecer además en ingresos e inventario—, no una sola.
 */
export const pjudSupremaCausaHandler = async (c: any) => {
  try {
    const supabase = getSupabase()
    const libro = c.req.param('libro')
    const rol = Number(c.req.param('rol'))
    const anoRol = Number(c.req.param('ano_rol'))

    if (!libro || !Number.isFinite(rol) || !Number.isFinite(anoRol)) {
      return c.json(
        {
          data: null,
          meta: meta(1, 0, 0),
          errors: [{ code: 'INVALID_PARAM', message: 'libro, rol y ano_rol son obligatorios (rol y ano_rol numéricos)' }],
        },
        400,
      )
    }

    const { data, error } = await supabase
      .from(TABLA)
      .select(COLUMNAS)
      .eq('libro', libro)
      .eq('rol', rol)
      .eq('ano_rol', anoRol)
      .order('fecha_fallo', { ascending: true, nullsFirst: true })

    if (error) {
      console.error('[pjud] causa:', error)
      return c.json(
        { data: null, meta: meta(1, 0, 0), errors: [{ code: 'QUERY_FAILED', message: error.message }] },
        500,
      )
    }

    if (!data || data.length === 0) {
      return c.json(
        {
          data: null,
          meta: meta(1, 0, 0),
          errors: [{ code: 'NOT_FOUND', message: `Sin registros para ${libro}-${rol}-${anoRol}` }],
        },
        404,
      )
    }

    c.set('tokens_used', 3)
    return c.json({
      data,
      meta: meta(1, data.length, data.length, {
        // Se dice explicitamente: si vienen 2, no es un duplicado.
        nota: 'Una causa puede registrar más de un término; cada fila es un evento distinto.',
      }),
    })
  } catch (err) {
    console.error('[pjud] causa handler:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
}

/**
 * GET /api/v1/data/pjud/suprema/resumen?anio=&serie=
 *
 * Conteos por dimensión. Se resuelve con una RPC porque agrupar 124.245 filas
 * del lado del cliente exigiría traerlas todas.
 */
export const pjudSupremaResumenHandler = async (c: any) => {
  try {
    const supabase = getSupabase()
    const anio = c.req.query('anio') ? Number(c.req.query('anio')) : null
    const serie = c.req.query('serie') ?? null

    if (serie && !SERIES_VALIDAS.includes(serie)) {
      return c.json(
        {
          data: null,
          meta: meta(1, 0, 0),
          errors: [{ code: 'INVALID_PARAM', message: `serie debe ser una de: ${SERIES_VALIDAS.join(', ')}` }],
        },
        400,
      )
    }

    const { data, error } = await supabase.rpc('pjud_suprema_resumen', {
      p_anio: anio,
      p_serie: serie,
    })

    if (error) {
      console.error('[pjud] resumen:', error)
      return c.json(
        { data: null, meta: meta(1, 0, 0), errors: [{ code: 'QUERY_FAILED', message: error.message }] },
        500,
      )
    }

    c.set('tokens_used', 8)
    return c.json({ data, meta: meta(1, 1, 1, { anio, serie }) })
  } catch (err) {
    console.error('[pjud] resumen handler:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
}

/**
 * GET /api/v1/data/pjud/suprema/tendencias?libro=&tipo_recurso=&sala=
 *
 * Series por año: volumen, composición del fallo y duración media.
 *
 * POR QUÉ ES UN ENDPOINT Y NO ALGO QUE EL CLIENTE CALCULA: para obtener la
 * evolución de la tasa de confirmación habría que bajarse las 794.935 causas
 * terminadas y agregarlas. Acá se resuelve en la base.
 *
 * Sólo cubre `terminos_suprema_detalle`: `grupo_termino` y `fecha_fallo` no
 * existen en ingresos ni en inventario, así que mezclarlas daría promedios
 * sobre universos distintos.
 */
export const pjudSupremaTendenciasHandler = async (c: any) => {
  try {
    const supabase = getSupabase()

    const { data, error } = await supabase.rpc('pjud_suprema_tendencias', {
      p_libro: c.req.query('libro') ?? null,
      p_tipo: c.req.query('tipo_recurso') ?? null,
      p_sala: c.req.query('sala') ?? null,
    })

    if (error) {
      console.error('[pjud] tendencias:', error)
      return c.json(
        { data: null, meta: meta(1, 0, 0), errors: [{ code: 'QUERY_FAILED', message: error.message }] },
        500,
      )
    }

    const series = (data?.series ?? []) as unknown[]
    c.set('tokens_used', 10)
    return c.json({
      data,
      meta: meta(1, series.length, series.length, {
        serie: 'terminos_suprema_detalle',
        nota: 'La duración media se calcula sólo sobre causas con fecha de ingreso y de fallo; `con_ambas_fechas` dice cuántas son.',
      }),
    })
  } catch (err) {
    console.error('[pjud] tendencias handler:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
}

/**
 * GET /api/v1/data/pjud/estadisticas?serie=&anio=
 *
 * Las series agregadas (distintas del grano por causa): presupuesto, dotación,
 * adquisiciones, cuenta pública.
 */
export const pjudEstadisticasHandler = async (c: any) => {
  try {
    const supabase = getSupabase()
    const { page, pageSize, desde, hasta } = paginacion(c)

    let q = supabase
      .from('pjud_estadisticas')
      .select('serie, anio, categoria, subcategoria, valor, valor_anterior, variacion, updated_at', {
        count: 'exact',
      })

    const serie = c.req.query('serie')
    if (serie) q = q.ilike('serie', `%${serie}%`)

    const anio = c.req.query('anio')
    if (anio) q = q.eq('anio', Number(anio))

    const { data, error, count } = await q
      .order('serie', { ascending: true })
      .order('anio', { ascending: false, nullsFirst: false })
      .range(desde, hasta)

    if (error) {
      console.error('[pjud] estadisticas:', error)
      return c.json(
        { data: null, meta: meta(page, pageSize, 0), errors: [{ code: 'QUERY_FAILED', message: error.message }] },
        500,
      )
    }

    c.set('tokens_used', 3)
    return c.json({ data: data ?? [], meta: meta(page, pageSize, count ?? 0) })
  } catch (err) {
    console.error('[pjud] estadisticas handler:', err)
    return c.json({ error: 'Internal server error' }, 500)
  }
}
