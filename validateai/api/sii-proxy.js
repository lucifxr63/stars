export default async function handler(req, res) {
  // 1. Configuración de CORS para permitir peticiones desde tu frontend
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, Authorization, apikey, subscription-key'
  );

  // 2. Manejo de preflight (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  // 3. Extraer la URL de destino (targetUrl) de los parámetros
  const { targetUrl, ...queryParams } = req.query;

  // Si no se especifica a dónde reenviar, actúa como un "echo" o webhook que solo responde que todo está OK
  if (!targetUrl) {
    return res.status(200).json({
      success: true,
      message: 'Proxy del SII está activo. Para redirigir peticiones, envía un parámetro ?targetUrl=<url_destino>',
      request_info: {
        method: req.method,
        query: req.query,
        body: req.body,
      }
    });
  }

  try {
    // 4. Construir la URL final con el resto de parámetros
    const url = new URL(targetUrl);
    Object.keys(queryParams).forEach(key => url.searchParams.append(key, queryParams[key]));

    // Limpiamos headers que puedan dar problemas al hacer proxy
    const headersToForward = { ...req.headers };
    delete headersToForward.host;
    delete headersToForward.referer;
    delete headersToForward.origin;

    // 5. Reenviar la petición hacia el SII
    const response = await fetch(url.toString(), {
      method: req.method,
      headers: headersToForward,
      body: req.method !== 'GET' && req.method !== 'HEAD' && req.body ? JSON.stringify(req.body) : undefined,
    });

    const contentType = response.headers.get("content-type");
    let data;

    if (contentType && contentType.includes("application/json")) {
      data = await response.json();
    } else {
      data = await response.text();
    }

    // 6. Devolver la respuesta al cliente
    res.status(response.status).send(data);
  } catch (error) {
    console.error('Error en proxy:', error);
    res.status(500).json({ error: 'Fallo al reenviar la petición', details: error.message });
  }
}
