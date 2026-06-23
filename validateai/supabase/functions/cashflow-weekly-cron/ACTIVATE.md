# Activar las alertas semanales (cashflow-weekly-cron)

**Estado: DORMANTE.** La función está desplegada pero NO programada. No envía
correos hasta que se active el cron. Activar SOLO después del lanzamiento y con
el dominio verificado en Resend.

## Prerrequisitos
1. **Resend:** dominio `scouttech.lat` verificado (SPF/DKIM/DMARC), `RESEND_API_KEY`
   ya existe como secret del proyecto.
2. Extensiones `pg_cron` y `pg_net` habilitadas (Validus ya las usa).

## Programar (lunes 08:00, hora del servidor)
Ejecutar en el SQL Editor de prod (reemplaza `<SERVICE_ROLE_KEY>`):

```sql
select cron.schedule(
  'cashflow-weekly-alerts',
  '0 8 * * 1',  -- lunes 08:00
  $$
  select net.http_post(
    url     := 'https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/cashflow-weekly-cron',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <SERVICE_ROLE_KEY>'
    ),
    body    := '{}'::jsonb
  );
  $$
);
```

## Desactivar
```sql
select cron.unschedule('cashflow-weekly-alerts');
```

## Probar manualmente (sin esperar al lunes)
```bash
curl -X POST https://fcdhcntyvsydnvjwopfe.supabase.co/functions/v1/cashflow-weekly-cron \
  -H "Authorization: Bearer <SERVICE_ROLE_KEY>"
```
La función responde `{ evaluated, alerted }`. Con `RESEND_API_KEY` ausente o
dominio sin verificar, los correos se omiten/fallan sin romper la evaluación.
