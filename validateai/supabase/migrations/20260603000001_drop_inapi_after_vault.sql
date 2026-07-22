-- ⚠️  EJECUTAR SOLO DESPUÉS DE VERIFICAR QUE EL KNOWLEDGE-VAULT FUNCIONA EN PRODUCCIÓN
--
-- Checklist antes de ejecutar:
--   ✅ migrate_inapi_to_vault.mjs completó sin errores
--   ✅ Conteos coinciden (503K filas en vault)
--   ✅ KNOWLEDGE_VAULT_URL + KNOWLEDGE_VAULT_SERVICE_ROLE_KEY seteados en Supabase Secrets
--   ✅ inapi-fetch desplegado con el nuevo código
--   ✅ Probado en producción: buscar una marca real y ver resultado
--
-- Resultado: DB principal pasa de ~1.33 GB a ~54 MB

DROP TABLE IF EXISTS public.inapi_records CASCADE;

-- Liberar espacio inmediatamente (VACUUM no requiere lock exclusivo)
VACUUM FULL public.inapi_records;
