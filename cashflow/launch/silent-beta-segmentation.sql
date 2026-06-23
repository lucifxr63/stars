-- ============================================================
-- Silent Beta — Segmentación de usuarios de Validus (READ-ONLY)
-- ============================================================
-- Criterio (nuevo.md): fundadores que completaron el Wizard de validación Y
-- cuyo Score de Ejecución (execution) o Market Fit (market) supera 70/100.
-- Las dimensiones viven en validations.score_breakdown (jsonb), rango 0–100.
--
-- Ejecutar en el SQL Editor de Validus para obtener la lista a cargar en
-- Resend/SendGrid. NO modifica datos. `name` cae a primer nombre o local del
-- email si no hay full_name.
-- ============================================================

select
  u.email,
  coalesce(
    u.raw_user_meta_data->>'full_name',
    u.raw_user_meta_data->>'name',
    initcap(split_part(u.email, '@', 1))
  )                                              as name,
  max((v.score_breakdown->>'execution')::numeric) as execution_score,
  max((v.score_breakdown->>'market')::numeric)    as market_score
from validations v
join auth.users u on u.id = v.user_id
where v.status = 'completed'
  and v.score_breakdown is not null
  and (
    (v.score_breakdown->>'execution')::numeric > 70
    or (v.score_breakdown->>'market')::numeric > 70
  )
group by u.id, u.email
order by greatest(
  max((v.score_breakdown->>'execution')::numeric),
  max((v.score_breakdown->>'market')::numeric)
) desc;
