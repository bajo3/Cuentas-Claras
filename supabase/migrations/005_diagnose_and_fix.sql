-- ══════════════════════════════════════════════
-- 005_diagnose_and_fix.sql
-- Diagnóstico + corrección idempotente para Cuentas Claras
-- Pegar en el SQL Editor de Supabase y ejecutar.
-- Es seguro correr aunque todas las migraciones ya estén aplicadas.
-- ══════════════════════════════════════════════

-- ── 1. COLUMNAS FALTANTES EN PROFILES (migración 002) ────────────────────
alter table public.profiles
  add column if not exists avatar_url text,
  add column if not exists updated_at timestamptz not null default now();

-- Trigger updated_at en profiles
create or replace function public.set_updated_at()
returns trigger language plpgsql set search_path = public as $$
begin new.updated_at = now(); return new; end;
$$;

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row execute function public.set_updated_at();

-- ── 2. HANDLE_NEW_USER (incluye avatar_url para Google OAuth) ─────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    coalesce(new.email, ''),
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do update
    set email      = excluded.email,
        full_name  = coalesce(excluded.full_name, public.profiles.full_name),
        avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
        updated_at = now();
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

-- Sincronizar usuarios existentes
insert into public.profiles (id, email, full_name, avatar_url)
select
  u.id,
  coalesce(u.email, ''),
  coalesce(u.raw_user_meta_data ->> 'full_name', u.raw_user_meta_data ->> 'name'),
  coalesce(u.raw_user_meta_data ->> 'avatar_url', u.raw_user_meta_data ->> 'picture')
from auth.users u
on conflict (id) do update
  set email      = excluded.email,
      full_name  = coalesce(excluded.full_name, public.profiles.full_name),
      avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
      updated_at = now();

-- ── 3. PROFILES: política insert si no existe ─────────────────────────────
do $$ begin
  if not exists (
    select 1 from pg_policies where tablename='profiles' and policyname='profiles insert own'
  ) then
    execute 'create policy "profiles insert own" on public.profiles for insert with check (id = auth.uid())';
  end if;
end $$;

-- ── 4. ENUMS PARA MIGRACIÓN 004 ───────────────────────────────────────────
do $$ begin
  if not exists (select 1 from pg_type where typname = 'invitation_status') then
    create type invitation_status as enum ('pending', 'accepted', 'declined', 'cancelled');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'notification_type') then
    create type notification_type as enum ('invitation', 'payment', 'overdue', 'group_event');
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_type where typname = 'recurrence_frequency') then
    create type recurrence_frequency as enum ('weekly', 'biweekly', 'monthly', 'annual');
  end if;
end $$;

-- ── 5. TABLA group_invitations ────────────────────────────────────────────
create table if not exists public.group_invitations (
  id             uuid              primary key default gen_random_uuid(),
  group_id       uuid              not null references public.groups(id) on delete cascade,
  inviter_id     uuid              not null references public.profiles(id),
  invitee_email  text              not null,
  status         invitation_status not null default 'pending',
  created_at     timestamptz       not null default now(),
  responded_at   timestamptz
);

create index if not exists group_invitations_group_idx  on public.group_invitations(group_id);
create index if not exists group_invitations_email_idx  on public.group_invitations(lower(invitee_email));
create index if not exists group_invitations_status_idx on public.group_invitations(status);

alter table public.group_invitations enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='group_invitations' and policyname='invitations owner read') then
    execute $p$create policy "invitations owner read" on public.group_invitations
      for select using (
        public.is_group_owner(group_id)
        or lower(invitee_email) = lower((select email from public.profiles where id = auth.uid()))
      )$p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='group_invitations' and policyname='invitations owner create') then
    execute $p$create policy "invitations owner create" on public.group_invitations
      for insert with check (public.is_group_owner(group_id) and inviter_id = auth.uid())$p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='group_invitations' and policyname='invitations update owner or invitee') then
    execute $p$create policy "invitations update owner or invitee" on public.group_invitations
      for update using (
        public.is_group_owner(group_id)
        or lower(invitee_email) = lower((select email from public.profiles where id = auth.uid()))
      ) with check (true)$p$;
  end if;
