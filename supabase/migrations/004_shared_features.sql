-- ══════════════════════════════════════════════
-- 004_shared_features.sql
-- Group invitations, notifications, activity log, recurring expenses
-- ══════════════════════════════════════════════

-- ── Enums ────────────────────────────────────
create type invitation_status   as enum ('pending', 'accepted', 'declined', 'cancelled');
create type notification_type   as enum ('invitation', 'payment', 'overdue', 'group_event');
create type recurrence_frequency as enum ('weekly', 'biweekly', 'monthly', 'annual');

-- ── group_invitations ────────────────────────
create table public.group_invitations (
  id             uuid          primary key default gen_random_uuid(),
  group_id       uuid          not null references public.groups(id) on delete cascade,
  inviter_id     uuid          not null references public.profiles(id),
  invitee_email  text          not null,
  status         invitation_status not null default 'pending',
  created_at     timestamptz   not null default now(),
  responded_at   timestamptz
);

create index group_invitations_group_idx  on public.group_invitations(group_id);
create index group_invitations_email_idx  on public.group_invitations(lower(invitee_email));
create index group_invitations_status_idx on public.group_invitations(status);

-- ── notifications ─────────────────────────────
create table public.notifications (
  id         uuid              primary key default gen_random_uuid(),
  user_id    uuid              not null references public.profiles(id) on delete cascade,
  type       notification_type not null,
  title      text              not null,
  body       text,
  data       jsonb,
  is_read    boolean           not null default false,
  created_at timestamptz       not null default now()
);

create index notifications_user_unread_idx on public.notifications(user_id, is_read)
  where is_read = false;

-- ── activity_log ──────────────────────────────
create table public.activity_log (
  id          uuid        primary key default gen_random_uuid(),
  group_id    uuid        references public.groups(id) on delete cascade,
  actor_id    uuid        not null references public.profiles(id),
  action_type text        not null,
  data        jsonb,
  created_at  timestamptz not null default now()
);

create index activity_log_group_idx on public.activity_log(group_id, created_at desc);

-- ── recurring_expenses ────────────────────────
create table public.recurring_expenses (
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

create index recurring_expenses_user_idx on public.recurring_expenses(user_id, is_active);

-- ══════════════════════════════════════════════
-- RLS
-- ══════════════════════════════════════════════
alter table public.group_invitations  enable row level security;
alter table public.notifications      enable row level security;
alter table public.activity_log       enable row level security;
alter table public.recurring_expenses enable row level security;

-- group_invitations: owners read all for their groups; invitees read their own
create policy "invitations owner read" on public.group_invitations
  for select using (
    public.is_group_owner(group_id)
    or lower(invitee_email) = lower((select email from public.profiles where id = auth.uid()))
  );

create policy "invitations owner create" on public.group_invitations
  for insert with check (public.is_group_owner(group_id) and inviter_id = auth.uid());

create policy "invitations update owner or invitee" on public.group_invitations
  for update using (
    public.is_group_owner(group_id)
    or lower(invitee_email) = lower((select email from public.profiles where id = auth.uid()))
  ) with check (true);

-- notifications: own only
create policy "notifications own read" on public.notifications
  for select using (user_id = auth.uid());

create policy "notifications own update" on public.notifications
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "notifications auth insert" on public.notifications
  for insert with check (user_id = auth.uid());

-- activity_log: group members read; authenticated actors insert
create policy "activity group member read" on public.activity_log
  for select using (
    (group_id is null and actor_id = auth.uid())
    or (group_id is not null and public.is_group_member(group_id))
  );

create policy "activity auth insert" on public.activity_log
  for insert with check (actor_id = auth.uid());

-- recurring_expenses: own or group member
create policy "recurring own or group read" on public.recurring_expenses
  for select using (
    user_id = auth.uid()
    or (group_id is not null and public.is_group_member(group_id))
  );

create policy "recurring own create" on public.recurring_expenses
  for insert with check (
    user_id = auth.uid()
    and (group_id is null or public.is_group_member(group_id))
  );

create policy "recurring own update" on public.recurring_expenses
  for update using (
    user_id = auth.uid()
    or (group_id is not null and public.is_group_owner(group_id))
  ) with check (true);

create policy "recurring own delete" on public.recurring_expenses
  for delete using (
    user_id = auth.uid()
    or (group_id is not null and public.is_group_owner(group_id))
  );

-- ══════════════════════════════════════════════
-- RPC: create_group_invitation
-- ══════════════════════════════════════════════
create or replace function public.create_group_invitation(
  target_group_id uuid,
  target_email    text
)
returns public.group_invitations
language plpgsql
security definer
set search_path = public
as $$
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

  -- Cancel any existing pending invitation for this email+group
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

-- ══════════════════════════════════════════════
-- RPC: accept_group_invitation
-- ══════════════════════════════════════════════
create or replace function public.accept_group_invitation(invitation_id uuid)
returns public.group_members
language plpgsql
security definer
set search_path = public
as $$
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

  select email into current_email
  from public.profiles where id = auth.uid();

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

-- ══════════════════════════════════════════════
-- RPC: decline_group_invitation
-- ══════════════════════════════════════════════
create or replace function public.decline_group_invitation(invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
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

  select email into current_email
  from public.profiles where id = auth.uid();

  if lower(current_email) <> lower(inv.invitee_email) then
    raise exception 'Esta invitacion no es para tu cuenta';
  end if;

  update public.group_invitations
  set status = 'declined', responded_at = now()
  where id = invitation_id;
end;
$$;
