create extension if not exists pgcrypto;

create type transaction_type as enum ('income', 'expense');
create type member_role as enum ('owner', 'member');
create type split_status as enum ('pending', 'paid');
create type split_mode as enum ('equal', 'amount', 'percentage');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  created_at timestamptz not null default now()
);

create table public.categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.profiles(id) on delete cascade,
  name text not null,
  color text not null default '#0f766e',
  created_at timestamptz not null default now(),
  unique (user_id, name)
);

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.group_members (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  role member_role not null default 'member',
  created_at timestamptz not null default now(),
  unique (group_id, user_id)
);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  title text not null,
  amount numeric(14,2) not null check (amount > 0),
  occurred_on date not null,
  category_id uuid references public.categories(id) on delete set null,
  type transaction_type not null,
  notes text,
  created_at timestamptz not null default now()
);

create table public.shared_expenses (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  title text not null,
  amount numeric(14,2) not null check (amount > 0),
  occurred_on date not null,
  category_id uuid references public.categories(id) on delete set null,
  paid_by uuid not null references public.profiles(id),
  split_mode split_mode not null default 'equal',
  created_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.installment_plans (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  group_id uuid references public.groups(id) on delete cascade,
  title text not null,
  total_amount numeric(14,2) not null check (total_amount > 0),
  installments_count int not null check (installments_count > 0),
  installment_amount numeric(14,2) not null check (installment_amount > 0),
  start_date date not null,
  due_day int not null check (due_day between 1 and 31),
  paid_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now()
);

create table public.installments (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.installment_plans(id) on delete cascade,
  number int not null check (number > 0),
  amount numeric(14,2) not null check (amount > 0),
  due_on date not null,
  status split_status not null default 'pending',
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  unique (plan_id, number)
);

create table public.shared_expense_splits (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.groups(id) on delete cascade,
  shared_expense_id uuid references public.shared_expenses(id) on delete cascade,
  installment_id uuid references public.installments(id) on delete cascade,
  debtor_id uuid not null references public.profiles(id),
  creditor_id uuid not null references public.profiles(id),
  amount numeric(14,2) not null check (amount > 0),
  percentage numeric(7,4),
  status split_status not null default 'pending',
  due_on date not null,
  paid_at timestamptz,
  created_at timestamptz not null default now(),
  check (debtor_id <> creditor_id),
  check (shared_expense_id is not null or installment_id is not null)
);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  split_id uuid references public.shared_expense_splits(id) on delete set null,
  payer_id uuid not null references public.profiles(id),
  receiver_id uuid not null references public.profiles(id),
  amount numeric(14,2) not null check (amount > 0),
  paid_at timestamptz not null default now(),
  notes text
);

create index group_members_user_idx on public.group_members(user_id);
create index group_members_group_idx on public.group_members(group_id);
create index transactions_user_month_idx on public.transactions(user_id, occurred_on);
create index shared_expenses_group_idx on public.shared_expenses(group_id);
create index splits_group_status_idx on public.shared_expense_splits(group_id, status);
create index splits_people_idx on public.shared_expense_splits(debtor_id, creditor_id);
create index installments_due_idx on public.installments(due_on, status);

create or replace function public.is_group_member(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
  );
$$;

