"""
scripts/apply_familia_a.py
Aplica los nodos y aristas de Familia A (Sprints 1-3) directamente
vía Supabase REST client. Alternativa al CLI cuando no hay supabase CLI.

Uso:
  py scripts/apply_familia_a.py           # inserta nodos + aristas
  py scripts/apply_familia_a.py --check   # solo cuenta nodos existentes
"""
from __future__ import annotations
import argparse
import sys
sys.path.insert(0, ".")
from dotenv import load_dotenv
load_dotenv()

from src.db.supabase_client import get_client, bulk_insert_nodes


# ── SPRINT 1: UNIT ECONOMICS + DEFINICIÓN DEL PROBLEMA + TAM/SAM/SOM ─────────

SPRINT1_NODES: list[dict] = [
    {
        "document_title": "CAC — Costo de Adquisición de Cliente",
        "header_path": "Unit Economics",
        "content": "CAC = Total Gasto Marketing y Ventas / Nuevos Clientes Adquiridos en el período. Un CAC elevado sin LTV proporcional destruye caja. El CAC debe incluir salarios del equipo de ventas, ad spend, herramientas, eventos y cualquier costo directamente atribuible a la adquisición. Para startups B2B SaaS: CAC < USD 5.000 es saludable en early-stage; CAC > USD 20.000 requiere justificación con contratos enterprise de alto ACV. Segmentar CAC por canal (paid/organic/referral) revela el canal más eficiente para escalar.",
        "category": "Unit Economics",
        "tags": ["cac", "unit_economics", "adquisicion", "marketing", "ventas", "saas", "b2b"],
        "metadata": {"entity_type": "FRAMEWORK", "entity_value": "CAC", "formula": "Total Gasto Marketing y Ventas / Nuevos Clientes", "dimension": "Unit Economics", "sprint": 1},
        "embedding": None,
    },
    {
        "document_title": "LTV — Lifetime Value del Cliente",
        "header_path": "Unit Economics",
        "content": "LTV = ARPU × Margen Bruto × (1 / Tasa de Churn). Para SaaS: LTV = MRR promedio por cliente × margen bruto / churn rate mensual. El LTV proyecta los ingresos futuros que un cliente típico generará. Nunca usar LTV contable sin descontar; usar tasa de descuento 10–15% para proyecciones honestas. Un LTV inflado por churn subestimado es una de las señales de alarma más comunes que detectan los VCs en due diligence. Usar cohorts reales de al menos 6 meses antes de presentar LTV a un inversor.",
        "category": "Unit Economics",
        "tags": ["ltv", "lifetime_value", "unit_economics", "churn", "arpu", "saas", "vc_diligence"],
        "metadata": {"entity_type": "FRAMEWORK", "entity_value": "LTV", "formula": "ARPU × Margen Bruto / Churn Rate", "dimension": "Unit Economics", "sprint": 1},
        "embedding": None,
    },
    {
        "document_title": "Payback Period — Periodo de Recuperación CAC",
        "header_path": "Unit Economics",
        "content": "Payback Period = CAC / (ARPU × Margen Bruto mensual). Mide cuántos meses tarda un cliente en recuperar su costo de adquisición. Es la métrica de caja más honesta para startups: indica cuánto capital necesitas para crecer antes de ser rentable. Un Payback corto (<12 meses) significa que puedes reinvertir el CAC recuperado en nuevos clientes sin necesitar nueva ronda de financiamiento. Payback >24 meses en early-stage es una señal de modelo de negocio frágil que requiere validación adicional antes de escalar.",
        "category": "Unit Economics",
        "tags": ["payback", "payback_period", "unit_economics", "cac", "caja", "runway", "b2b"],
        "metadata": {"entity_type": "FRAMEWORK", "entity_value": "Payback Period", "formula": "CAC / (ARPU × Margen Bruto mensual)", "dimension": "Unit Economics", "sprint": 1},
        "embedding": None,
    },
    {
        "document_title": "Benchmark LTV:CAC > 3:1",
        "header_path": "Benchmarks",
        "content": "El ratio LTV:CAC mínimo aceptable es 3:1: por cada peso invertido en adquirir un cliente, el negocio debe retornar al menos 3 pesos en valor de vida. Benchmarks de referencia: <1:1 = modelo roto, no escalar; 1:1–2:1 = márgenes insuficientes para financiar growth orgánico; 3:1–5:1 = rango óptimo para VC funding y expansión; >5:1 = posible subinversión en adquisición, considerar acelerar spend. LTV:CAC se reporta al board en toda ronda Serie A+. Calcularlo siempre con cohorts reales, no proyecciones optimistas de churn futuro.",
        "category": "Unit Economics",
        "tags": ["ltv_cac", "benchmark", "unit_economics", "vc_funding", "series_a", "board_metrics", "cohorts"],
        "metadata": {"entity_type": "BENCHMARK", "entity_value": "LTV:CAC > 3:1", "threshold": 3.0, "dimension": "Unit Economics", "sprint": 1},
        "embedding": None,
    },
    {
        "document_title": "Benchmark Payback < 12 meses",
        "header_path": "Benchmarks",
        "content": "El Payback Period benchmark para startups VC-backable es menor a 12 meses. Interpretación por rango: 0–6 meses = excelente, modelo de caja muy eficiente; 6–12 meses = bueno, estándar SaaS saludable; 12–18 meses = aceptable con contrato anual o enterprise; >18 meses = capital-intensivo, requiere fundraising frecuente para sostener el crecimiento. En Chile y LATAM, un Payback <18 meses con contratos anuales es competitivo. Empresas con Payback >24 meses raramente obtienen Serie A sin evidencia de reducción de churn sostenida en al menos 3 cohortes consecutivas.",
        "category": "Unit Economics",
        "tags": ["payback", "benchmark", "unit_economics", "saas", "latam", "chile", "series_a", "churn"],
        "metadata": {"entity_type": "BENCHMARK", "entity_value": "Payback < 12 meses", "threshold_months": 12, "dimension": "Unit Economics", "sprint": 1},
        "embedding": None,
    },
    {
        "document_title": "Mom Test — Regla de Hechos No Opiniones",
        "header_path": "Mom Test",
        "content": 'El Mom Test prohíbe preguntar opiniones sobre tu idea o producto futuro. Las preguntas válidas son sobre comportamiento pasado y presente: "¿Cuándo fue la última vez que enfrentaste este problema? ¿Cómo lo resolviste? ¿Cuánto tiempo y dinero gastaste?" Las preguntas inválidas son hipotéticas: "¿Usarías X? ¿Pagarías Y?" — las personas mienten por cortesía cuando quieren evitar herirte. La evidencia real es: alguien que ya gasta dinero o tiempo en solucionar el problema ahora mismo, sin que exista tu producto todavía.',
        "category": "Definicion del Problema",
        "tags": ["mom_test", "customer_discovery", "entrevistas", "validacion", "problema", "comportamiento", "evidencia"],
        "metadata": {"entity_type": "METHODOLOGY", "entity_value": "Mom Test Regla 1 — Hechos", "source": "The Mom Test — Rob Fitzpatrick", "dimension": "Definicion del Problema", "sprint": 1},
        "embedding": None,
    },
    {
        "document_title": "Mom Test — Regla de No Presentar la Solución",
        "header_path": "Mom Test",
        "content": "Durante las entrevistas de descubrimiento nunca reveles tu solución propuesta antes de entender profundamente el problema. Si revelas la idea primero, el entrevistado responderá en función de no herirte. La secuencia correcta es: contexto del problema → experiencias pasadas → cuantificación del dolor (tiempo, dinero, frustración) → soluciones actuales que usa hoy → solo al final, si corresponde, mencionar la hipótesis de solución. El objetivo de las primeras 30 entrevistas es falsificar la hipótesis del problema, no confirmar que tu solución es brillante.",
        "category": "Definicion del Problema",
        "tags": ["mom_test", "customer_discovery", "entrevistas", "sesgos", "problem_first", "hipotesis", "sesgo_confirmacion"],
        "metadata": {"entity_type": "METHODOLOGY", "entity_value": "Mom Test Regla 2 — No Solución", "source": "The Mom Test — Rob Fitzpatrick", "dimension": "Definicion del Problema", "sprint": 1},
        "embedding": None,
    },
    {
        "document_title": "Mom Test — Regla de Conversaciones Específicas e Incidentes",
        "header_path": "Mom Test",
        "content": 'Las entrevistas Mom Test deben profundizar en incidentes específicos, no generalizaciones. Técnica: cuando alguien menciona el problema, preguntar inmediatamente "¿Puedes contarme la última vez que esto te pasó?" y reconstruir el incidente paso a paso. Las generalizaciones ("A veces tengo ese problema") son señales débiles; los incidentes específicos con consecuencias reales ("La semana pasada perdí un cliente porque...") son señales fuertes. Objetivo: 3 o más incidentes concretos con consecuencias cuantificables antes de declarar problem-market fit y avanzar a Customer Validation.',
        "category": "Definicion del Problema",
        "tags": ["mom_test", "customer_discovery", "entrevistas", "incidentes", "problem_market_fit", "evidencia", "cuantificacion"],
        "metadata": {"entity_type": "METHODOLOGY", "entity_value": "Mom Test Regla 3 — Incidentes", "source": "The Mom Test — Rob Fitzpatrick", "dimension": "Definicion del Problema", "sprint": 1},
        "embedding": None,
    },
    {
        "document_title": "Lean Startup — Build-Measure-Learn",
        "header_path": "Lean Startup",
        "content": "El ciclo Build-Measure-Learn de Lean Startup define el ritmo de iteración de una startup: Build = construir el experimento mínimo (MVP o smoke test); Measure = medir la métrica de aprendizaje (no métricas vanidad como pageviews); Learn = decidir pivotar o perseverar con datos, no intuición. La velocidad del ciclo es la ventaja competitiva real de una startup frente a corporaciones. Un ciclo de 2 semanas vs 2 meses significa 26 iteraciones vs 6 en el mismo año. El experimento debe estar diseñado para falsificar una hipótesis específica, con criterio de éxito definido antes de ejecutar.",
        "category": "Definicion del Problema",
        "tags": ["lean_startup", "bml", "build_measure_learn", "mvp", "iteracion", "pivot", "hipotesis", "experimento"],
        "metadata": {"entity_type": "FRAMEWORK", "entity_value": "Build-Measure-Learn", "source": "The Lean Startup — Eric Ries", "dimension": "Definicion del Problema", "sprint": 1},
        "embedding": None,
    },
    {
        "document_title": "Lean Startup — Customer Discovery vs Customer Validation",
        "header_path": "Lean Startup",
        "content": "Lean Startup define dos fases distintas e irrepetibles antes del product-market fit: Customer Discovery = aprender si el problema existe y es suficientemente significativo (mínimo 20 entrevistas sin intentar vender); Customer Validation = aprender si el mercado pagará por tu solución (primeras ventas reales, no pilotos gratuitos ni PoCs). El error más común es mezclar ambas fases: intentar vender antes de entender el problema, o continuar en descubrimiento cuando ya hay señales claras de demanda. Criterio de paso: 3 o más clientes con intención de pago demostrada por carta de intención firmada o pre-pago efectivo.",
        "category": "Definicion del Problema",
        "tags": ["customer_discovery", "customer_validation", "lean_startup", "entrevistas", "ventas", "problem_solution_fit", "pmf"],
        "metadata": {"entity_type": "FRAMEWORK", "entity_value": "Customer Discovery vs Validation", "source": "The Lean Startup — Eric Ries", "dimension": "Definicion del Problema", "sprint": 1},
        "embedding": None,
    },
    {
        "document_title": "Lean Startup — Validated Learning",
        "header_path": "Lean Startup",
        "content": 'Validated Learning es la unidad de progreso de una startup: el aprendizaje demostrado empíricamente sobre lo que los clientes realmente quieren. No equivale a datos cualitativos ni a features construidas. Requiere: hipótesis explícita formulada antes del experimento, métrica de éxito definida antes de ejecutar, datos reales de comportamiento (no entrevistas de opinión). Ejemplo canónico: "Hipótesis: 40% de los usuarios invitará a un colega en las primeras 24h. Resultado real: 12%. Aprendizaje validado: el loop viral no funciona con este incentivo — rediseñar mecánica de referido." El pivot estratégico se justifica con Validated Learning, nunca con intuición o presión de inversores.',
        "category": "Definicion del Problema",
        "tags": ["validated_learning", "lean_startup", "hipotesis", "experimento", "pivot", "metricas", "evidencia", "aprendizaje"],
        "metadata": {"entity_type": "FRAMEWORK", "entity_value": "Validated Learning", "source": "The Lean Startup — Eric Ries", "dimension": "Definicion del Problema", "sprint": 1},
        "embedding": None,
    },
    {
        "document_title": "TAM/SAM/SOM — Metodología Bottom-Up",
        "header_path": "Metodologia",
        "content": "La metodología Bottom-Up construye el TAM desde el nivel de cliente individual: (Precio por cliente × Clientes potenciales en el segmento objetivo). Es la metodología preferida por VCs porque parte de datos reales y falsificables: número de empresas en el ICP, precio promedio de contrato, frecuencia de compra. Ejemplo B2B Chile: 15.000 empresas medianas × USD 200/mes = TAM Chile USD 36M/año. El Bottom-Up revela el esfuerzo comercial real para capturar el mercado. Un Bottom-Up con fuentes citables (SII, INE, CMF, Doing Business) tiene diez veces más credibilidad ante VCs que un Top-Down aplicando porcentajes del mercado global.",
        "category": "TAM/SAM/SOM",
        "tags": ["tam", "sam", "som", "bottom_up", "market_sizing", "vc_pitch", "icp", "sii", "ine", "cmf", "chile"],
        "metadata": {"entity_type": "METHODOLOGY", "entity_value": "Bottom-Up Market Sizing", "fuentes_datos": ["SII", "INE", "CMF", "Doing Business"], "dimension": "TAM/SAM/SOM", "sprint": 1},
        "embedding": None,
    },
    {
        "document_title": "TAM/SAM/SOM — Metodología Top-Down",
        "header_path": "Metodologia",
        "content": "La metodología Top-Down estima el TAM desde estadísticas de industria existentes aplicando porcentajes de penetración: si el mercado global de X es USD 50B y Chile representa 0.4% del PIB mundial, el TAM Chile estimado es USD 200M. Es útil como sanity check pero insuficiente como único método: los VCs rechazan TAMs puramente Top-Down porque esconden la ausencia de trabajo de campo real con clientes. El error clásico es aplicar tasas de penetración de mercados desarrollados (EE.UU., Europa) a mercados latinoamericanos con menor digitalización, resultando en TAMs fantasma que no resisten due diligence ni el primer cliente real.",
        "category": "TAM/SAM/SOM",
        "tags": ["tam", "sam", "som", "top_down", "market_sizing", "vc_pitch", "latam", "chile", "due_diligence", "sanity_check"],
        "metadata": {"entity_type": "METHODOLOGY", "entity_value": "Top-Down Market Sizing", "advertencia": "sanity check only — no usar como unico metodo ante VCs", "dimension": "TAM/SAM/SOM", "sprint": 1},
        "embedding": None,
    },
]


