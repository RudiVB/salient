-- ============================================================================
-- WORLD CONQUEST · 1916 — Multiplayer (PvP) schema for Supabase
-- ----------------------------------------------------------------------------
-- Async model: a player submits an army snapshot to a queue. Matchmaking pairs
-- two queued players, the battle is resolved (deterministically from both army
-- snapshots + a shared seed), and the result is stored. Both clients replay the
-- same BattleScene from the seed so they see an identical fight.
--
-- Run this in the Supabase SQL editor. Adjust RLS to taste.
-- ============================================================================

-- 1) COMMANDER PROFILES ------------------------------------------------------
create table if not exists public.commanders (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default 'Commander',
  nation      text,
  rank_index  int  not null default 0,
  wins        int  not null default 0,
  losses      int  not null default 0,
  rating      int  not null default 1000,           -- simple Elo-style ladder
  created_at  timestamptz not null default now()
);

-- 2) MATCHMAKING QUEUE -------------------------------------------------------
-- A player drops an army snapshot here to look for a fight.
create table if not exists public.mm_queue (
  id          uuid primary key default gen_random_uuid(),
  player_id   uuid not null references public.commanders(id) on delete cascade,
  army        jsonb not null,                         -- [{defId, troops, vet}]
  power       int  not null,
  created_at  timestamptz not null default now(),
  unique (player_id)
);

-- 3) MATCHES -----------------------------------------------------------------
create table if not exists public.matches (
  id          uuid primary key default gen_random_uuid(),
  seed        bigint not null,                        -- shared RNG seed for replay
  a_id        uuid not null references public.commanders(id),
  b_id        uuid not null references public.commanders(id),
  a_army      jsonb not null,
  b_army      jsonb not null,
  a_power     int not null,
  b_power     int not null,
  winner      char(1),                                -- 'A' | 'B' | null (pending)
  status      text not null default 'resolved',       -- 'pending' | 'resolved'
  created_at  timestamptz not null default now()
);
create index if not exists matches_a_idx on public.matches (a_id, created_at desc);
create index if not exists matches_b_idx on public.matches (b_id, created_at desc);

-- 4) MATCHMAKING RPC ---------------------------------------------------------
-- Call find_match(army jsonb, power int). If an opponent is queued, it pops
-- them, resolves the fight, writes a row to matches, and returns it. Otherwise
-- it enqueues the caller and returns null (poll matches for your result later).
create or replace function public.find_match(p_army jsonb, p_power int)
returns public.matches
language plpgsql security definer as $$
declare
  me uuid := auth.uid();
  opp record;
  m public.matches;
  s bigint := (floor(random() * 9.2e18))::bigint;
  -- deterministic-ish outcome: power + seed jitter
  a_roll float; b_roll float; win char(1);
begin
  -- find someone else waiting (oldest first)
  select * into opp from public.mm_queue
   where player_id <> me order by created_at asc limit 1 for update skip locked;

  if opp.player_id is null then
    insert into public.mm_queue (player_id, army, power)
      values (me, p_army, p_power)
      on conflict (player_id) do update set army = excluded.army, power = excluded.power, created_at = now();
    return null;  -- waiting; client polls matches
  end if;

  delete from public.mm_queue where player_id = opp.player_id;
  delete from public.mm_queue where player_id = me;

  a_roll := p_power     * (0.8 + (s % 1000) / 2000.0);
  b_roll := opp.power   * (0.8 + ((s / 1000) % 1000) / 2000.0);
  win := case when a_roll >= b_roll then 'A' else 'B' end;

  insert into public.matches (seed, a_id, b_id, a_army, b_army, a_power, b_power, winner, status)
    values (s, me, opp.player_id, p_army, opp.army, p_power, opp.power, win, 'resolved')
    returning * into m;

  -- update ladders
  update public.commanders set wins = wins + (win='A')::int, losses = losses + (win<>'A')::int,
         rating = rating + case when win='A' then 12 else -10 end where id = me;
  update public.commanders set wins = wins + (win='B')::int, losses = losses + (win<>'B')::int,
         rating = rating + case when win='B' then 12 else -10 end where id = opp.player_id;

  return m;
end $$;

-- 5) LEADERBOARD VIEW --------------------------------------------------------
create or replace view public.leaderboard as
  select id, name, nation, rating, wins, losses
  from public.commanders order by rating desc limit 100;

-- 6) ROW LEVEL SECURITY ------------------------------------------------------
alter table public.commanders enable row level security;
alter table public.mm_queue   enable row level security;
alter table public.matches    enable row level security;

create policy "read commanders"  on public.commanders for select using (true);
create policy "self commander"   on public.commanders for all using (auth.uid() = id) with check (auth.uid() = id);
create policy "self queue"       on public.mm_queue   for all using (auth.uid() = player_id) with check (auth.uid() = player_id);
create policy "read own matches" on public.matches    for select using (auth.uid() = a_id or auth.uid() = b_id);

-- ============================================================================
-- CLIENT INTEGRATION (Next.js + @supabase/supabase-js)
-- 1) npm i @supabase/supabase-js
-- 2) NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY in Vercel env.
-- 3) On "Find match": const { data } = await supabase.rpc('find_match', { p_army, p_power })
--      - data === null  -> you're queued; subscribe to matches (realtime) for your row
--      - data !== null  -> opponent found; replay BattleScene with seed=data.seed,
--                          player=your army, enemy=data.b_army, won=(data.winner==='A')
-- 4) Realtime: supabase.channel('mm').on('postgres_changes',
--      { event:'INSERT', schema:'public', table:'matches', filter:`b_id=eq.${myId}` }, cb)
-- ============================================================================