create or replace function public.is_group_owner(target_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members gm
    where gm.group_id = target_group_id
      and gm.user_id = auth.uid()
      and gm.role = 'owner'
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do update
    set email = excluded.email,
        full_name = coalesce(excluded.full_name, public.profiles.full_name);
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.add_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.group_members (group_id, user_id, role)
  values (new.id, new.created_by, 'owner')
  on conflict (group_id, user_id) do nothing;
  return new;
end;
$$;

create trigger on_group_created
after insert on public.groups
for each row execute function public.add_owner_membership();

create or replace function public.invite_member_by_email(target_group_id uuid, target_email text)
returns public.group_members
language plpgsql
security definer
set search_path = public
as $$
declare
  target_profile public.profiles;
  inserted_member public.group_members;
begin
  if not public.is_group_owner(target_group_id) then
    raise exception 'Solo owners pueden invitar miembros';
  end if;

  select * into target_profile
  from public.profiles
  where lower(email) = lower(target_email)
  limit 1;

  if target_profile.id is null then
    raise exception 'No existe un usuario registrado con ese email';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (target_group_id, target_profile.id, 'member')
  on conflict (group_id, user_id) do update set role = public.group_members.role
  returning * into inserted_member;

  return inserted_member;
end;
$$;

alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.transactions enable row level security;
alter table public.shared_expenses enable row level security;
alter table public.installment_plans enable row level security;
alter table public.installments enable row level security;
alter table public.shared_expense_splits enable row level security;
alter table public.payments enable row level security;

create policy "profiles visible to self and groups" on public.profiles
for select using (
  id = auth.uid()
  or exists (
    select 1
    from public.group_members me
    join public.group_members other on other.group_id = me.group_id
    where me.user_id = auth.uid()
      and other.user_id = profiles.id
  )
);

create policy "profiles update own" on public.profiles
for update using (id = auth.uid()) with check (id = auth.uid());

create policy "categories readable" on public.categories
for select using (user_id is null or user_id = auth.uid());

create policy "categories own insert" on public.categories
for insert with check (user_id = auth.uid());

create policy "categories own update" on public.categories
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "categories own delete" on public.categories
for delete using (user_id = auth.uid());

create policy "groups members read" on public.groups
for select using (public.is_group_member(id));

create policy "groups authenticated create" on public.groups
for insert with check (created_by = auth.uid());

create policy "groups owners update" on public.groups
for update using (public.is_group_owner(id)) with check (public.is_group_owner(id));

create policy "groups owners delete" on public.groups
for delete using (public.is_group_owner(id));

create policy "members group read" on public.group_members
for select using (public.is_group_member(group_id));

create policy "members owners insert" on public.group_members
for insert with check (public.is_group_owner(group_id));

create policy "members owners update" on public.group_members
for update using (public.is_group_owner(group_id)) with check (public.is_group_owner(group_id));

create policy "members owners delete" on public.group_members
for delete using (public.is_group_owner(group_id));

create policy "transactions own read" on public.transactions
for select using (user_id = auth.uid());

create policy "transactions own insert" on public.transactions
for insert with check (user_id = auth.uid());

create policy "transactions own update" on public.transactions
for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "transactions own delete" on public.transactions
for delete using (user_id = auth.uid());

create policy "shared expenses members read" on public.shared_expenses
for select using (public.is_group_member(group_id));

create policy "shared expenses members insert" on public.shared_expenses
for insert with check (
  public.is_group_member(group_id)
  and created_by = auth.uid()
  and exists (select 1 from public.group_members where group_id = shared_expenses.group_id and user_id = paid_by)
);

create policy "shared expenses creator update" on public.shared_expenses
for update using (created_by = auth.uid() or public.is_group_owner(group_id))
with check (public.is_group_member(group_id));

create policy "shared expenses creator delete" on public.shared_expenses
for delete using (created_by = auth.uid() or public.is_group_owner(group_id));

create policy "plans visible own or group" on public.installment_plans
for select using (user_id = auth.uid() or (group_id is not null and public.is_group_member(group_id)));

create policy "plans create own" on public.installment_plans
for insert with check (
  user_id = auth.uid()
  and (group_id is null or public.is_group_member(group_id))
);

create policy "plans update own or group owner" on public.installment_plans
for update using (user_id = auth.uid() or (group_id is not null and public.is_group_owner(group_id)))
with check (user_id = auth.uid() or (group_id is not null and public.is_group_member(group_id)));

create policy "plans delete own or group owner" on public.installment_plans
for delete using (user_id = auth.uid() or (group_id is not null and public.is_group_owner(group_id)));

create policy "installments visible through plan" on public.installments
for select using (
  exists (
    select 1 from public.installment_plans p
    where p.id = installments.plan_id
      and (p.user_id = auth.uid() or (p.group_id is not null and public.is_group_member(p.group_id)))
  )
);

create policy "installments insert through plan" on public.installments
for insert with check (
  exists (
    select 1 from public.installment_plans p
    where p.id = installments.plan_id
      and (p.user_id = auth.uid() or (p.group_id is not null and public.is_group_member(p.group_id)))
  )
);

create policy "installments update through plan" on public.installments
for update using (
  exists (
    select 1 from public.installment_plans p
    where p.id = installments.plan_id
      and (p.user_id = auth.uid() or (p.group_id is not null and public.is_group_member(p.group_id)))
  )
) with check (
  exists (
    select 1 from public.installment_plans p
    where p.id = installments.plan_id
      and (p.user_id = auth.uid() or (p.group_id is not null and public.is_group_member(p.group_id)))
  )
);

create policy "splits members read" on public.shared_expense_splits
for select using (public.is_group_member(group_id));

create policy "splits members insert" on public.shared_expense_splits
for insert with check (
  public.is_group_member(group_id)
  and exists (select 1 from public.group_members where group_id = shared_expense_splits.group_id and user_id = debtor_id)
  and exists (select 1 from public.group_members where group_id = shared_expense_splits.group_id and user_id = creditor_id)
);

create policy "splits participants update" on public.shared_expense_splits
for update using (
  public.is_group_member(group_id)
  and (debtor_id = auth.uid() or creditor_id = auth.uid() or public.is_group_owner(group_id))
) with check (public.is_group_member(group_id));

create policy "payments participants read" on public.payments
for select using (
  payer_id = auth.uid()
  or receiver_id = auth.uid()
  or exists (
    select 1 from public.shared_expense_splits s
    where s.id = payments.split_id
      and public.is_group_member(s.group_id)
  )
);

create policy "payments participants insert" on public.payments
for insert with check (payer_id = auth.uid() or receiver_id = auth.uid());

insert into public.categories (user_id, name, color) values
  (null, 'Comida', '#0f9f6e'),
  (null, 'Casa', '#2563eb'),
  (null, 'Transporte', '#0891b2'),
  (null, 'Salidas', '#d97706'),
  (null, 'Salud', '#dc2626'),
  (null, 'Sueldo', '#16a34a'),
  (null, 'Viajes', '#7c3aed')
on conflict do nothing;
