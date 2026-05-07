-- ══════════════════════════════════════════════
-- 006_uva_plans.sql
-- Soporte para planes de cuotas en UVA
-- Pegar en el SQL Editor de Supabase y ejecutar.
-- Idempotente: seguro de correr más de una vez.
-- ══════════════════════════════════════════════

-- ── 1. Tipo de plan y campos UVA en installment_plans ────────────────────────
alter table public.installment_plans
  add column if not exists plan_type text not null default 'ARS'
    check (plan_type in ('ARS', 'UVA')),
  add column if not exists uva_count        numeric(14,4),
  add column if not exists uva_value_at_creation numeric(14,4),
  add column if not exists uva_value_date   date;

comment on column public.installment_plans.plan_type             is 'ARS = pesos fijos, UVA = Unidad de Valor Adquisitivo';
comment on column public.installment_plans.uva_count             is 'Cantidad de UVA por cuota (solo para plan_type=UVA)';
comment on column public.installment_plans.uva_value_at_creation is 'Valor UVA en pesos al momento de crear el plan';
comment on column public.installment_plans.uva_value_date        is 'Fecha del valor UVA usado al crear el plan';

-- ── 2. Tracking del valor UVA por cuota ──────────────────────────────────────
alter table public.installments
  add column if not exists uva_count  numeric(14,4),
  add column if not exists uva_value  numeric(14,4);

comment on column public.installments.uva_count is 'Cantidad de UVA de esta cuota';
comment on column public.installments.uva_value is 'Valor UVA en pesos al momento de calcular/pagar';

-- ── 3. Verificación ──────────────────────────────────────────────────────────
select
  column_name, data_type, column_default, is_nullable
from information_schema.columns
where table_schema = 'public'
  and table_name in ('installment_plans', 'installments')
  and column_name in ('plan_type', 'uva_count', 'uva_value_at_creation', 'uva_value_date', 'uva_value')
order by table_name, column_name;
