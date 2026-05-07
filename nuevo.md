# 📝 Contexto Global y Requerimientos: Nueva Arquitectura de Tiers de ValidateAI

## 🎯 Objetivo del Negocio
Actualizar el modelo de monetización y la arquitectura de acceso de **ValidateAI**. Pasaremos a un modelo de *paywall* basado en el valor de los entregables (secciones del reporte) y no en la restricción de los datos de entrada. El objetivo es hiper-personalizar la experiencia gratuita para generar "efecto wow" y usar los planes de pago como "centros de control" (financiero y legal) para startups.

## 📊 1. Nueva Estructura de Tiers y Precios

La base de datos, el archivo `useUserTier.ts` y Lemon Squeezy deben actualizarse para reflejar los siguientes 3 niveles:

* **🟢 Tier Free ($0)**
    * **Cuota:** 3 análisis por mes.
    * **Web Search:** 0 (Desactivado). Usar modelo IA más económico y rápido.
    * **Secciones Desbloqueadas:** `score`, `breakdown`, `questions`, `nextSteps`.
* **🟡 Tier Basic ($14.990 CLP/mes)**
    * **Cuota:** 15 análisis por mes.
    * **Web Search:** 5 al mes.
    * **Secciones Desbloqueadas:** Todo lo Free + `competitive_analysis`, `valueProposition`, `clientPersona`.
* **🟣 Tier Pro ($49.990 CLP/mes)**
    * **Cuota:** 50 análisis por mes.
    * **Web Search:** 50 al mes.
    * **Secciones Desbloqueadas:** TODAS (15 secciones, incluyendo `market_sizing`, `unit_economics`, `governance`, proyección financiera y exportación a PDF).

## 💻 2. Requerimientos de Frontend (UI/UX)
* **Formulario de Entrada (Pasos 1, 2 y 3):** Todos los usuarios, sin importar su Tier, deben poder completar **todos** los campos (industria, modelo B2B/B2C, nivel técnico, etc.) para asegurar un contexto rico.
* **Paywall / LockedSection:** El componente `LockedSection.tsx` debe renderizarse para los usuarios Free y Basic cuando intenten ver secciones superiores. Deben poder ver los *títulos* de las secciones bloqueadas (con efecto blur en el contenido) acompañados de un botón de "Upgrade".

## ⚙️ 3. Requerimientos de Backend y Base de Datos
* **AI Routing (`ai-validate/index.ts`):** Ajustar la lógica para que los usuarios Free no activen herramientas costosas (como búsquedas web) y usen los modelos más eficientes de Anthropic/OpenAI.
* **Pagos (`create-checkout/index.ts`):** Actualizar los IDs de los productos a los nuevos montos en CLP de Lemon Squeezy.
* **Migración de DB:** Crear un script de migración en Supabase para actualizar el campo `tier` de todos los perfiles existentes actualmente al valor predeterminado del nuevo plan **Free**, preparándolos para el nuevo modelo.