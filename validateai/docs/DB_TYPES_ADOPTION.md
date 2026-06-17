# Tipos de DB generados — estado y adopción

## Qué hay
- `src/lib/database.types.ts` — tipos TypeScript generados desde el schema de **producción**
  (`supabase gen types typescript --linked`). Cubre todas las tablas, vistas y RPCs.
- `npm run gen:types` — regenera el archivo. Correr tras cada migración aplicada.

## Estado actual
El cliente Supabase **todavía NO** está tipado con `createClient<Database>`. Motivo: al
tiparlo aparecen ~31 errores porque los tipos de dominio escritos a mano
(`Validation`, `ValidationFull`, `FounderProfileData`, `SurveySubmission`…) no coinciden
1:1 con las `Row` generadas. Resolverlos con `as unknown as` anularía el beneficio del
tipado, así que la adopción global es una **migración enfocada pendiente**, no un parche.

## Por qué vale la pena (ya pagó)
Generar estos tipos **encontró un bug de producción**: el wizard llamaba a la RPC
`merge_generation_progress` (persistencia de progreso de generación) que **nunca se
había aplicado a prod** (la migración `20260530_generation_progress.sql` existía en el
repo pero no en la DB — ver el gap de historial de migraciones). Las llamadas fallaban
en silencio (tragadas por el `catch`). Se aplicó la migración faltante → corregido.

## Camino de adopción (incremental, sin big-bang)
1. **Uso puntual ya disponible**: tipar queries/RPC nuevas sin tipar el cliente global:
   ```ts
   import type { Database } from '@/lib/database.types';
   type Feedback = Database['public']['Tables']['report_feedback']['Row'];
   const { data } = await supabase.from('report_feedback').select('*').returns<Feedback[]>();
   ```
2. **Migración del cliente** (sesión dedicada): tipar `createClient<Database>` y, archivo
   por archivo, reemplazar los tipos de dominio por las `Row` generadas (o `Pick<Row, …>`),
   en vez de castear. Empezar por los menos críticos; dejar wizard/ValidationDetail al final.
3. Mantener `npm run gen:types` en el flujo post-migración para que no haya drift.
