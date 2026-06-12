-- Oleary Ave Poker Bets - Supabase v2 schema
-- Paste this into Supabase SQL Editor and run it once for the project.

create extension if not exists pgcrypto;

do $$ begin
  create type public.market_status as enum ('draft', 'open', 'locked', 'resolved', 'voided');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.market_type as enum ('single', 'multi_pick', 'combo', 'bonus');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.payout_mode as enum ('pool', 'pool_multiplier', 'fixed_bonus', 'host_defined');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.player_status as enum ('pending', 'approved', 'blocked');
exception when duplicate_object then null;
end $$;

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  title text not null default 'Poker Session',
  join_code text not null unique,
  default_player_points numeric not null default 100 check (default_player_points >= 0),
  host_pin text,
  is_active boolean not null default true,
  joining_enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.sessions
  add column if not exists joining_enabled boolean not null default true;

create table if not exists public.players (
  id uuid primary key default gen_random_uuid(),
  client_id text,
  session_id uuid not null references public.sessions(id) on delete cascade,
  display_name text not null,
  device_id text,
  status public.player_status not null default 'approved',
  starting_points numeric not null default 100 check (starting_points >= 0),
  points numeric not null default 100,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists players_one_device_per_session
  on public.players(session_id, device_id)
  where device_id is not null;

create unique index if not exists players_one_name_per_session
  on public.players(session_id, lower(display_name));

create unique index if not exists players_one_client_id_per_session
  on public.players(session_id, client_id)
  where client_id is not null;

create table if not exists public.markets (
  id uuid primary key default gen_random_uuid(),
  client_id text,
  session_id uuid not null references public.sessions(id) on delete cascade,
  title text not null,
  status public.market_status not null default 'draft',
  market_type public.market_type not null default 'single',
  payout_mode public.payout_mode not null default 'pool',
  payout_multiplier numeric not null default 1 check (payout_multiplier > 0),
  tax_rate numeric not null default 0.1 check (tax_rate >= 0 and tax_rate < 1),
  bonus_points numeric not null default 0 check (bonus_points >= 0),
  bonus_label text,
  winning_outcome_id uuid,
  winning_selection jsonb,
  created_at timestamptz not null default now(),
  locked_at timestamptz,
  resolved_at timestamptz,
  voided_at timestamptz
);

create index if not exists markets_session_status_idx
  on public.markets(session_id, status, created_at desc);

create unique index if not exists markets_one_client_id_per_session
  on public.markets(session_id, client_id)
  where client_id is not null;

create table if not exists public.outcomes (
  id uuid primary key default gen_random_uuid(),
  client_id text,
  market_id uuid not null references public.markets(id) on delete cascade,
  label text not null,
  created_by_player_id uuid references public.players(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists outcomes_one_label_per_market
  on public.outcomes(market_id, lower(label));

create unique index if not exists outcomes_one_client_id_per_market
  on public.outcomes(market_id, client_id)
  where client_id is not null;

alter table public.markets
  drop constraint if exists markets_winning_outcome_id_fkey;

alter table public.markets
  add constraint markets_winning_outcome_id_fkey
  foreign key (winning_outcome_id) references public.outcomes(id) on delete set null;

create table if not exists public.bets (
  id uuid primary key default gen_random_uuid(),
  client_id text,
  market_id uuid not null references public.markets(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  outcome_id uuid references public.outcomes(id) on delete restrict,
  stake numeric not null check (stake > 0),
  selections jsonb not null default '[]'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Players can place multiple active bets per market.
drop index if exists bets_one_active_bet_per_player_market;

create unique index if not exists bets_one_client_id_per_market
  on public.bets(market_id, client_id)
  where client_id is not null;

create index if not exists bets_market_idx on public.bets(market_id);
create index if not exists bets_player_idx on public.bets(player_id);

create table if not exists public.adjustments (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  amount numeric not null,
  label text,
  created_by text not null default 'host',
  created_at timestamptz not null default now()
);

create table if not exists public.payouts (
  id uuid primary key default gen_random_uuid(),
  market_id uuid not null references public.markets(id) on delete cascade,
  player_id uuid not null references public.players(id) on delete cascade,
  amount numeric not null check (amount >= 0),
  created_at timestamptz not null default now()
);

create unique index if not exists payouts_one_per_player_market
  on public.payouts(market_id, player_id);

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists sessions_touch_updated_at on public.sessions;
create trigger sessions_touch_updated_at
before update on public.sessions
for each row execute function public.touch_updated_at();

drop trigger if exists players_touch_updated_at on public.players;
create trigger players_touch_updated_at
before update on public.players
for each row execute function public.touch_updated_at();

drop trigger if exists bets_touch_updated_at on public.bets;
create trigger bets_touch_updated_at
before update on public.bets
for each row execute function public.touch_updated_at();

-- RLS is intentionally permissive for the first private prototype.
-- Once host/player auth is wired, tighten these into role/device-specific policies.
alter table public.sessions enable row level security;
alter table public.players enable row level security;
alter table public.markets enable row level security;
alter table public.outcomes enable row level security;
alter table public.bets enable row level security;
alter table public.adjustments enable row level security;
alter table public.payouts enable row level security;

drop policy if exists "prototype read sessions" on public.sessions;
create policy "prototype read sessions" on public.sessions for select using (true);
drop policy if exists "prototype write sessions" on public.sessions;
create policy "prototype write sessions" on public.sessions for all using (true) with check (true);

drop policy if exists "prototype read players" on public.players;
create policy "prototype read players" on public.players for select using (true);
drop policy if exists "prototype write players" on public.players;
create policy "prototype write players" on public.players for all using (true) with check (true);

drop policy if exists "prototype read markets" on public.markets;
create policy "prototype read markets" on public.markets for select using (true);
drop policy if exists "prototype write markets" on public.markets;
create policy "prototype write markets" on public.markets for all using (true) with check (true);

drop policy if exists "prototype read outcomes" on public.outcomes;
create policy "prototype read outcomes" on public.outcomes for select using (true);
drop policy if exists "prototype write outcomes" on public.outcomes;
create policy "prototype write outcomes" on public.outcomes for all using (true) with check (true);

drop policy if exists "prototype read bets" on public.bets;
create policy "prototype read bets" on public.bets for select using (true);
drop policy if exists "prototype write bets" on public.bets;
create policy "prototype write bets" on public.bets for all using (true) with check (true);

drop policy if exists "prototype read adjustments" on public.adjustments;
create policy "prototype read adjustments" on public.adjustments for select using (true);
drop policy if exists "prototype write adjustments" on public.adjustments;
create policy "prototype write adjustments" on public.adjustments for all using (true) with check (true);

drop policy if exists "prototype read payouts" on public.payouts;
create policy "prototype read payouts" on public.payouts for select using (true);
drop policy if exists "prototype write payouts" on public.payouts;
create policy "prototype write payouts" on public.payouts for all using (true) with check (true);
