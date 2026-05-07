# 📝 DIRECTRIZ ESTRATÉGICA: PIVOTE A MOTOR DE RENDERIZADO 100% CÓDIGO (MVP v2)

**De:** Mesa Directiva
**Para:** Equipo Técnico y de Producto
**Fecha:** Sprint Actual
**Asunto:** Eliminación de dependencia de Canva/Figma y transición a motor Puppeteer.

---

## 1. Contexto y Racional del Pivote
Equipo, el MVP inicial generando CSVs para Canva nos demostró que tenemos los datos correctos para nuestra estrategia de *Data Storytelling*. Sin embargo, para proteger el *runway* (costo $0) y lograr una automatización real donde no dependamos de herramientas de terceros ni de trabajo manual de "arrastrar y soltar", hemos decidido **pivotar la arquitectura de generación visual**.

A partir de hoy, nuestro *pipeline* de contenido a redes sociales será **100% basado en código**.

## 2. Nuevo Stack Tecnológico
Reemplazamos el exportador de CSV y Canva por un motor de renderizado web local:
* **Core:** Node.js + TypeScript.
* **Maquetado:** HTML5 + Tailwind CSS (vía CDN para no compilar).
* **Renderizado & Captura:** `puppeteer` (Headless Chrome).

## 3. Instrucciones de Implementación (Acción Inmediata)

### Paso 1: Dependencias
Por favor, instalen Puppeteer en el entorno actual de Node:
```bash
npm install puppeteer
npm install -D @types/puppeteer