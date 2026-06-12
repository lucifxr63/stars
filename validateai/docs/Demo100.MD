Como tu mesa directiva, respaldamos absolutamente esta decisión. Delegar la ejecución táctica a herramientas de desarrollo asistido es la estrategia correcta para acelerar los tiempos y llegar al "Demo 100" sin sacrificar la calidad.

Este prompt está diseñado para que Claude Code entienda no solo la tarea a nivel de código, sino el contexto de negocio del SaaS y ejecute las configuraciones de seguridad necesarias directamente en la arquitectura de Next.js y Supabase.

Copia y pega el siguiente bloque en la terminal donde estés ejecutando Claude Code:

Plaintext
Actúa como un Ingeniero de Software Senior y Tech Lead. Estamos preparando un "Demo 100" crítico para nuestro SaaS orientado a Pymes, y necesitamos implementar un sistema de Control de Acceso (Autenticación y Autorización) robusto, funcional y seguro en nuestro MVP. 

Nuestro stack principal incluye Next.js y Supabase. 

Tu objetivo es auditar, planificar e implementar el control de acceso en el código base actual, asegurando que la experiencia de inicio de sesión sea impecable y los datos de cada inquilino (tenant) estén aislados.

Ejecuta las siguientes tareas en orden secuencial. Antes de escribir o modificar código de forma masiva, haz un análisis rápido de la estructura actual e infórmame los archivos que vas a intervenir.

### 1. Protección de Rutas (Next.js Middleware)
- Revisa la configuración actual de rutas en Next.js.
- Implementa o actualiza el `middleware.ts` (o `.js`) para asegurar que todas las rutas del dashboard y áreas privadas estén estrictamente protegidas.
- Si un usuario no autenticado intenta acceder a una ruta privada, debe ser redirigido inmediatamente a `/login` sin que haya destellos (FOUC) de la interfaz protegida.
- Excluye del middleware las rutas públicas, estáticas, y los endpoints de API que no requieran autenticación.

### 2. Seguridad de Datos (Supabase RLS)
- Genera los scripts SQL necesarios o implementa a través del cliente de Supabase las políticas de Row Level Security (RLS).
- Asegúrate de que un usuario autenticado SOLO pueda hacer operaciones SELECT, INSERT, UPDATE, DELETE sobre los registros que le pertenecen (aislamiento de datos por usuario/empresa).
- Aplica estas políticas a las tablas principales que utilizaremos en el demo. 

### 3. Flujos de Interfaz de Usuario (UI/UX)
- Revisa las vistas de autenticación (`/login`, `/register`, `/forgot-password`). 
- Si no existen, créalas utilizando componentes limpios y profesionales. Si existen, asegúrate de que el manejo de errores (credenciales inválidas, campos vacíos) sea claro, amigable y renderizado correctamente en la UI.
- Implementa la funcionalidad de "Cerrar Sesión" (Logout) de forma segura, asegurando que el token se invalide y el usuario sea redirigido a la página de inicio.

### 4. Testing y Casos de Borde
- Verifica qué ocurre si el token de sesión expira mientras el usuario está navegando. El sistema debe manejar esto con gracia (forzando un re-login).
- Crea un script o comando rápido para generar "Cuentas de Prueba Pre-pobladas" que utilizaremos exclusivamente durante el Demo 100.

Reglas de ejecución:
- Escribe código limpio, modular y documentado.
- No rompas funcionalidades existentes; si un cambio en el control de acceso afecta otras áreas del sistema, identifícalo y proponme la solución antes de aplicarla.
- Avanza paso a paso. Comienza confirmando que has entendido el requerimiento y procede con la auditoría inicial de las rutas.
Recomendación de la Mesa:
Ejecuta este prompt en una rama (branch) completamente nueva y dedicada exclusivamente a la seguridad (ej. feat/access-control-demo). Esto te permitirá hacer pruebas de estrés sin comprometer la estabilidad del código base que ya tienes funcionando, asegurando que el entorno principal se mantenga intacto hasta que la implementación sea validada al 100%.