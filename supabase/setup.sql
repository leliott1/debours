-- ============================================================
--  Débours — Base Supabase (format tableau de frais / compta)
-- ------------------------------------------------------------
--  À exécuter dans Supabase : SQL Editor → New query → Run.
--  ⚠️ Ce script REMPLACE la table (à lancer une fois pour
--     passer au nouveau format). La table était vide, donc
--     aucune donnée n'est perdue.
-- ============================================================

drop table if exists public.depenses cascade;

create table public.depenses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null default auth.uid() references auth.users (id) on delete cascade,
  date         date not null,
  fournisseur  text,                 -- LIBELLE FOURNISSEUR (SNCF, RATP…)
  chantier     text,                 -- colonne "chantier"
  categorie    text not null default 'divers'
               check (categorie in ('train_sncf','peage','carburant','fournitures','divers')),
  montant_ttc  numeric(12,2) not null check (montant_ttc >= 0),  -- TOTAL payé
  tva          numeric(12,2) not null default 0 check (tva >= 0),
  justificatif_url text,             -- photo du ticket (Partie 2)
  created_at   timestamptz not null default now()
);
-- Le montant HT (colonne du tableau) = montant_ttc - tva, calculé dans l'app.

create index depenses_user_id_idx on public.depenses (user_id);

alter table public.depenses enable row level security;

create policy "lecture"      on public.depenses for select using (auth.uid() = user_id);
create policy "ajout"        on public.depenses for insert with check (auth.uid() = user_id);
create policy "modification" on public.depenses for update using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "suppression"  on public.depenses for delete using (auth.uid() = user_id);
