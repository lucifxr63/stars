# Plan de Implementación Estratégico: Mejoras y Propuestas de Producto

**De:** Mesa Directiva  
**Para:** Equipo de Ingeniería y Producto  
**Objetivo:** Roadmap de desarrollo ordenado por ROI, mitigación de riesgos de fuga de usuarios y eficiencia técnica.

---

## 🛠️ PARTE 1: MEJORAS (Bugs y Deuda Técnica)

Este bloque se enfoca en tapar las fugas de conversión actuales, asegurar la integridad de los datos y limpiar la base de código. Se estructura en 3 Sprints.

### Sprint 1: Bloque Crítico (Fugas de Leads y Ruptura de Flujo)
*Impacto: Alto | Urgencia: Inmediata. Tareas prioritarias para evitar pérdidas de negocio.*

- [ ] **1. Corrección del Authorization header en envío de leads** *(Mejora 6)*
  - **Ubicación:** Línea 346, fetch a `send-quick-lead`.
  - **Acción:** Añadir el token JWT en las cabeceras (`Authorization: Bearer <token>`). Reemplazar el `catch` vacío por un sistema de logueo de errores (Sentry/PostHog) y dar feedback al usuario si la petición falla de forma crítica.
- [ ] **2. Sincronización de `validation_mode` en la rehidratación de la DB** *(Mejora 2)*
  - **Ubicación:** Línea 148, efecto de rehidratación desde Supabase.
  - **Acción:** Asegurar que el callback llame explícitamente a `setValidationMode(data.validation_mode)` para sincronizar correctamente el store de Zustand al cambiar de dispositivo o pestaña.
- [ ] **3. Reset de estados en el Exit Dialog** *(Mejora 5)*
  - **Ubicación:** Función `handleExitChoice` y cierre del modal.
  - **Acción:** Resetear explícitamente `emailInput` a cadena vacía y `emailSent` a `false` al desmontar o cerrar el diálogo para evitar estados persistentes incorrectos.
- [ ] **4. Condicional `isDirty` para el trigger del Exit-Intent** *(Mejora 8)*
  - **Ubicación:** Línea 209, efecto del temporizador de 20 segundos.
  - **Acción:** Modificar la lógica para que el modal de abandono solo se dispare si el formulario ha sufrido modificaciones (`isDirty === true`), evitando molestar a usuarios inactivos que no han interactuado.

### Sprint 2: Experiencia de Usuario (Fricción de Navegación)
*Impacto: Medio | Urgencia: Media. Corrección de comportamientos anómalos en el cliente.*

- [ ] **5. Cleanup en la intercepción del Back-Button** *(Mejora 7)*
  - **Ubicación:** Línea 300, efecto de manipulación de la History API.
  - **Acción:** Retornar una función de limpieza (*cleanup*) en el `useEffect` que elimine el event listener y maneje correctamente el `history.back()` para no ensuciar el historial de navegación con entradas vacías.
- [ ] **6. Inclusión de la configuración para el Tier 'Basic'** *(Mejora 3)*
  - **Ubicación:** Línea 35, componente `ValidationPlanBadge`.
  - **Acción:** Extender el objeto `TIER_BADGE_CONFIG` para dar soporte nativo al tier `basic` en lugar de hacer un fallback hacia `free`.

### Sprint 3: Refactorización y Mantenibilidad (Quick Wins de Código)
*Impacto: Interno | Urgencia: Baja. Centralizar en un único Pull Request de refactor.*

- [ ] **7. Centralización del cálculo de `lastStep`** *(Mejora 1)*
  - **Ubicación:** Líneas 114, 126, 203, 236, 275, 304.
  - **Acción:** Eliminar la expresión ternaria duplicada `isPremiumMode ? 4 : (isQuickMode ? 2 : 4)` y definir una única constante `lastStep` calculada al inicio del componente o extraída del hook del store.
- [ ] **8. Simplificación de la condición en el Step Header** *(Mejora 4)*
  - **Ubicación:** Línea 386.
  - **Acción:** Reemplazar el condicional complejo por la expresión simplificada equivalente: `currentStep < lastStep`.
- [ ] **9. Dinamización de steps en el flujo Premium** *(Mejora 10)*
  - **Ubicación:** Línea 393, cadena de texto inyectada.
  - **Acción:** Reemplazar el texto estático "Paso X de 3" derivando la longitud dinámicamente mediante: `Object.keys(STEP_COMPONENTS_PREMIUM).length - 1`.
- [ ] **10. Clave única (`key`) en el StepComponent** *(Mejora 9)*
  - **Ubicación:** Línea 408.
  - **Acción:** Inyectar la propiedad `key={currentStep}` dentro de `<StepComponent />` para forzar el re-renderizado limpio y prevenir la reutilización no deseada de instancias por parte de React.

---

