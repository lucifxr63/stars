# 📝 DIRECTRIZ TÉCNICA: INTEGRACIÓN DE "DATA STORY ENGINE" EN PANEL DE ADMIN (V5.0)

**De:** Mesa Directiva
**Para:** Claude Code / Equipo de Desarrollo
**Contexto del Negocio:** El sistema de generación de imágenes y copy (V4.0) validó exitosamente en el mercado. Ahora necesitamos integrarlo dentro del panel de administración del proyecto `validateai` (`src/app/routes/Admin.tsx`). Esto permitirá generar contenido dinámico desde cualquier dispositivo sin depender de una CLI local. 

## 1. Cambio Arquitectónico (CRÍTICO)
* **Eliminar Puppeteer:** No usaremos Puppeteer en el entorno web. 
* **Renderizado Client-Side:** Renderizaremos el diseño V4.0 como un componente nativo de React + Tailwind.
* **Captura de Imagen:** Utilizaremos `html-to-image` (o `html2canvas`) para convertir el componente React en un PNG descargable directamente desde el navegador del usuario.
* **Generación AI:** Se integrará un botón para que el modelo de IA (actualmente configurado en el proyecto) sugiera los datos (título, métrica, insight y copy para LinkedIn).

## 2. Dependencias Requeridas
Instalar las siguientes dependencias en el proyecto `validateai`:
```bash
npm install html-to-image react-chartjs-2 chart.js