end $$;

-- ── 6. TABLA notifications ────────────────────────────────────────────────
create table if not exists public.notifications (
  id         uuid              primary key default gen_random_uuid(),
  user_id    uuid              not null references public.profiles(id) on delete cascade,
  type       notification_type not null,
  title      text              not null,
  body       text,
  data       jsonb,
  is_read    boolean           not null default false,
  created_at timestamptz       not null default now()
);

create index if not exists notifications_user_unread_idx
  on public.notifications(user_id, is_read) where is_read = false;

alter table public.notifications enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='notifications' and policyname='notifications own read') then
    execute $p$create policy "notifications own read" on public.notifications
      for select using (user_id = auth.uid())$p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='notifications' and policyname='notifications own update') then
    execute $p$create policy "notifications own update" on public.notifications
      for update using (user_id = auth.uid()) with check (user_id = auth.uid())$p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='notifications' and policyname='notifications auth insert') then
    execute $p$create policy "notifications auth insert" on public.notifications
      for insert with check (user_id = auth.uid())$p$;
  end if;
end $$;

-- ── 7. TABLA activity_log ─────────────────────────────────────────────────
create table if not exists public.activity_log (
  id          uuid        primary key default gen_random_uuid(),
  group_id    uuid        references public.groups(id) on delete cascade,
  actor_id    uuid        not null references public.profiles(id),
  action_type text        not null,
  data        jsonb,
  created_at  timestamptz not null default now()
);

create index if not exists activity_log_group_idx
  on public.activity_log(group_id, created_at desc);

alter table public.activity_log enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='activity_log' and policyname='activity group member read') then
    execute $p$create policy "activity group member read" on public.activity_log
      for select using (
        (group_id is null and actor_id = auth.uid())
        or (group_id is not null and public.is_group_member(group_id))
      )$p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='activity_log' and policyname='activity auth insert') then
    execute $p$create policy "activity auth insert" on public.activity_log
      for insert with check (actor_id = auth.uid())$p$;
  end if;
end $$;

-- ── 8. TABLA recurring_expenses ───────────────────────────────────────────
create table if not exists public.recurring_expenses (
  id          uuid                 primary key default gen_random_uuid(),
  user_id     uuid                 not null references public.profiles(id) on delete cascade,
  group_id    uuid                 references public.groups(id) on delete cascade,
  title       text                 not null,
  amount      numeric(14,2)        not null check (amount > 0),
  category_id uuid                 references public.categories(id) on delete set null,
  frequency   recurrence_frequency not null default 'monthly',
  start_date  date                 not null,
  next_due    date                 not null,
  paid_by     uuid                 references public.profiles(id),
  split_mode  split_mode           not null default 'equal',
  is_active   boolean              not null default true,
  created_at  timestamptz          not null default now()
);

create index if not exists recurring_expenses_user_idx
  on public.recurring_expenses(user_id, is_active);

alter table public.recurring_expenses enable row level security;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='recurring_expenses' and policyname='recurring own or group read') then
    execute $p$create policy "recurring own or group read" on public.recurring_expenses
      for select using (
        user_id = auth.uid()
        or (group_id is not null and public.is_group_member(group_id))
      )$p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='recurring_expenses' and policyname='recurring own create') then
    execute $p$create policy "recurring own create" on public.recurring_expenses
      for insert with check (
        user_id = auth.uid()
        and (group_id is null or public.is_group_member(group_id))
      )$p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='recurring_expenses' and policyname='recurring own update') then
    execute $p$create policy "recurring own update" on public.recurring_expenses
      for update using (
        user_id = auth.uid()
        or (group_id is not null and public.is_group_owner(group_id))
      ) with check (true)$p$;
  end if;
end $$;

