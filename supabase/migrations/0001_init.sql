-- ============================================================================
-- OpenField — initial Supabase schema
-- Run this in the Supabase SQL editor (or via `supabase db push`).
--
-- Tables:
--   profiles        1:1 with auth.users (display name, avatar, plan)
--   projects        cloud-saved editor projects (JSON document + metadata)
--   assets          uploaded media metadata (files live in Storage bucket)
--   analytics_events app usage events
--   feedback        user feedback submissions
--
-- Security: Row-Level Security is enabled on every table. Users can only
-- read/write their own rows. Feedback + analytics allow anonymous inserts.
-- ============================================================================

-- ── Extensions ──────────────────────────────────────────────────────────────
create extension if not exists "pgcrypto";

-- ── profiles ────────────────────────────────────────────────────────────────
create table if not exists public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  email       text,
  display_name text,
  avatar_url  text,
  plan        text not null default 'free',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

drop policy if exists "profiles_insert_own" on public.profiles;
create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

-- Auto-create a profile row whenever a new auth user signs up.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'display_name', split_part(new.email, '@', 1))
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── projects ────────────────────────────────────────────────────────────────
create table if not exists public.projects (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references auth.users (id) on delete cascade,
  name        text not null default 'Untitled Project',
  -- Full serialized editor project document (blobs/handles stripped client-side)
  document    jsonb not null default '{}'::jsonb,
  thumbnail_url text,
  duration    real not null default 0,
  width       integer not null default 1920,
  height      integer not null default 1080,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists projects_owner_updated_idx
  on public.projects (owner_id, updated_at desc);

alter table public.projects enable row level security;

drop policy if exists "projects_owner_all" on public.projects;
create policy "projects_owner_all"
  on public.projects for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ── assets ──────────────────────────────────────────────────────────────────
create table if not exists public.assets (
  id           uuid primary key default gen_random_uuid(),
  owner_id     uuid not null references auth.users (id) on delete cascade,
  project_id   uuid references public.projects (id) on delete set null,
  name         text not null,
  storage_path text not null,       -- path inside the 'assets' storage bucket
  mime_type    text,
  size_bytes   bigint,
  kind         text,                -- 'video' | 'audio' | 'image' | ...
  created_at   timestamptz not null default now()
);

create index if not exists assets_owner_idx on public.assets (owner_id);

alter table public.assets enable row level security;

drop policy if exists "assets_owner_all" on public.assets;
create policy "assets_owner_all"
  on public.assets for all
  using (auth.uid() = owner_id)
  with check (auth.uid() = owner_id);

-- ── analytics_events ────────────────────────────────────────────────────────
create table if not exists public.analytics_events (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users (id) on delete set null,
  event       text not null,
  properties  jsonb not null default '{}'::jsonb,
  session_id  text,
  created_at  timestamptz not null default now()
);

create index if not exists analytics_event_time_idx
  on public.analytics_events (event, created_at desc);

alter table public.analytics_events enable row level security;

-- Anyone (incl. anonymous) may INSERT an event; nobody can read them back
-- from the client (reserved for server-side / dashboards).
drop policy if exists "analytics_insert_any" on public.analytics_events;
create policy "analytics_insert_any"
  on public.analytics_events for insert
  with check (true);

-- ── feedback ────────────────────────────────────────────────────────────────
create table if not exists public.feedback (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references auth.users (id) on delete set null,
  email       text,
  category    text not null default 'general',   -- 'bug' | 'idea' | 'general'
  rating      integer,                            -- optional 1-5
  message     text not null,
  page        text,                               -- route the user was on
  user_agent  text,
  created_at  timestamptz not null default now()
);

alter table public.feedback enable row level security;

-- Anyone may submit feedback; only the submitting user can read their own.
drop policy if exists "feedback_insert_any" on public.feedback;
create policy "feedback_insert_any"
  on public.feedback for insert
  with check (true);

drop policy if exists "feedback_select_own" on public.feedback;
create policy "feedback_select_own"
  on public.feedback for select
  using (auth.uid() = user_id);

-- ── storage bucket for uploaded assets ──────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('assets', 'assets', false)
on conflict (id) do nothing;

-- Users can manage only their own folder ({user_id}/...) inside the bucket.
drop policy if exists "assets_bucket_owner" on storage.objects;
create policy "assets_bucket_owner"
  on storage.objects for all
  using (
    bucket_id = 'assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'assets'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
