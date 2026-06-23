-- Oleary Ave Poker Bets - persistent player accounts migration
-- Run this once if your Supabase project already has the earlier schema.

create extension if not exists pgcrypto;

alter table public.players
  add column if not exists username text,
  add column if not exists pin_hash text,
  add column if not exists last_login_at timestamptz,
  add column if not exists profile_image_url text,
  add column if not exists profile_banner_url text,
  add column if not exists profile_customization jsonb not null default '{}'::jsonb,
  add column if not exists badges text[] not null default '{}'::text[],
  add column if not exists achievements text[] not null default '{}'::text[],
  add column if not exists title text;

create unique index if not exists players_one_username
  on public.players(lower(username));

-- Fresh deployments should have username and pin_hash as required account fields.
-- If you have no existing players, these constraints are safe to apply.
alter table public.players
  alter column username set not null,
  alter column pin_hash set not null;

-- Account PIN security:
-- The browser sends the PIN to these Supabase functions over HTTPS.
-- Supabase stores only a pgcrypto crypt() hash in players.pin_hash.
-- Normal app queries return safe account fields and never select pin_hash.
create or replace function public.create_player_account(
  p_session_id uuid,
  p_username text,
  p_display_name text,
  p_pin text
)
returns table (
  id uuid,
  username text,
  display_name text,
  status public.player_status,
  starting_points numeric,
  points numeric,
  created_at timestamptz,
  last_login_at timestamptz,
  profile_image_url text,
  profile_banner_url text,
  profile_customization jsonb,
  badges text[],
  achievements text[],
  title text
)
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_username text := lower(trim(p_username));
  clean_display_name text := trim(p_display_name);
  initial_points numeric;
begin
  if normalized_username = '' or clean_display_name = '' then
    raise exception 'Username and display name are required' using errcode = '22023';
  end if;

  if p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'PIN must be numeric and 4-6 digits' using errcode = '22023';
  end if;

  if exists (select 1 from public.players where lower(players.username) = normalized_username) then
    raise exception 'Username already exists' using errcode = '23505';
  end if;

  select default_player_points into initial_points
  from public.sessions
  where sessions.id = p_session_id;

  if initial_points is null then
    raise exception 'Session not found' using errcode = '22023';
  end if;

  return query
  insert into public.players (
    session_id,
    username,
    display_name,
    pin_hash,
    status,
    starting_points,
    points,
    last_login_at
  )
  values (
    p_session_id,
    normalized_username,
    clean_display_name,
    crypt(p_pin, gen_salt('bf')),
    'approved',
    initial_points,
    initial_points,
    now()
  )
  returning
    players.id,
    players.username,
    players.display_name,
    players.status,
    players.starting_points,
    players.points,
    players.created_at,
    players.last_login_at,
    players.profile_image_url,
    players.profile_banner_url,
    players.profile_customization,
    players.badges,
    players.achievements,
    players.title;
end;
$$;

create or replace function public.login_player_account(
  p_username text,
  p_pin text
)
returns table (
  id uuid,
  username text,
  display_name text,
  status public.player_status,
  starting_points numeric,
  points numeric,
  created_at timestamptz,
  last_login_at timestamptz,
  profile_image_url text,
  profile_banner_url text,
  profile_customization jsonb,
  badges text[],
  achievements text[],
  title text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if lower(trim(p_username)) = '' or p_pin !~ '^[0-9]{4,6}$' then
    raise exception 'Incorrect username or PIN' using errcode = '28000';
  end if;

  return query
  update public.players
  set last_login_at = now()
  where lower(players.username) = lower(trim(p_username))
    and players.pin_hash = crypt(p_pin, players.pin_hash)
  returning
    players.id,
    players.username,
    players.display_name,
    players.status,
    players.starting_points,
    players.points,
    players.created_at,
    players.last_login_at,
    players.profile_image_url,
    players.profile_banner_url,
    players.profile_customization,
    players.badges,
    players.achievements,
    players.title;

  if not found then
    raise exception 'Incorrect username or PIN' using errcode = '28000';
  end if;
end;
$$;
