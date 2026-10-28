-- StudyForge AI schema
-- Run this entire script in Supabase Dashboard -> SQL Editor -> New query.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text not null default '',
  avatar text not null default '🦊',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
drop policy if exists "Users can read their own profile" on public.profiles;
create policy "Users can read their own profile" on public.profiles for select using (auth.uid() = id);
drop policy if exists "Users can insert their own profile" on public.profiles;
create policy "Users can insert their own profile" on public.profiles for insert with check (auth.uid() = id);
drop policy if exists "Users can update their own profile" on public.profiles;
create policy "Users can update their own profile" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);

create table if not exists public.study_kits (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  topic text not null,
  marks integer not null check (marks in (2,5,11)),
  questions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.study_kits enable row level security;
drop policy if exists "Users manage their own study kits" on public.study_kits;
create policy "Users manage their own study kits" on public.study_kits for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create table if not exists public.study_progress (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  activity_type text not null,
  activity_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.study_progress enable row level security;
drop policy if exists "Users manage their own progress" on public.study_progress;
create policy "Users manage their own progress" on public.study_progress for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- Shared-room schema for the next StudySync integration step.
create table if not exists public.study_rooms (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  invite_code text not null unique default upper(substr(encode(gen_random_bytes(6),'hex'),1,8)),
  description text not null default '',
  subject text not null default 'General',
  notes text not null default '',
  tasks jsonb not null default '[]'::jsonb,
  polls jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.study_rooms add column if not exists subject text not null default 'General';
alter table public.study_rooms add column if not exists notes text not null default '';
alter table public.study_rooms add column if not exists tasks jsonb not null default '[]'::jsonb;
alter table public.study_rooms add column if not exists polls jsonb not null default '[]'::jsonb;

create table if not exists public.study_room_members (
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'member' check (role in ('owner','member')),
  joined_at timestamptz not null default now(),
  primary key (room_id,user_id)
);
create table if not exists public.study_room_messages (
  id uuid primary key default gen_random_uuid(),
  room_id uuid not null references public.study_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null check (char_length(message) between 1 and 4000),
  created_at timestamptz not null default now()
);
alter table public.study_rooms enable row level security;
alter table public.study_room_members enable row level security;
alter table public.study_room_messages enable row level security;
drop policy if exists "Members can view rooms" on public.study_rooms;
create policy "Members can view rooms" on public.study_rooms for select using (
  owner_id = auth.uid() or exists (select 1 from public.study_room_members m where m.room_id = id and m.user_id = auth.uid())
);
drop policy if exists "Authenticated users can create rooms" on public.study_rooms;
create policy "Authenticated users can create rooms" on public.study_rooms for insert with check (auth.uid() = owner_id);
drop policy if exists "Owners can update rooms" on public.study_rooms;
create policy "Owners can update rooms" on public.study_rooms for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "Members can view room memberships" on public.study_room_members;
create policy "Members can view room memberships" on public.study_room_members for select using (
  user_id = auth.uid() or exists (select 1 from public.study_rooms r where r.id = room_id and r.owner_id = auth.uid())
);
drop policy if exists "Users can join themselves" on public.study_room_members;
create policy "Users can join themselves" on public.study_room_members for insert with check (user_id = auth.uid());
drop policy if exists "Members can read room messages" on public.study_room_messages;
create policy "Members can read room messages" on public.study_room_messages for select using (
  exists (select 1 from public.study_room_members m where m.room_id = study_room_messages.room_id and m.user_id = auth.uid())
);
drop policy if exists "Members can send room messages" on public.study_room_messages;
create policy "Members can send room messages" on public.study_room_messages for insert with check (
  user_id = auth.uid() and exists (select 1 from public.study_room_members m where m.room_id = study_room_messages.room_id and m.user_id = auth.uid())
);

-- Securely join a room by invite code without exposing the room list to unauthenticated users.
create or replace function public.join_room_by_code(p_invite_code text)
returns table(id uuid, name text, subject text, invite_code text, description text, notes text, tasks jsonb, polls jsonb)
language plpgsql security definer set search_path = public as $$
declare target public.study_rooms%rowtype;
begin
  if auth.uid() is null then raise exception 'You must be signed in to join a room.'; end if;
  select * into target from public.study_rooms r where upper(r.invite_code) = upper(trim(p_invite_code)) limit 1;
  if target.id is null then raise exception 'No room found for that invite code.'; end if;
  insert into public.study_room_members(room_id,user_id,role)
  values (target.id,auth.uid(),case when target.owner_id=auth.uid() then 'owner' else 'member' end)
  on conflict (room_id,user_id) do nothing;
  return query select target.id,target.name,target.subject,target.invite_code,target.description,target.notes,target.tasks,target.polls;
end;
$$;
grant execute on function public.join_room_by_code(text) to authenticated;

-- Automatically create a profile when an auth user signs up.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, email, avatar)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name',''), coalesce(new.email,''), coalesce(new.raw_user_meta_data->>'avatar','🦊'))
  on conflict (id) do update set email = excluded.email;
  return new;
end;
$$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