# ── SPRINT 2: GOBERNANZA + CUMPLIMIENTO NORMATIVO ─────────────────────────────

SPRINT2_NODES: list[dict] = [
    {
        "document_title": "Estructura SpA (Sociedad por Acciones)",
        "header_path": "Cap Table y Gobernanza",
        "content": "La Sociedad por Acciones (SpA) es el vehículo societario estándar para startups chilenas que buscan financiamiento de capital de riesgo. Ventajas clave para VC: permite múltiples clases de acciones (ordinarias, preferentes, fantasmas/phantom equity); puede operar con un solo accionista inicial; no requiere capital mínimo; sus estatutos y pacto de accionistas son privados. Due diligence legal pre-inversión: verificar que los estatutos permitan emisión de acciones preferentes con liquidation preference; que no existan compromisos de compra o promesas de venta previas no registradas; que todos los founders tengan sus acciones correctamente inscritas antes de la primera ronda. Una SpA mal estructurada (ej. sin cláusulas de veto, sin autorización para nuevas series de acciones) puede bloquear una ronda de inversión o requerir una reestructuración societaria costosa.",
        "category": "Gobernanza",
        "tags": ["spa", "sociedad_acciones", "cap_table", "gobernanza", "fundadores", "chile", "vc", "acciones_preferentes"],
        "metadata": {"entity_type": "LEGAL_FRAMEWORK", "entity_value": "Estructura SpA", "ley_referencia": "Ley 20.190 — SpA Chile", "dimension": "Gobernanza", "sprint": 2},
        "embedding": None,
    },
    {
        "document_title": "Vesting y Cliff — Retención de Fundadores",
        "header_path": "Cap Table y Gobernanza",
        "content": "El vesting es el mecanismo por el cual founders y empleados clave adquieren sus acciones o stock options de forma gradual, condicionado a permanencia activa en la empresa. Estándar de mercado VC chileno y LATAM: 4 años de vesting con 1 año de cliff. El cliff significa que si un founder abandona antes del primer año, pierde el 100% de sus acciones vesting — protegiendo al equipo restante y a los inversores. Después del cliff, las acciones se liberan mensualmente (1/48 por mes). Due diligence crítico: si no existe acuerdo de vesting entre cofundadores antes de la primera inversión, la startup es prácticamente no-inversible — un cofundador puede abandonar en el año 2 con el 40–50% del cap table sin trabajar un día más. Fundadores con vesting no firmado es un hard block en procesos de due diligence de fondos LATAM Seed y Series A.",
        "category": "Gobernanza",
        "tags": ["vesting", "cliff", "cap_table", "gobernanza", "fundadores", "equity", "retencion", "due_diligence"],
        "metadata": {"entity_type": "LEGAL_FRAMEWORK", "entity_value": "Vesting y Cliff", "estandar": "4 años / 1 año cliff", "liberacion": "mensual 1/48", "dimension": "Gobernanza", "sprint": 2},
        "embedding": None,
    },
    {
        "document_title": "Drag-along — Derecho de Arrastre",
        "header_path": "Cap Table y Gobernanza",
        "content": "La cláusula Drag-Along otorga al accionista mayoritario (o a un grupo con mayoría calificada definida en el pacto) el derecho de obligar a los accionistas minoritarios a vender sus acciones en las mismas condiciones en una transacción de M&A o adquisición total de la empresa. Es esencial para los VCs: garantiza que un accionista minoritario con agenda personal no pueda bloquear una salida rentable para el resto. Condiciones estándar: se activa cuando el precio de venta supera el valor de liquidación preferente de todos los inversores; todos los accionistas reciben el mismo precio por acción de su misma clase. Due diligence: verificar que el drag-along está en el pacto de accionistas y en los estatutos de la SpA.",
        "category": "Gobernanza",
        "tags": ["drag_along", "cap_table", "gobernanza", "ma", "salida", "liquidez", "vc", "mayoritario"],
        "metadata": {"entity_type": "LEGAL_FRAMEWORK", "entity_value": "Drag-along", "proposito": "garantizar salida limpia en M&A", "dimension": "Gobernanza", "sprint": 2},
        "embedding": None,
    },
    {
        "document_title": "Tag-along — Derecho de Acompañamiento",
        "header_path": "Cap Table y Gobernanza",
        "content": "La cláusula Tag-Along otorga al accionista minoritario el derecho de vender sus acciones en las mismas condiciones que el accionista mayoritario cuando este decida vender su participación a un tercero. Protege a founders tempranos, business angels y empleados con equity de quedar atrapados en la empresa con un nuevo controlador desconocido o potencialmente hostil. Mecanismo de ejercicio: si el mayoritario recibe una oferta de compra de sus acciones y la acepta, los minoritarios tienen derecho de unirse a la venta al mismo precio por acción y mismos términos, dentro del plazo establecido en el pacto (usualmente 15–30 días corridos desde la notificación).",
        "category": "Gobernanza",
        "tags": ["tag_along", "cap_table", "gobernanza", "minoritarios", "salida", "liquidez", "angel", "empleados_equity"],
        "metadata": {"entity_type": "LEGAL_FRAMEWORK", "entity_value": "Tag-along", "plazo_ejercicio_dias": 30, "proposito": "proteger minoritarios en venta del mayoritario", "dimension": "Gobernanza", "sprint": 2},
        "embedding": None,
    },
    {
        "document_title": "Cláusula de No Competencia y Permanencia",
        "header_path": "Cap Table y Gobernanza",
        "content": "Las cláusulas de no competencia y permanencia en startups chilenas son compromisos contractuales de founders y empleados clave de: (1) Dedicación exclusiva durante la vigencia del pacto y contrato laboral; (2) No competir directamente con la empresa durante su participación y por un período post-salida. Bajo el derecho chileno, la no competencia post-contractual debe ser razonable en tiempo (máximo 2 años), territorio y actividad específica para ser ejecutable — cláusulas de más de 2 años o alcance global pueden ser declaradas nulas. Due diligence crítico: verificar que todos los cofundadores y empleados clave firmaron NDA + no competencia antes de acceder a IP, código fuente propietario, secretos comerciales o listas de clientes. La ausencia de estas cláusulas en los founders es un red flag mayor en procesos de M&A.",
        "category": "Gobernanza",
        "tags": ["no_competencia", "permanencia", "nda", "cap_table", "gobernanza", "ip", "fundadores", "ma", "riesgo_key_person"],
        "metadata": {"entity_type": "LEGAL_FRAMEWORK", "entity_value": "No Competencia y Permanencia", "plazo_maximo_chile": "2 años post-contrato", "dimension": "Gobernanza", "sprint": 2},
        "embedding": None,
    },
    {
        "document_title": "Ley Fintech 21.521 — Registro CMF de Prestadores",
        "header_path": "Ley 21.521 Fintech",
        "content": "La Ley Fintech 21.521 (vigente desde enero 2023, reglamentos en fuerza gradual hasta 2025) obliga a toda empresa que preste Servicios de Plataforma de Financiamiento Colectivo (crowdfunding), Intermediación de Instrumentos Financieros, Sistemas de Pago, Custodia de Valores, Enrutamiento de Órdenes, o Asesoría Crediticia a registrarse ante la CMF antes de operar en Chile. El proceso de registro requiere: plan de negocio aprobado, patrimonio mínimo según tipo de servicio (desde UF 5.000 hasta UF 50.000), políticas de continuidad operacional, y sistemas de gestión de riesgos documentados. Sanciones por operar sin registro: multas hasta UF 15.000 (~USD 650.000) y cierre forzado con responsabilidad personal de los directores. Due diligence pre-inversión: toda fintech debe presentar certificado vigente de registro CMF o demostrar que su actividad no está regulada.",
        "category": "Cumplimiento Normativo",
        "tags": ["fintech", "cmf", "registro", "ley_21521", "regulacion", "chile", "prestadores", "financiero", "due_diligence"],
        "metadata": {"entity_type": "COMPLIANCE", "entity_value": "Registro CMF Ley Fintech 21.521", "ley": "21.521", "organismo": "CMF Chile", "multa_maxima_uf": 15000, "dimension": "Cumplimiento Normativo", "sprint": 2},
        "embedding": None,
    },
    {
        "document_title": "Ley Fintech 21.521 — Sistema de Finanzas Abiertas (SFA)",
        "header_path": "Ley 21.521 Fintech",
        "content": "El Sistema de Finanzas Abiertas (SFA) establecido por la Ley 21.521 obliga a las instituciones financieras reguladas a compartir datos financieros de sus clientes (previa autorización expresa) con terceros certificados mediante APIs estandarizadas bajo normas de la CMF. Oportunidades para startups: el SFA permite construir productos de finanzas personales, crédito alternativo y agregadores de cuentas accediendo a datos bancarios reales del usuario sin necesidad de ser banco. Restricción operativa crítica: solo se puede acceder a datos SFA si el usuario otorgó consentimiento explícito, granular y revocable — cualquier acceso fuera de los términos del consentimiento constituye infracción simultánea de la Ley 21.521 y la Ley 21.719, con sanciones acumulativas.",
        "category": "Cumplimiento Normativo",
        "tags": ["sfa", "finanzas_abiertas", "open_banking", "fintech", "cmf", "ley_21521", "api", "consentimiento", "datos"],
        "metadata": {"entity_type": "COMPLIANCE", "entity_value": "Sistema de Finanzas Abiertas SFA", "ley": "21.521", "organismo": "CMF Chile", "dimension": "Cumplimiento Normativo", "sprint": 2},
        "embedding": None,
    },
    {
        "document_title": "Ley 21.719 — Estándar GDPR Chile",
        "header_path": "Ley 21.719 Proteccion de Datos",
        "content": "La Ley 21.719 (en vigor desde 2026) reemplaza la Ley 19.628 y eleva el estándar de protección de datos personales en Chile al nivel del GDPR europeo. Cambios estructurales: bases legales de tratamiento taxativas (consentimiento, interés legítimo, obligación legal, ejecución contractual, interés vital); principio de minimización de datos; obligación de Evaluaciones de Impacto en Protección de Datos (EIPD) para tratamientos de alto riesgo (perfilamiento, decisiones automatizadas, datos sensibles a escala); creación de la Agencia de Protección de Datos Personales como órgano fiscalizador independiente. Sanciones escalonadas: infracciones leves hasta UF 1.000; infracciones graves hasta UF 5.000 (~USD 215.000); infracciones gravísimas hasta UF 10.000 (~USD 430.000).",
        "category": "Cumplimiento Normativo",
        "tags": ["ley_21719", "gdpr", "proteccion_datos", "privacidad", "chile", "agencia_datos", "eipd", "multas", "due_diligence"],
        "metadata": {"entity_type": "COMPLIANCE", "entity_value": "Ley 21.719 Estandar GDPR Chile", "ley": "21.719", "organismo": "Agencia de Proteccion de Datos", "multa_maxima_uf": 10000, "vigencia": "2026", "dimension": "Cumplimiento Normativo", "sprint": 2},
        "embedding": None,
    },
    {
        "document_title": "Ley 21.719 — Gestión de Consentimiento",
        "header_path": "Ley 21.719 Proteccion de Datos",
        "content": "La Ley 21.719 exige que el consentimiento para el tratamiento de datos personales sea simultáneamente: libre (sin condicionamiento ni presión); específico (para cada finalidad concreta y declarada); informado (explicando qué datos, para qué finalidad, por cuánto tiempo, con quién se compartirá); e inequívoco (requiere acción afirmativa positiva del usuario — el silencio, las casillas pre-marcadas y la aceptación bundled de términos generales son nulos). Impacto operativo en growth marketing: la integración de GTM, Meta Pixel, Google Analytics 4, PostHog y cualquier herramienta de telemetría requiere un Consent Management Platform (CMP) que recabe consentimiento granular por herramienta y por finalidad. La restricción de cookies de terceros más el requisito de consentimiento explícito puede reducir el audience addressable para pauta digital entre un 30–50%, encareciendo directamente el CAC.",
        "category": "Cumplimiento Normativo",
        "tags": ["consentimiento", "ley_21719", "gdpr", "cmp", "cookies", "privacidad", "growth", "cac", "paid_ads", "marketing_digital"],
        "metadata": {"entity_type": "COMPLIANCE", "entity_value": "Gestion de Consentimiento Ley 21.719", "ley": "21.719", "impacto_cac": "reduccion audiencia addressable 30-50% en paid channels", "dimension": "Cumplimiento Normativo", "sprint": 2},
        "embedding": None,
    },
    {
        "document_title": "Ley 21.719 — Derecho al Olvido y Portabilidad",
        "header_path": "Ley 21.719 Proteccion de Datos",
        "content": "La Ley 21.719 consagra dos derechos fundamentales del titular de datos con implicancias técnicas directas para startups. Derecho de Supresión (al olvido): el usuario puede solicitar la eliminación de todos sus datos personales cuando ya no sean necesarios para la finalidad original, cuando retire su consentimiento, o cuando el tratamiento sea ilícito. La empresa tiene 15 días hábiles para ejecutar la supresión en todos sus sistemas, incluidos backups, sistemas analíticos y datos compartidos con terceros. Derecho de Portabilidad: el usuario puede solicitar sus datos en formato estructurado y legible por máquina (CSV, JSON). Due diligence técnico crítico: los sistemas que solo hacen soft delete (campo deleted_at sin eliminación real) no cumplen el derecho al olvido.",
        "category": "Cumplimiento Normativo",
        "tags": ["derecho_olvido", "portabilidad", "ley_21719", "hard_delete", "gdpr", "privacidad", "datos_personales", "supresion"],
        "metadata": {"entity_type": "COMPLIANCE", "entity_value": "Derecho al Olvido y Portabilidad Ley 21.719", "ley": "21.719", "plazo_supresion_dias_habiles": 15, "dimension": "Cumplimiento Normativo", "sprint": 2},
        "embedding": None,
    },
    {
        "document_title": "Ley Karin 21.643 — Protocolo de Prevención Obligatorio",
        "header_path": "Ley 21.643 Karin",
        "content": "La Ley Karin 21.643 (vigente desde agosto 2024) obliga a todos los empleadores en Chile, sin excepción por tamaño de empresa o número de trabajadores, a implementar un Protocolo de Prevención del Acoso Laboral, Acoso Sexual y Violencia en el Trabajo. El protocolo debe contemplar: (1) diagnóstico de riesgos psicosociales mediante instrumento validado; (2) medidas de prevención concretas y evaluables; (3) canal de denuncias confidencial con garantías de no-represalia; (4) procedimiento formal de investigación con plazos máximos de 30 días hábiles; (5) medidas de resguardo inmediato para la presunta víctima. Due diligence ESG/impacto: toda startup con al menos un trabajador en Chile está en infracción si no tiene este protocolo — multas hasta 60 UTM (~USD 5.400) por trabajador afectado.",
        "category": "Cumplimiento Normativo",
        "tags": ["ley_karin", "21643", "acoso_laboral", "protocolo", "prevencion", "rrhh", "trabajadores", "multas", "esg", "due_diligence"],
        "metadata": {"entity_type": "COMPLIANCE", "entity_value": "Protocolo Prevencion Ley Karin 21.643", "ley": "21.643", "vigencia": "agosto 2024", "multa_maxima_utm_por_trabajador": 60, "dimension": "Cumplimiento Normativo", "sprint": 2},
        "embedding": None,
    },
    {
        "document_title": "Ley Karin 21.643 — Prevención de Acoso y Violencia Laboral",
        "header_path": "Ley 21.643 Karin",
        "content": "La Ley Karin 21.643 amplía y precisa las definiciones de conductas prohibidas en el trabajo: Acoso Laboral = conducta de agresión u hostigamiento reiterada (excepcionalmente, una sola conducta de especial gravedad también califica); Acoso Sexual = cualquier requerimiento de carácter sexual no consentido; Violencia en el Trabajo = conductas de terceros (clientes, proveedores, usuarios) que afecten a los trabajadores. La empresa es responsable de proteger a sus empleados también de conductas de agentes externos. Obligación de resguardo inmediato: ante cualquier denuncia formal, el empleador debe adoptar medidas dentro de las 24 horas siguientes. Due diligence RRHH: verificar que todos los directivos y founders recibieron capacitación formal documentada en Ley Karin.",
        "category": "Cumplimiento Normativo",
        "tags": ["ley_karin", "21643", "acoso_laboral", "acoso_sexual", "violencia_laboral", "rrhh", "responsabilidad_patronal", "capacitacion"],
        "metadata": {"entity_type": "COMPLIANCE", "entity_value": "Conductas y Responsabilidad Ley Karin 21.643", "ley": "21.643", "plazo_resguardo_horas": 24, "dimension": "Cumplimiento Normativo", "sprint": 2},
        "embedding": None,
    },
]


