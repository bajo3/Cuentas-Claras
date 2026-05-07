create or replace function public.add_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (group_id, user_id) do update
    set role = 'owner';

  return new;
end;
$$;

drop trigger if exists on_group_created on public.groups;
create trigger on_group_created
after insert on public.groups
for each row execute function public.add_owner_membership();

alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.installment_plans enable row level security;
alter table public.installments enable row level security;

drop policy if exists "groups members read" on public.groups;
drop policy if exists "groups authenticated create" on public.groups;
drop policy if exists "groups owners update" on public.groups;
drop policy if exists "groups owners delete" on public.groups;

create policy "groups members read" on public.groups
for select using (public.is_group_member(id));

create policy "groups authenticated create" on public.groups
for insert with check (
  auth.uid() is not null
  and created_by = auth.uid()
);

create policy "groups owners update" on public.groups
for update using (public.is_group_owner(id)) with check (public.is_group_owner(id));

create policy "groups owners delete" on public.groups
for delete using (public.is_group_owner(id));

drop policy if exists "members group read" on public.group_members;
drop policy if exists "members owners insert" on public.group_members;
drop policy if exists "members owners update" on public.group_members;
drop policy if exists "members owners delete" on public.group_members;

create policy "members group read" on public.group_members
for select using (public.is_group_member(group_id));

create policy "members insert" on public.group_members
for insert with check (
  (
    public.is_group_owner(group_id)
  ) or (
    user_id = auth.uid()
    and role = 'owner'
    and exists (
      select 1
      from public.groups g
      where g.id = group_members.group_id
        and g.created_by = auth.uid()
    )
  )
);

create policy "members owners update" on public.group_members
for update using (public.is_group_owner(group_id)) with check (public.is_group_owner(group_id));

create policy "members owners delete" on public.group_members
for delete using (public.is_group_owner(group_id));

drop policy if exists "plans visible own or group" on public.installment_plans;
drop policy if exists "plans create own" on public.installment_plans;
drop policy if exists "plans update own or group owner" on public.installment_plans;
drop policy if exists "plans delete own or group owner" on public.installment_plans;

create policy "plans visible own or group" on public.installment_plans
for select using (
  user_id = auth.uid()
  or (
    group_id is not null
    and public.is_group_member(group_id)
  )
);

create policy "plans create own" on public.installment_plans
for insert with check (
  user_id = auth.uid()
  and (
    (
      group_id is null
      and paid_by = auth.uid()
    ) or (
      group_id is not null
      and public.is_group_member(group_id)
      and exists (
        select 1
        from public.group_members gm
        where gm.group_id = installment_plans.group_id
          and gm.user_id = installment_plans.paid_by
      )
    )
  )
);

create policy "plans update own or group owner" on public.installment_plans
for update using (
  user_id = auth.uid()
  or (
    group_id is not null
    and public.is_group_owner(group_id)
  )
) with check (
  user_id = auth.uid()
  or (
    group_id is not null
    and public.is_group_member(group_id)
  )
);

create policy "plans delete own or group owner" on public.installment_plans
for delete using (
  user_id = auth.uid()
  or (
    group_id is not null
    and public.is_group_owner(group_id)
  )
);

drop policy if exists "installments visible through plan" on public.installments;
drop policy if exists "installments insert through plan" on public.installments;
drop policy if exists "installments update through plan" on public.installments;

create policy "installments visible through plan" on public.installments
for select using (
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

create policy "installments insert through plan" on public.installments
for insert with check (
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

create policy "installments update through plan" on public.installments
for update using (
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
) with check (
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
