alter table public.groups enable row level security;
alter table public.group_members enable row level security;

drop policy if exists "groups authenticated create" on public.groups;
drop policy if exists "groups members read" on public.groups;
drop policy if exists "groups creators and members read" on public.groups;
drop policy if exists "members owners insert" on public.group_members;
drop policy if exists "members insert" on public.group_members;
drop policy if exists "members creator owner insert" on public.group_members;

create policy "groups authenticated create" on public.groups
for insert
with check (
  auth.uid() is not null
  and created_by = auth.uid()
);

create policy "groups creators and members read" on public.groups
for select
using (
  created_by = auth.uid()
  or public.is_group_member(id)
);

create policy "members creator owner insert" on public.group_members
for insert
with check (
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