# ── SPRINT 3: FUNDRAISING + TRACCIÓN + MOAT + GTM ────────────────────────────

SPRINT3_NODES: list[dict] = [
    {
        "document_title": "Corfo Semilla Inicia — Requisitos de Postulación",
        "header_path": "Estrategia Fundraising",
        "content": "Corfo Semilla Inicia es el instrumento de financiamiento público de Corfo Chile más accesible para startups en etapa idea o prototipo. Criterios de elegibilidad: (1) Fase tecnológica TRL 1–3 — idea validada teóricamente hasta prototipo funcional demostrable en laboratorio o entorno controlado; (2) Ventas netas iguales a CLP $0 — la presencia de cualquier ingreso por ventas o servicios en los últimos 12 meses descalifica automáticamente; (3) Antigüedad legal de la empresa menor a 18 meses desde la fecha de constitución en el Registro de Comercio; (4) Contar con un Servicio de Apoyo (incubadora o aceleradora) certificado por Corfo. Beneficio máximo: CLP $35.000.000 como subsidio no reembolsable (90% Corfo / 10% aporte propio). Evaluación adversarial: si la startup tiene usuarios pagando aunque sea informalmente, debe redirigirse a Semilla Expande. Un TRL declarado de 3 sin evidencia técnica verificable (demo funcional, repositorio, arquitectura) es la causal de rechazo más común.",
        "category": "Estrategia Fundraising",
        "tags": ["corfo", "semilla_inicia", "financiamiento", "fondos_publicos", "trl", "prototipo", "chile", "startup_temprana", "due_diligence"],
        "metadata": {"entity_type": "FUNDING_REQUIREMENT", "entity_value": "Corfo Semilla Inicia", "monto_max_clp": 35000000, "cofinanciamiento_corfo": 0.90, "trl_requerido": "1-3", "ventas_maximas_clp": 0, "antiguedad_max_meses": 18, "organismo": "Corfo Chile", "dimension": "Estrategia Fundraising", "sprint": 3},
        "embedding": None,
    },
    {
        "document_title": "Corfo Semilla Expande — Requisitos de Postulación",
        "header_path": "Estrategia Fundraising",
        "content": "Corfo Semilla Expande financia startups chilenas que han superado la etapa de prototipo y demuestran tracción comercial inicial verificable. Criterios de elegibilidad: (1) Ventas netas acumuladas mínimas de CLP $100.000 en los últimos 12 meses, verificables en SII mediante boleta electrónica, factura o contrato de servicios con pago efectuado; (2) Fase tecnológica TRL 4–6 — desde prototipo validado en entorno relevante hasta sistema demostrado en condiciones de piloto real; (3) Antigüedad legal entre 6 meses y 4 años desde la constitución; (4) Empresa legalmente constituida en Chile (SpA, Ltda., S.A. o EIRL). Beneficio máximo: CLP $100.000.000 en subsidio no reembolsable (85% Corfo / 15% aporte propio). Criterios de evaluación competitiva: potencial de escalabilidad del mercado, diferenciación del modelo de negocio, equipo fundador complementario, y evidencia de aprendizaje iterativo con datos.",
        "category": "Estrategia Fundraising",
        "tags": ["corfo", "semilla_expande", "financiamiento", "fondos_publicos", "trl", "traccion", "ventas", "chile", "due_diligence", "escalabilidad"],
        "metadata": {"entity_type": "FUNDING_REQUIREMENT", "entity_value": "Corfo Semilla Expande", "monto_max_clp": 100000000, "cofinanciamiento_corfo": 0.85, "trl_requerido": "4-6", "ventas_min_clp": 100000, "antiguedad_min_meses": 6, "antiguedad_max_meses": 48, "organismo": "Corfo Chile", "dimension": "Estrategia Fundraising", "sprint": 3},
        "embedding": None,
    },
    {
        "document_title": "TRL — Technology Readiness Level",
        "header_path": "Traccion y Evidencia",
        "content": "El Technology Readiness Level (TRL) es la escala estándar de madurez tecnológica (origen NASA, adoptada por Corfo, ESA y la UE). Escala para due diligence ValidateAI: TRL 1 = principios básicos observados (solo hipótesis teórica); TRL 2 = concepto tecnológico formulado (solución imaginada, sin código); TRL 3 = prueba de concepto analítica (demo funcional mínima, puede ser manual o Wizard of Oz); TRL 4 = validación de componentes en laboratorio (MVP funcional interno, no desplegado con usuarios reales); TRL 5 = validación en entorno relevante (primeros usuarios beta reales bajo condiciones controladas, sin pago); TRL 6 = demostración de sistema en entorno relevante (piloto con usuarios reales en producción); TRL 7 = demostración en entorno operacional (usuarios reales con acceso abierto, primeras ventas); TRL 8 = sistema completo y calificado (escalado inicial demostrado); TRL 9 = sistema probado en entorno operacional completo (product-market fit, escala sostenida). Protocolo de verificación adversarial: una divergencia TRL declarado vs. TRL real de más de 2 niveles es señal de founder inflation.",
        "category": "Traccion y Evidencia",
        "tags": ["trl", "technology_readiness", "madurez_tecnologica", "corfo", "innovacion", "prototipo", "mvp", "evidencia", "due_diligence"],
        "metadata": {"entity_type": "MATURITY_METRIC", "entity_value": "TRL Scale 1-9", "estandar": "NASA / Corfo / EU Horizon", "niveles": 9, "dimension": "Traccion y Evidencia", "sprint": 3},
        "embedding": None,
    },
    {
        "document_title": "CRL — Commercial Readiness Level",
        "header_path": "Traccion y Evidencia",
        "content": "El Commercial Readiness Level (CRL) es la escala análoga al TRL para medir la madurez comercial de un modelo de negocio, adaptada por ValidateAI al ecosistema chileno y LATAM. Escala CRL 1–9: CRL 1 = segmento de mercado identificado sin validación; CRL 2 = hipótesis de problema con evidencia documental secundaria; CRL 3 = 10+ entrevistas Mom Test con incidentes documentados; CRL 4 = MVP entregado a usuarios beta (sin cobrar); CRL 5 = primera venta real facturada (el monto es irrelevante — la voluntad de pago es la métrica); CRL 6 = clientes recurrentes con al menos 2 ciclos de pago completados y churn mensual < 25%; CRL 7 = Product-Market Fit declarado con evidencia cuantitativa (40% rule de Sean Ellis con n>30); CRL 8 = crecimiento orgánico medible (>15% MoM por 3 meses consecutivos); CRL 9 = liderazgo de segmento con ventaja competitiva defensible. Balance ideal para ronda Seed: TRL 5–6 + CRL 5–6.",
        "category": "Traccion y Evidencia",
        "tags": ["crl", "commercial_readiness", "madurez_comercial", "traccion", "pmf", "product_market_fit", "ventas", "churn", "evidencia", "due_diligence"],
        "metadata": {"entity_type": "MATURITY_METRIC", "entity_value": "CRL Scale 1-9", "pmf_threshold_40rule": 0.40, "churn_max_crl6": 0.25, "crecimiento_min_crl8_mom": 0.15, "dimension": "Traccion y Evidencia", "sprint": 3},
        "embedding": None,
    },
    {
        "document_title": "Blue Ocean Strategy — Value Innovation",
        "header_path": "Moat Competitivo",
        "content": "Blue Ocean Strategy (Kim & Mauborgne) propone que la ventaja competitiva sostenible no se construye siendo mejor en las mismas dimensiones que los competidores (Red Ocean), sino creando un espacio de mercado no disputado donde la competencia sea irrelevante. Marco ERRC (Eliminar-Reducir-Aumentar-Crear): Eliminar = ¿qué factores que la industria da por sentados deben eliminarse?; Reducir = ¿qué factores deben reducirse por debajo del estándar de la industria?; Aumentar = ¿qué factores deben elevarse por encima del estándar?; Crear = ¿qué factores inexistentes en la industria deben crearse? Aplicación en due diligence ValidateAI: si la startup no puede responder la columna Crear con al menos 1 elemento genuinamente nuevo para el mercado chileno o LATAM, está compitiendo en Red Ocean y su ventaja competitiva es temporal y frágil. Señal de falsa diferenciación: el pitch menciona ser mejor que X en 5 features — eso es competencia incremental, no Blue Ocean.",
        "category": "Moat Competitivo",
        "tags": ["blue_ocean", "value_innovation", "moat", "diferenciacion", "estrategia", "competencia", "errc", "due_diligence", "pitch"],
        "metadata": {"entity_type": "STRATEGIC_MOAT", "entity_value": "Blue Ocean Value Innovation", "framework": "ERRC Grid — Kim & Mauborgne", "dimension": "Moat Competitivo", "sprint": 3},
        "embedding": None,
    },
    {
        "document_title": "Network Effects — Efecto de Red",
        "header_path": "Moat Competitivo",
        "content": "Los efectos de red son el moat más poderoso para startups de plataforma y marketplace: el valor del producto aumenta con cada nuevo usuario, creando una barrera de entrada progresivamente más difícil de escalar para competidores. Tipos relevantes para LATAM: Efectos directos (mismo lado) = más usuarios → más valor para todos (ej. WhatsApp, redes de segunda mano); Efectos indirectos (cross-side) = más compradores → más vendedores y viceversa (ej. marketplaces); Efectos de datos = más interacciones → modelo ML más preciso → mejor producto → más usuarios (ej. fintech crediticia con scoring propio). Métricas de verificación: coeficiente viral K (K > 1 = crecimiento autosostenido); curva de retención cohorts — en productos con network effects reales, la retención de cohortes antiguas es igual o superior a la de cohortes nuevas. Señal de falso network effect: el producto funciona igual de bien con 10 usuarios que con 10.000.",
        "category": "Moat Competitivo",
        "tags": ["network_effects", "efecto_red", "moat", "plataforma", "marketplace", "viral", "flywheel", "latam", "due_diligence", "k_coefficient"],
        "metadata": {"entity_type": "STRATEGIC_MOAT", "entity_value": "Network Effects", "k_coefficient_threshold": 1.0, "tipos": ["directo", "indirecto", "datos"], "dimension": "Moat Competitivo", "sprint": 3},
        "embedding": None,
    },
    {
        "document_title": "WhatsApp-first GTM — Adopción Conversacional LatAm",
        "header_path": "MVP Roadmap",
        "content": "La estrategia WhatsApp-first GTM aprovecha la penetración superior al 90% de WhatsApp en Chile y LATAM para construir embudos de ventas conversacionales que eliminan la fricción de formularios web y onboarding digital complejo. Playbook validado para B2B SaaS con ticket < USD 500/mes en Chile: Fase 1 = capturar leads vía link wa.me o QR; Fase 2 = bot de calificación BANT en < 5 mensajes (WATI, BuilderBot, Twilio); Fase 3 = video de 90 segundos + link Calendly en el mismo hilo; Fase 4 = link de pago Mercado Pago o Stripe directo al chat; Fase 5 = onboarding por mensajes secuenciales, sin PDF ni portal. Impacto en CAC medido en mercados chilenos SMB: el funnel WhatsApp-first reduce el CAC entre 40–70% vs. pauta digital + landing page + CRM tradicional, por eliminación de tasas de abandono de formularios web (65–70% en móviles LATAM). Límite de escalabilidad: óptimo hasta ~500 clientes activos; más allá requiere integración completa con WhatsApp Business API y CRM conectado.",
        "category": "MVP Roadmap",
        "tags": ["whatsapp", "gtm", "go_to_market", "latam", "chile", "conversacional", "smb", "cac", "ventas", "onboarding", "b2b"],
        "metadata": {"entity_type": "GTM_STRATEGY", "entity_value": "WhatsApp-first GTM", "mercado": "Chile / LATAM", "cac_reduccion_estimada": "40-70%", "limite_clientes_sin_api": 500, "herramientas": ["WATI", "BuilderBot", "Twilio Conversations"], "dimension": "MVP Roadmap", "sprint": 3},
        "embedding": None,
    },
    {
        "document_title": "AI-First Product Management",
        "header_path": "MVP Roadmap",
        "content": "AI-First Product Management define el paradigma donde la inteligencia artificial es el núcleo de la propuesta de valor, no una feature adicional. Principios operativos: (1) Data flywheel antes de AI — diseñar el producto para capturar los datos correctos desde el primer usuario; el modelo mejora con cada interacción, convirtiendo el uso en ventaja competitiva acumulativa; (2) Automate the baseline first — automatizar el workflow más repetitivo y doloroso al 80% antes de lanzar features secundarias; (3) Design for exceptions — el AI maneja el 80% de casos predecibles; el humano maneja el 20% de casos edge de mayor valor; (4) Ship AI como código — versionar modelos con los mismos estándares que el código fuente: branching, rollback, A/B testing, monitoreo de drift. Riesgos críticos para due diligence: AI hallucination liability en sectores financiero, médico o legal bajo Ley 21.719 + regulación CMF; model drift oculto sin monitoreo. Ventaja competitiva real: el moat es el dataset propietario, no el modelo — cualquier competidor puede acceder a Claude o GPT, pero no puede replicar datos de comportamiento de usuario propietarios.",
        "category": "MVP Roadmap",
        "tags": ["ai_first", "product_management", "llm", "data_flywheel", "moat", "drift", "hallucination", "due_diligence", "dataset", "vc"],
        "metadata": {"entity_type": "GTM_STRATEGY", "entity_value": "AI-First Product Management", "moat_real": "dataset propietario no el modelo", "riesgo_regulatorio": "Ley 21.719 + CMF para outputs incorrectos", "dimension": "MVP Roadmap", "sprint": 3},
        "embedding": None,
    },
]

