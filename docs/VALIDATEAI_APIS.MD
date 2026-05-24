Estimado Equipo Técnico y de Producto,

Como Mesa Directiva, hemos revisado en detalle el "Mapa de Integraciones y Arquitectura de Datos" de ValidateAI (commit 1585bcb). Agradecemos la exhaustividad y transparencia de esta auditoría técnica. Es fundamental tener esta visibilidad antes de escalar la plataforma.

Si bien celebramos los avances en el pipeline principal (SII + Claude + RAG) y la implementación de telemetría y facturación, estamos sumamente preocupados por los hallazgos de seguridad y riesgo reputacional.

A continuación, emitimos nuestras resoluciones y mandatos estructurados por nivel de urgencia para responder a sus preguntas abiertas y guiar los próximos sprints.

🔴 PRIORIDAD CERO (P0) - SEGURIDAD Y RIESGO REPUTACIONAL
Ejecución: Inmediata (Hoy)

Rotación de API Keys Expuestas (SII y CMF):

Es inaceptable tener credenciales hardcodeadas en el repositorio.

Mandato: Revocar inmediatamente las llaves actuales en apigateway.cl y la CMF. Generar nuevas credenciales, inyectarlas exclusivamente como Supabase Secrets o variables de entorno seguras, y eliminar cualquier rastro en el código (asegurarse de purgar el historial de Git si es necesario, o asumir que el historial está comprometido y tratar las llaves viejas como quemadas permanentemente). No podemos arriesgar consumo malicioso.

El "Mock" de INAPI (Riesgo Legal/Reputacional):

Mostrar datos inventados (risk_level: 'medium', marcas ficticias) a usuarios que confían en nuestra validación para tomar decisiones de negocio es un riesgo altísimo que roza el fraude.

Mandato: Implementar la Opción B temporalmente. Deshabiliten el bloque de INAPI en el front-end y en los informes generados hoy mismo. Preferimos no mostrar un dato a mostrar uno falso. La integración real vía OData se debe priorizar para el próximo sprint.

Corrección de Privilegios en sync-economic-data:

Mandato: Cambiar inmediatamente el uso de la anon key a SERVICE_ROLE_KEY para los procesos de sincronización interna.

🟡 PRIORIDAD UNO (P1) - EFICIENCIA, COSTOS Y DEUDA TÉCNICA
Ejecución: Próximo Sprint

Respondemos directamente a las preguntas de arquitectura y estrategia planteadas:

Estrategia de Caché del SII:

Resolución: Aprobado el caché por 7 días. La situación tributaria de una empresa no es un dato de alta volatilidad (rara vez cambia de un día para otro). Implementar esta caché por RUT reducirá significativamente nuestros costos de API y mejorará el tiempo de respuesta al usuario.

Consolidación CMF y Crons:

Resolución: Aprobado. No tiene sentido mantener dos rutas lógicas para el mismo dato. Deben consolidar la obtención de la UF en un único Cron diario (recomendamos pg_cron nativo en Supabase) que alimente la tabla economic_knowledge. Toda la aplicación (validate.ts inclusive) debe leer exclusivamente de esa caché.

Optimización de Costos Claude (Semantic Cache):

Resolución: Aprobado bajar el threshold a 0.88. Optimizar el gasto de LLMs es clave para nuestra rentabilidad (Unit Economics). Realicen el ajuste, pero monitoreen durante la primera semana si esto genera respuestas genéricas o inapropiadas para prompts que son sutilmente distintos.

Limpieza de Funciones "Fantasma" (PJUD y Fintoc):

Resolución: Si producto y desarrollo no saben para qué están desplegadas estas funciones (webhook-pjud, fintoc-link, fintoc-webhook), y no hay contratos activos con proveedores empujando datos, deben ser depreciadas y eliminadas del entorno de producción. Mantener código "zombie" solo aumenta la superficie de ataque y la complejidad del mantenimiento. Si en el futuro cerramos una alianza para datos judiciales, lo reconstruiremos con especificaciones claras.

🔵 PRIORIDAD DOS (P2) - MEJORAS DE PRODUCTO Y ROADMAP
Ejecución: Q3/Q4

Datos del BCE (IMACEC Sectoriales):

Resolución: Nuestro foco comercial principal en este MVP son startups tecnológicas, e-commerce, y B2B SaaS. Prioricen investigar e integrar únicamente las series sectoriales que afecten directamente a los verticales de nuestros clientes actuales (ej. Comercio, Servicios empresariales, Tecnología si existe proxy).

Integraciones Futuras (SerpApi / Reddit):

Resolución: Pausar. No asignaremos recursos de ingeniería a integrar señales cualitativas de Reddit o Google Trends hasta que la base (SII, CMF, INAPI real, BCE) esté operando al 100% de manera robusta, con sus crons automatizados y sin errores silenciosos.

Próximos pasos requeridos por la Mesa:
Requerimos confirmación escrita por parte del CTO o Tech Lead antes de finalizar el día de hoy de que las vulnerabilidades de seguridad (API keys y desactivación de datos falsos de INAPI) han sido resueltas en la rama principal y desplegadas en producción.

Confiamos en la capacidad del equipo para subsanar estos baches operativos y dejar la arquitectura lista para el escalamiento.

Atentamente,

Mesa Directiva ValidateAI