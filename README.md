# Débours — Notes de frais 💳

Petite **web app (PWA)** pour gérer tes notes de frais / débours, dans l'esprit de Lucca Cleemy.
Tes dépenses sont **synchronisées entre tous tes appareils** (iPhone, ordi…) grâce à Supabase.

- 📱 Installable sur l'écran d'accueil de l'iPhone (plein écran, fonctionne hors-ligne)
- 🔐 Connexion par email / mot de passe
- ➕ Ajouter / modifier / supprimer une dépense (montant, date, catégorie, statut)
- 📊 Totaux : total, à valider, remboursé
- 🔎 Filtres par statut et par catégorie

---

## 🚀 Mise en route (3 étapes)

### 1. Créer un projet Supabase (gratuit)

1. Va sur [supabase.com](https://supabase.com) → **Start your project** → connecte-toi (GitHub ou email).
2. Clique **New project**, donne-lui un nom (ex. `debours`), choisis un mot de passe de base de données et une région proche (ex. *West EU*). Attends ~1 min que le projet se crée.
3. Crée la table : menu **SQL Editor** → **New query** → colle tout le contenu du fichier
   [`supabase/setup.sql`](supabase/setup.sql) → **Run**.
4. Récupère tes clés : menu **Project Settings → API**. Note :
   - **Project URL** (ex. `https://abcd1234.supabase.co`)
   - **anon public** key (la clé publique — *pas* la `service_role`).

> Par défaut Supabase peut demander une **confirmation par email** à l'inscription.
> Pour aller plus vite en usage perso : **Authentication → Sign In / Providers → Email**,
> et désactive « Confirm email ».

### 2. Renseigner tes clés dans l'app

Ouvre [`js/config.js`](js/config.js) et remplace les deux valeurs :

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://abcd1234.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOi....", // ta clé anon public
};
```

> Ces clés sont **publiques** : la sécurité est assurée par les règles RLS de la base
> (chaque utilisateur ne voit que ses propres dépenses).

### 3. Mettre en ligne (GitHub Pages, gratuit)

1. Pousse le code sur GitHub (déjà fait sur la branche de travail).
2. Sur GitHub : **Settings → Pages → Build and deployment → Source = Deploy from a branch**,
   branche `main` (ou ta branche), dossier `/ (root)` → **Save**.
3. Au bout d'une minute, ton appli est en ligne à l'adresse indiquée
   (`https://<ton-pseudo>.github.io/debours/`).

#### Installer sur l'iPhone
Ouvre l'adresse dans **Safari** → bouton **Partager** → **Sur l'écran d'accueil**.
L'appli s'ouvre alors en plein écran comme une vraie application.

---

## 🧪 Tester en local

Comme l'app charge des modules via le réseau, sers-la avec un petit serveur :

```bash
python3 -m http.server 8000
# puis ouvre http://localhost:8000
```

---

## 📁 Structure

```
index.html              Page principale
css/styles.css          Styles
js/config.js            ⚙️ Tes clés Supabase (à remplir)
js/app.js               Logique (auth + CRUD + rendu)
manifest.webmanifest    Métadonnées PWA
service-worker.js       Cache hors-ligne / installation
icons/                  Icônes de l'app (+ générateur Python)
supabase/setup.sql      Script de création de la base
```

## 🔜 Idées pour la suite
- Photo du justificatif (Supabase Storage)
- Export CSV / PDF d'une note de frais
- Regroupement par mois
- Multi-devises
