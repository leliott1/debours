-- ============================================================
--  Débours — Mise en place de la base Supabase
-- ------------------------------------------------------------
--  À exécuter UNE FOIS dans ton projet Supabase :
--  Dashboard → SQL Editor → New query → colle ce contenu → Run
-- ============================================================

-- Table des dépenses
create table if not exists public.depenses (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date        date not null,
  montant     numeric(12, 2) not null check (montant >= 0),
  categorie   text not null default 'autre',
  description text,
  statut      text not null default 'a_valider'
              check (statut in ('a_valider', 'valide', 'rembourse')),
  created_at  timestamptz not null default now()
);

create index if not exists depenses_user_id_idx on public.depenses (user_id);

-- Sécurité : chaque utilisateur ne voit et ne modifie QUE ses propres dépenses
alter table public.depenses enable row level security;

drop policy if exists "lecture de ses depenses"      on public.depenses;
drop policy if exists "ajout de ses depenses"        on public.depenses;
drop policy if exists "modification de ses depenses" on public.depenses;
drop policy if exists "suppression de ses depenses"  on public.depenses;

create policy "lecture de ses depenses"
  on public.depenses for select
  using (auth.uid() = user_id);

create policy "ajout de ses depenses"
  on public.depenses for insert
  with check (auth.uid() = user_id);

create policy "modification de ses depenses"
  on public.depenses for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "suppression de ses depenses"
  on public.depenses for delete
  using (auth.uid() = user_id);
