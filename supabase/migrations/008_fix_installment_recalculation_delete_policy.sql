alter table public.installments enable row level security;

drop policy if exists "installments delete through plan" on public.installments;

create policy "installments delete through plan" on public.installments
for delete using (
  exists (
    select 1
    from public.installment_plans p
    where p.id = installments.plan_id
      and (
        p.user_id = auth.uid()
        or (
          p.group_id is not null
          and public.is_group_member(p.group_id)
        )
      )
  )
);