do $$ begin
  if not exists (select 1 from pg_policies where tablename='recurring_expenses' and policyname='recurring own delete') then
    execute $p$create policy "recurring own delete" on public.recurring_expenses
      for delete using (
        user_id = auth.uid()
        or (group_id is not null and public.is_group_owner(group_id))
      )$p$;
  end if;
end $$;

-- ── 9. RPCs de invitaciones ───────────────────────────────────────────────
create or replace function public.create_group_invitation(
  target_group_id uuid,
  target_email    text
)
returns public.group_invitations
language plpgsql security definer set search_path = public as $$
declare
  new_invitation public.group_invitations;
begin
  if not public.is_group_owner(target_group_id) then
    raise exception 'Solo owners pueden invitar miembros';
  end if;

  if exists (
    select 1 from public.group_members gm
    join public.profiles p on p.id = gm.user_id
    where gm.group_id = target_group_id
      and lower(p.email) = lower(target_email)
  ) then
    raise exception 'Este usuario ya es miembro del grupo';
  end if;

  update public.group_invitations
  set status = 'cancelled', responded_at = now()
  where group_id = target_group_id
    and lower(invitee_email) = lower(target_email)
    and status = 'pending';

  insert into public.group_invitations (group_id, inviter_id, invitee_email, status)
  values (target_group_id, auth.uid(), lower(target_email), 'pending')
  returning * into new_invitation;

  return new_invitation;
end;
$$;

create or replace function public.accept_group_invitation(invitation_id uuid)
returns public.group_members
language plpgsql security definer set search_path = public as $$
declare
  inv            public.group_invitations;
  current_email  text;
  member         public.group_members;
begin
  select * into inv
  from public.group_invitations
  where id = invitation_id and status = 'pending';

  if inv.id is null then
    raise exception 'Invitacion no encontrada o ya procesada';
  end if;

  select email into current_email from public.profiles where id = auth.uid();

  if lower(current_email) <> lower(inv.invitee_email) then
    raise exception 'Esta invitacion no es para tu cuenta';
  end if;

  update public.group_invitations
  set status = 'accepted', responded_at = now()
  where id = invitation_id;

  insert into public.group_members (group_id, user_id, role)
  values (inv.group_id, auth.uid(), 'member')
  on conflict (group_id, user_id) do update set role = public.group_members.role
  returning * into member;

  return member;
end;
$$;

create or replace function public.decline_group_invitation(invitation_id uuid)
returns void
language plpgsql security definer set search_path = public as $$
declare
  inv           public.group_invitations;
  current_email text;
begin
  select * into inv
  from public.group_invitations
  where id = invitation_id and status = 'pending';

  if inv.id is null then
    raise exception 'Invitacion no encontrada o ya procesada';
  end if;

  select email into current_email from public.profiles where id = auth.uid();

  if lower(current_email) <> lower(inv.invitee_email) then
    raise exception 'Esta invitacion no es para tu cuenta';
  end if;

  update public.group_invitations
  set status = 'declined', responded_at = now()
  where id = invitation_id;
end;
$$;

-- ── 10. CATEGORÍAS del sistema (si no existen) ────────────────────────────
insert into public.categories (user_id, name, color) values
  (null, 'Comida',     '#0f9f6e'),
  (null, 'Casa',       '#2563eb'),
  (null, 'Transporte', '#0891b2'),
  (null, 'Salidas',    '#d97706'),
  (null, 'Salud',      '#dc2626'),
  (null, 'Sueldo',     '#16a34a'),
  (null, 'Viajes',     '#7c3aed')
on conflict do nothing;

-- ── 11. VERIFICACIÓN FINAL ────────────────────────────────────────────────
select
  t.table_name,
  case when t.table_name in (
    select tablename from pg_policies
  ) then 'RLS OK' else 'SIN POLITICAS' end as rls_status
from information_schema.tables t
where t.table_schema = 'public'
  and t.table_name in (
    'profiles','categories','groups','group_members','transactions',
    'shared_expenses','shared_expense_splits','installment_plans',
    'installments','payments','group_invitations','notifications',
    'activity_log','recurring_expenses'
  )
order by t.table_name;