## 🚀 PARTE 2: PROPUESTAS (Nuevas Features)

Este bloque se ha priorizado cruzando el valor estratégico de negocio frente al costo estimado de ingeniería.

### Fase 1: Conversión Inmediata y Retención (Quick Wins)
*Alto ROI, baja complejidad de desarrollo.*

- [ ] **11. Pre-llenado de email en el Exit Dialog vía Supabase Auth** *(Propuesta 2)*
  - **Impacto:** Maximiza de inmediato la tasa de captura de leads.
  - **Implementación:** Si `supabase.auth.getUser()` devuelve un usuario autenticado, inicializar el estado de `emailInput` con dicho valor por defecto.
- [ ] **12. Deep Linking / Wizard resumible por URL** *(Propuesta 9)*
  - **Impacto:** Permite estrategias de remarketing por correo electrónico ("Continúa donde lo dejaste").
  - **Implementación:** Al cargar `/validate`, parsear la URL buscando `?resume=validationId` o un hash para inicializar el store con el estado guardado de la base de datos de manera directa.
- [ ] **13. Test A/B de copies en FlowSelector vía PostHog** *(Propuesta 5)*
  - **Impacto:** Descubrir la nomenclatura óptima para guiar al usuario al flujo de mayor valor.
  - **Implementación:** Consumir el feature flag desde PostHog para alternar de manera aleatoria entre "Análisis rápido / Análisis completo" y variantes como "Score inmediato / Validación profunda".

### Fase 2: Robustez del Core y Reducción de Costos Operativos
*Complejidad Media-Alta, alto impacto en retención y finanzas.*

- [ ] **14. Auto-guardado parcial recurrente (Cada 30 segundos)** *(Propuesta 1)*
  - **Impacto:** Evita la frustración catastrófica de pérdida de progreso del usuario.
  - **Implementación:** Montar un `setInterval` controlado en el hook del formulario que realice un *upsert* silencioso en la base de datos de Supabase con el JSON del estado actual del formulario.
- [ ] **15. Recuperación granular tras errores en StepGenerating** *(Propuesta 7)*
  - **Impacto:** Reducción drástica en costos de tokens de LLM y tiempos de espera.
  - **Implementación:** Evaluar `generation_progress` para identificar qué tareas específicas fallaron (ej. `competitive_analysis`). Modificar el endpoint/UI para permitir reintentar exclusivamente los jobs fallidos de la cola en lugar de reiniciar todo el pipeline de IA.
- [ ] **16. Sugerencia inteligente de cambio de modo (Upsell Contextual)** *(Propuesta 4)*
  - **Impacto:** Convierte usuarios indecisos al flujo completo incrementando el engagement.
  - **Implementación:** Un listener que cuente los caracteres en el paso de Idea de Negocio; si la suma excede de 200 caracteres, renderizar un banner/chip recomendando cambiar al "Análisis Completo".

### Fase 3: Calidad de Entradas de Datos y Gamificación
*Complejidad Media, impacto a mediano plazo.*

- [ ] **17. Validador y semáforo de calidad de ideas en tiempo real** *(Propuesta 3)*
  - **Impacto:** Eleva drásticamente la calidad de los reportes generados por la IA al forzar mejores inputs.
  - **Implementación:** Aplicar un hook con `useDebounce` (1.5s) al text area de descripción. Ejecutar expresiones regulares simples (verificación de verbos de acción, números, longitud o keywords de problemas) y mostrar un indicador visual (Rojo / Amarillo / Verde).
- [ ] **18. Barra secundaria de progreso por campos del formulario** *(Propuesta 6)*
  - **Impacto:** Reduce la ansiedad y fomenta que los usuarios rellenen campos opcionales en pasos complejos (ej. Mercado).
  - **Implementación:** Un selector que compute el ratio de campos rellenados vs campos totales del step activo y lo plasme en una barra de progreso secundaria de tipo micro-UI.

### Fase 4: Backlog y Pulido Técnico
*Bajo impacto marginal. Implementar tras consolidar las fases anteriores.*

- [ ] **19. Estimación dinámica de tiempos reales** *(Propuesta 10)*
  - **Impacto:** Transparencia y credibilidad.
  - **Implementación:** Crear una función agregada o vista en Supabase que promedie `completed_at - created_at` del último percentil 50 de validaciones exitosas para sustituir los textos quemados de "5 min" y "10 min".
- [ ] **20. Sincronización de estado cross-tab vía BroadcastChannel** *(Propuesta 8)*
  - **Impacto:** Resuelve inconsistencias de estados cuando el usuario tiene abiertas múltiples pestañas.
  - **Implementación:** Integrar una instancia de `BroadcastChannel('validateai_store')` en el middleware de persistencia de Zustand para replicar instantáneamente los cambios de estado hacia las demás pestañas abiertas en el navegador.