ALL_NODES = SPRINT1_NODES + SPRINT2_NODES + SPRINT3_NODES


# ── ARISTAS (70 total) ────────────────────────────────────────────────────────

ALL_EDGES: list[dict] = [
    # Sprint 1: Unit Economics
    {"source_title": "LTV — Lifetime Value del Cliente",             "target_title": "CAC — Costo de Adquisición de Cliente",              "relation_type": "MEASURES_SUCCESS_OF"},
    {"source_title": "Payback Period — Periodo de Recuperación CAC", "target_title": "CAC — Costo de Adquisición de Cliente",              "relation_type": "REQUIRES"},
    {"source_title": "Benchmark LTV:CAC > 3:1",                      "target_title": "LTV — Lifetime Value del Cliente",                   "relation_type": "REQUIRES"},
    {"source_title": "Benchmark LTV:CAC > 3:1",                      "target_title": "CAC — Costo de Adquisición de Cliente",              "relation_type": "REQUIRES"},
    {"source_title": "Benchmark Payback < 12 meses",                 "target_title": "Payback Period — Periodo de Recuperación CAC",       "relation_type": "REQUIRES"},
    # Sprint 1: Definición del Problema
    {"source_title": "Mom Test — Regla de Hechos No Opiniones",                    "target_title": "Lean Startup — Customer Discovery vs Customer Validation", "relation_type": "VALIDATES_PROBLEM"},
    {"source_title": "Mom Test — Regla de No Presentar la Solución",               "target_title": "Lean Startup — Customer Discovery vs Customer Validation", "relation_type": "VALIDATES_PROBLEM"},
    {"source_title": "Mom Test — Regla de Conversaciones Específicas e Incidentes","target_title": "Lean Startup — Customer Discovery vs Customer Validation", "relation_type": "VALIDATES_PROBLEM"},
    {"source_title": "Lean Startup — Build-Measure-Learn",                         "target_title": "Lean Startup — Customer Discovery vs Customer Validation", "relation_type": "REQUIRES"},
    {"source_title": "Lean Startup — Validated Learning",                          "target_title": "Lean Startup — Build-Measure-Learn",                      "relation_type": "REQUIRES"},
    {"source_title": "Lean Startup — Validated Learning",                          "target_title": "Lean Startup — Customer Discovery vs Customer Validation", "relation_type": "REQUIRES"},
    # Sprint 1: TAM/SAM/SOM
    {"source_title": "TAM/SAM/SOM — Metodología Bottom-Up", "target_title": "TAM/SAM/SOM — Metodología Top-Down",                        "relation_type": "MEASURES_SUCCESS_OF"},
    {"source_title": "TAM/SAM/SOM — Metodología Bottom-Up", "target_title": "Lean Startup — Customer Discovery vs Customer Validation",   "relation_type": "REQUIRES"},
    {"source_title": "TAM/SAM/SOM — Metodología Bottom-Up", "target_title": "Mom Test — Regla de Hechos No Opiniones",                    "relation_type": "REQUIRES"},
    # Sprint 1: Cross-dimension
    {"source_title": "Benchmark LTV:CAC > 3:1",                       "target_title": "Lean Startup — Customer Discovery vs Customer Validation", "relation_type": "REQUIRES"},
    {"source_title": "Benchmark Payback < 12 meses",                   "target_title": "Lean Startup — Customer Discovery vs Customer Validation", "relation_type": "REQUIRES"},
    {"source_title": "TAM/SAM/SOM — Metodología Bottom-Up",            "target_title": "LTV — Lifetime Value del Cliente",                        "relation_type": "REQUIRES"},
    {"source_title": "TAM/SAM/SOM — Metodología Bottom-Up",            "target_title": "CAC — Costo de Adquisición de Cliente",                   "relation_type": "REQUIRES"},
    {"source_title": "Lean Startup — Validated Learning",               "target_title": "Benchmark LTV:CAC > 3:1",                                 "relation_type": "MEASURES_SUCCESS_OF"},
    {"source_title": "Lean Startup — Validated Learning",               "target_title": "Benchmark Payback < 12 meses",                            "relation_type": "MEASURES_SUCCESS_OF"},
    # Sprint 2: Gobernanza
    {"source_title": "Vesting y Cliff — Retención de Fundadores",    "target_title": "Estructura SpA (Sociedad por Acciones)",   "relation_type": "MITIGATES_RISK_OF"},
    {"source_title": "Drag-along — Derecho de Arrastre",             "target_title": "Estructura SpA (Sociedad por Acciones)",   "relation_type": "MITIGATES_RISK_OF"},
    {"source_title": "Tag-along — Derecho de Acompañamiento",        "target_title": "Vesting y Cliff — Retención de Fundadores","relation_type": "PROTECTS"},
    {"source_title": "Cláusula de No Competencia y Permanencia",     "target_title": "Vesting y Cliff — Retención de Fundadores","relation_type": "MITIGATES_RISK_OF"},
    {"source_title": "Drag-along — Derecho de Arrastre",             "target_title": "Tag-along — Derecho de Acompañamiento",    "relation_type": "MITIGATES_RISK_OF"},
    {"source_title": "Cláusula de No Competencia y Permanencia",     "target_title": "Estructura SpA (Sociedad por Acciones)",   "relation_type": "MITIGATES_RISK_OF"},
    # Sprint 2: Compliance intra
    {"source_title": "Ley Fintech 21.521 — Sistema de Finanzas Abiertas (SFA)", "target_title": "Ley Fintech 21.521 — Registro CMF de Prestadores",         "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    {"source_title": "Ley Fintech 21.521 — Sistema de Finanzas Abiertas (SFA)", "target_title": "Ley 21.719 — Gestión de Consentimiento",                   "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    {"source_title": "Ley 21.719 — Gestión de Consentimiento",                  "target_title": "Ley 21.719 — Estándar GDPR Chile",                         "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    {"source_title": "Ley 21.719 — Derecho al Olvido y Portabilidad",           "target_title": "Ley 21.719 — Estándar GDPR Chile",                         "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    {"source_title": "Ley 21.719 — Derecho al Olvido y Portabilidad",           "target_title": "Ley 21.719 — Gestión de Consentimiento",                   "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    {"source_title": "Ley Karin 21.643 — Prevención de Acoso y Violencia Laboral","target_title": "Ley Karin 21.643 — Protocolo de Prevención Obligatorio", "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    {"source_title": "Ley Fintech 21.521 — Registro CMF de Prestadores",        "target_title": "Estructura SpA (Sociedad por Acciones)",                   "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    # Sprint 2: Cross-sprint Legal → Sprint 1
    {"source_title": "Ley 21.719 — Estándar GDPR Chile",                         "target_title": "CAC — Costo de Adquisición de Cliente",                   "relation_type": "IMPACTS_ACQUISITION_STRATEGY"},
    {"source_title": "Ley 21.719 — Gestión de Consentimiento",                   "target_title": "CAC — Costo de Adquisición de Cliente",                   "relation_type": "IMPACTS_ACQUISITION_STRATEGY"},
    {"source_title": "Ley Fintech 21.521 — Sistema de Finanzas Abiertas (SFA)", "target_title": "LTV — Lifetime Value del Cliente",                          "relation_type": "IMPACTS_ACQUISITION_STRATEGY"},
    {"source_title": "Vesting y Cliff — Retención de Fundadores",                "target_title": "LTV — Lifetime Value del Cliente",                          "relation_type": "MITIGATES_RISK_OF"},
    {"source_title": "Cláusula de No Competencia y Permanencia",                 "target_title": "LTV — Lifetime Value del Cliente",                          "relation_type": "MITIGATES_RISK_OF"},
    {"source_title": "Estructura SpA (Sociedad por Acciones)",                   "target_title": "Benchmark LTV:CAC > 3:1",                                   "relation_type": "MITIGATES_RISK_OF"},
    {"source_title": "Ley Fintech 21.521 — Registro CMF de Prestadores",         "target_title": "Lean Startup — Customer Discovery vs Customer Validation",  "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    {"source_title": "Ley Karin 21.643 — Protocolo de Prevención Obligatorio",   "target_title": "Lean Startup — Customer Discovery vs Customer Validation",  "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    {"source_title": "Ley 21.719 — Derecho al Olvido y Portabilidad",            "target_title": "LTV — Lifetime Value del Cliente",                          "relation_type": "IMPACTS_ACQUISITION_STRATEGY"},
    {"source_title": "Ley 21.719 — Gestión de Consentimiento",                   "target_title": "TAM/SAM/SOM — Metodología Bottom-Up",                       "relation_type": "IMPACTS_ACQUISITION_STRATEGY"},
    # Sprint 3: Fundraising + Tracción
    {"source_title": "TRL — Technology Readiness Level",              "target_title": "Corfo Semilla Inicia — Requisitos de Postulación",  "relation_type": "QUALIFIES_FOR"},
    {"source_title": "TRL — Technology Readiness Level",              "target_title": "Corfo Semilla Expande — Requisitos de Postulación", "relation_type": "QUALIFIES_FOR"},
    {"source_title": "CRL — Commercial Readiness Level",              "target_title": "Corfo Semilla Expande — Requisitos de Postulación", "relation_type": "QUALIFIES_FOR"},
    {"source_title": "CRL — Commercial Readiness Level",              "target_title": "Corfo Semilla Inicia — Requisitos de Postulación",  "relation_type": "DISQUALIFIES_FROM"},
    {"source_title": "Corfo Semilla Expande — Requisitos de Postulación", "target_title": "Corfo Semilla Inicia — Requisitos de Postulación", "relation_type": "DISQUALIFIES_FROM"},
    {"source_title": "CRL — Commercial Readiness Level",              "target_title": "TRL — Technology Readiness Level",                  "relation_type": "MEASURES_SUCCESS_OF"},
    # Sprint 3: Moat
    {"source_title": "Network Effects — Efecto de Red",        "target_title": "Blue Ocean Strategy — Value Innovation", "relation_type": "MEASURES_SUCCESS_OF"},
    {"source_title": "Blue Ocean Strategy — Value Innovation", "target_title": "Network Effects — Efecto de Red",        "relation_type": "MITIGATES_RISK_OF"},
    # Sprint 3: MVP Roadmap
    {"source_title": "AI-First Product Management",                             "target_title": "Network Effects — Efecto de Red",          "relation_type": "MEASURES_SUCCESS_OF"},
    {"source_title": "WhatsApp-first GTM — Adopción Conversacional LatAm",     "target_title": "AI-First Product Management",               "relation_type": "QUALIFIES_FOR"},
    {"source_title": "AI-First Product Management",                             "target_title": "Ley 21.719 — Estándar GDPR Chile",          "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    # Sprint 3: Cross-sprint
    {"source_title": "WhatsApp-first GTM — Adopción Conversacional LatAm",     "target_title": "CAC — Costo de Adquisición de Cliente",                   "relation_type": "REDUCES_COST_OF"},
    {"source_title": "Network Effects — Efecto de Red",                         "target_title": "CAC — Costo de Adquisición de Cliente",                   "relation_type": "REDUCES_COST_OF"},
    {"source_title": "Network Effects — Efecto de Red",                         "target_title": "LTV — Lifetime Value del Cliente",                        "relation_type": "MEASURES_SUCCESS_OF"},
    {"source_title": "Blue Ocean Strategy — Value Innovation",                  "target_title": "Benchmark LTV:CAC > 3:1",                                 "relation_type": "MITIGATES_RISK_OF"},
    {"source_title": "Blue Ocean Strategy — Value Innovation",                  "target_title": "TAM/SAM/SOM — Metodología Bottom-Up",                     "relation_type": "REQUIRES"},
    {"source_title": "AI-First Product Management",                             "target_title": "CAC — Costo de Adquisición de Cliente",                   "relation_type": "REDUCES_COST_OF"},
    {"source_title": "AI-First Product Management",                             "target_title": "LTV — Lifetime Value del Cliente",                        "relation_type": "MITIGATES_RISK_OF"},
    {"source_title": "Corfo Semilla Inicia — Requisitos de Postulación",        "target_title": "Mom Test — Regla de Hechos No Opiniones",                 "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    {"source_title": "Corfo Semilla Inicia — Requisitos de Postulación",        "target_title": "Estructura SpA (Sociedad por Acciones)",                  "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    {"source_title": "Corfo Semilla Expande — Requisitos de Postulación",       "target_title": "Estructura SpA (Sociedad por Acciones)",                  "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    {"source_title": "Corfo Semilla Expande — Requisitos de Postulación",       "target_title": "Benchmark Payback < 12 meses",                            "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    {"source_title": "Corfo Semilla Expande — Requisitos de Postulación",       "target_title": "Benchmark LTV:CAC > 3:1",                                 "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    {"source_title": "CRL — Commercial Readiness Level",                        "target_title": "Lean Startup — Customer Discovery vs Customer Validation", "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    {"source_title": "CRL — Commercial Readiness Level",                        "target_title": "Mom Test — Regla de Conversaciones Específicas e Incidentes", "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    {"source_title": "TRL — Technology Readiness Level",                        "target_title": "Lean Startup — Build-Measure-Learn",                      "relation_type": "MEASURES_SUCCESS_OF"},
    {"source_title": "AI-First Product Management",                             "target_title": "Ley 21.719 — Gestión de Consentimiento",                  "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    {"source_title": "WhatsApp-first GTM — Adopción Conversacional LatAm",     "target_title": "Ley 21.719 — Gestión de Consentimiento",                  "relation_type": "REQUIRES_COMPLIANCE_WITH"},
    {"source_title": "Corfo Semilla Expande — Requisitos de Postulación",       "target_title": "Vesting y Cliff — Retención de Fundadores",               "relation_type": "REQUIRES_COMPLIANCE_WITH"},
]


def check(client) -> None:
    """Cuenta nodos Familia A existentes en la DB."""
    cats = [
        "Unit Economics", "Definicion del Problema", "TAM/SAM/SOM",
        "Gobernanza", "Cumplimiento Normativo",
        "Estrategia Fundraising", "Traccion y Evidencia",
        "Moat Competitivo", "MVP Roadmap",
    ]
    result = (
        client.table("knowledge_nodes")
        .select("id, document_title, category, embedding")
        .in_("category", cats)
        .execute()
    )
    rows = result.data
    total = len(rows)
    with_emb = sum(1 for r in rows if r.get("embedding") is not None)
    print(f"\n  Nodos Familia A en DB: {total}/{len(ALL_NODES)}")
    print(f"  Con embedding:         {with_emb}/{total}")
    cats_found = set(r["category"] for r in rows)
    print(f"  Categorias presentes:  {cats_found}")
    if total > 0:
        missing = [n["document_title"] for n in ALL_NODES
                   if not any(r["document_title"] == n["document_title"] for r in rows)]
        if missing:
            print(f"\n  Faltantes ({len(missing)}):")
            for m in missing:
                print(f"    - {m}")
        else:
            print("\n  Todos los nodos presentes.")


def apply(client) -> None:
    """Inserta nodos y aristas de los 3 sprints."""
    print(f"\n  Insertando {len(ALL_NODES)} nodos Familia A...")
    n_inserted = bulk_insert_nodes(client, ALL_NODES)
    print(f"  OK: {n_inserted} nodos upserted")

    print(f"\n  Insertando {len(ALL_EDGES)} aristas...")
    result = (
        client.table("knowledge_edges")
        .upsert(ALL_EDGES, on_conflict="source_title,target_title,relation_type")
        .execute()
    )
    print(f"  OK: {len(result.data)} aristas upserted")
    print(f"\n  Grafo Familia A aplicado. Ejecuta ahora:")
    print("    py scripts/vectorize_pending.py --familia-a")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(
        description="Aplica nodos/aristas Familia A (Sprints 1-3) a Supabase"
    )
    parser.add_argument("--check", action="store_true", help="Solo verifica estado, no inserta")
    args = parser.parse_args()

    client = get_client()
    if args.check:
        check(client)
    else:
        check(client)
        print()
        apply(client)
