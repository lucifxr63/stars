Plan: Content Studio en Admin > Contenido
Diagnóstico del estado actual
El DataStoryEngine actual es un prototipo manual: 2 presets hardcodeados, genera un solo post 1080×1080, sin conexión real a los datos del admin. El usuario quiere algo radicalmente distinto: un generador de carruseles alimentado por los datos reales que ya viven en el admin.

Concepto: "Centros de Información"
Los datos del admin son las fuentes. Cada centro produce un contexto diferente para la IA:

Centro	Datos que aporta	Tipo de contenido que genera
Métricas de plataforma	Usuarios activos, tasa de completación, score promedio, tendencias 14 días	"ValidateAI en números: lo que está pasando"
Tendencias de mercado	Industrias más validadas, países, modelos de negocio, score por sector	"Las ideas que más se validan en LatAm hoy"
Patrones de validación	Riesgos recurrentes, unit economics, founder fit promedio	"Los errores más comunes de los founders"
AI Usage	Prompts más usados, tokens, modelos, costo por análisis	Contenido técnico sobre el uso de IA en startups
Custom	Topic libre + datos manuales (como el DataStoryEngine actual)	Cualquier narrativa
Arquitectura

Admin > Contenido
└── ContentStudio.tsx                  ← reemplaza DataStoryEngine
    ├── 1. DataCenterSelector          ← elige la fuente
    ├── 2. DataPreview                 ← muestra los datos que se usarán
    ├── 3. ConfigPanel                 ← plataforma, tema, frame narrativo
    ├── 4. [Edge Function] generate-content-story
    └── 5. CarouselEditor (reutilizado) + exportación
Nueva Edge Function: generate-content-story/index.ts

Recibe: { center, platform, frame, adminData }
adminData = snapshot de métricas ya calculadas en el frontend (no hace queries directas)
Devuelve: mismo schema JSON de 7 slides que generate-carousel
Reutilización de lo ya construido:

CarouselEditor.tsx — 100% reutilizable, solo cambia el origen del campaign
carouselExport.ts — sin cambios
carouselStore.ts — generateCarousel se reemplaza por generateStory que llama a la nueva function
Flujo de usuario

1. Admin abre Contenido
2. Selecciona Centro de Información (ej: "Tendencias de mercado")
3. Ve un preview de los datos que se van a usar (tabla compacta)
4. Elige plataforma (LinkedIn/Instagram) y frame narrativo (PAS/AIDA)
5. Pulsa "Generar carrusel"
6. La IA genera 7 slides con narrativa estructurada
7. Edita slides (drag-and-drop, textos)
8. Exporta PDF o ZIP
Fases de implementación
Fase A — Edge Function generate-content-story (30 min)

Prompt especializado para narrativa de datos de plataforma
Contexto dinámico según el centro seleccionado
Mismo schema de salida que generate-carousel
Fase B — ContentStudio.tsx (60 min)

DataCenterSelector con 5 opciones
DataPreview que muestra los datos reales del admin
Panel de configuración (plataforma, tema, frame)
Integración con CarouselEditor embebido
Fase C — Wiring en Admin.tsx (15 min)

Reemplazar <DataStoryEngine /> por <ContentStudio />
Pasar los datos del admin ya cargados como props
Decisión arquitectónica clave
Los datos del admin ya están cargados en memoria en Admin.tsx (métricas, validaciones, usuarios). No necesita queries adicionales — ContentStudio los recibe como props y los serializa para el prompt. Esto elimina latencia y mantiene la seguridad (el admin ya está autenticado).