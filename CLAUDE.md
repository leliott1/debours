# Débours — Mémoire du projet

> Ce fichier sert de mémoire entre les sessions. Il résume le projet, les choix faits,
> l'état actuel et ce qu'il reste à faire. **À lire en premier au démarrage.**

## 🎯 Le projet en bref
Application web **PWA** de **frais de déplacement / notes de frais** pour **Eliott Layouni**,
salarié chez **Atelier Jean Loup Bouvier**. Objectif : saisir ses dépenses, les
**synchroniser entre iPhone et ordinateur**, et les **exporter en Excel au format exact
du tableau exigé par la compta de l'employeur**.

L'utilisateur est **non technique**, parle **français**, et configure souvent depuis un
**iPhone**. → Donner des instructions très simples, pas à pas. Faire un maximum à sa place.

## 🧱 Architecture
- **Front** : HTML/CSS/JS vanilla (aucun build). Chargé via CDN : `@supabase/supabase-js@2`, `xlsx@0.18.5`.
- **Données + auth** : **Supabase** (email/mot de passe, base Postgres, RLS).
- **Hébergement** : **GitHub Pages**, déployé depuis la branche `main`, dossier `/ (root)`.
- **PWA** : `manifest.webmanifest` + `service-worker.js` (cache `debours-v2`), installable iOS.

## 🔑 Infos clés (publiques — pas de secret ici)
- Dépôt GitHub : `leliott1/debours` — **public** (requis pour Pages gratuit).
- App en ligne : **https://leliott1.github.io/debours/** (bien garder le `/debours/` final).
- Supabase Project URL : `https://ffkdwiufoufyyclxqeew.supabase.co`
- Supabase clé publishable (publique, dans `js/config.js`) : `sb_publishable_fClICnBVCZxgAvKvzv8JTw_N0Zu9RLE`
- Infos export (dans `js/config.js`) : SOCIETE = "ATELIER JEAN LOUP BOUVIER, 9 RUE DU PONANT, 30133 LES ANGLES", SALARIE = "LAYOUNI ELIOTT".

### Vérifier la base rapidement
```bash
curl -s -w "\nHTTP %{http_code}\n" \
  "https://ffkdwiufoufyyclxqeew.supabase.co/rest/v1/depenses?select=id&limit=1" \
  -H "apikey: sb_publishable_fClICnBVCZxgAvKvzv8JTw_N0Zu9RLE" \
  -H "Authorization: Bearer sb_publishable_fClICnBVCZxgAvKvzv8JTw_N0Zu9RLE"
# 200 + [] = OK ;  404 PGRST205 = table absente
```

## 🗂️ Modèle de données (table `public.depenses`)
Voir `supabase/setup.sql`. Colonnes : `date`, `fournisseur`, `chantier`,
`categorie` ∈ {`train_sncf`,`peage`,`carburant`,`fournitures`,`divers`},
`montant_ttc`, `tva`, `justificatif_url` (pour Partie 2), `created_at`, `user_id`.
- **HT = montant_ttc − tva** (calculé dans l'app, pas stocké).
- RLS active : chaque user ne voit que ses lignes.
- Catégories = colonnes du tableau compta (Train SNCF / Péage HT / Carburant HT /
  Fournitures-Matériel chantier / Divers : RATP).

## ✅ Fait (Partie 1)
- Auth Supabase (création de compte + connexion par **email/mot de passe** uniquement —
  la connexion par lien magique a été retirée à la demande de l'utilisateur).
- **Récupération d'accès** : « Mot de passe oublié » (reset email) + écran « nouveau mot
  de passe » qui s'impose via le flag `inRecovery` (détecte `type=recovery` dans l'URL +
  event `PASSWORD_RECOVERY`) — sinon le lien connectait directement sans changer le mdp.
  ⚠️ Nécessite que la **URL Configuration** Supabase pointe vers l'app :
  Authentication → URL Configuration → Site URL = `https://leliott1.github.io/debours/`
  et Redirect URLs incluant `https://leliott1.github.io/debours/**`. (FAIT.)
- **Confirmation email DÉSACTIVÉE** (Auth → Providers → Email → « Confirm email » décoché,
  `mailer_autoconfirm=true`) : création de compte instantanée, pas d'email requis. C'est
  ce qui a débloqué l'auth (avant : compte « inactif » + plafond d'envoi d'emails atteint
  `over_email_send_rate_limit` à force de tester « mot de passe oublié »).
- Saisie d'une dépense au format compta (fournisseur, chantier, catégorie, TTC, TVA).
- Vue **par mois** (navigation ‹ ›) + totaux du mois.
- **Export `.xlsx`** reproduisant le tableau (en-tête société/salarié, ligne TOTAL).
  Totaux validés sur l'exemple réel = **306,00 €**.
- Déploiement GitHub Pages OK.

### ⚠️ Manip en attente côté utilisateur
Après le passage au format compta, la table a changé → il doit lancer **une fois** le
script `supabase/setup.sql` (drop + recreate) dans Supabase SQL Editor. Tant que ce
n'est pas fait, l'ajout de dépenses peut échouer (colonnes différentes).

## 🔜 À faire (Partie 2 — photo qui pré-remplit)
But : photographier un ticket → extraction auto (date, fournisseur, TTC, TVA, catégorie) → pré-remplir le formulaire (comme l'OCR de Cleemy, qui utilise Mindee/Deep Learning).

**Décision technique prise :**
- ❌ **Mindee** écarté (gratuit limité à 25/mois puis payant, forfaits entreprise 49–649 €).
- ✅ **Google Gemini (modèles Flash)** retenu : gratuit pour ce volume, vision (lit les
  images), clé gratuite via Google AI Studio (sans carte bancaire).

**Étapes prévues :**
1. L'utilisateur crée une **clé API Gemini gratuite** (aistudio.google.com).
2. Créer un **bucket Supabase Storage** pour les photos + policies RLS.
3. Écrire une **Edge Function Supabase** (TypeScript/Deno) qui garde la clé Gemini en
   secret (variable d'env) et renvoie le JSON extrait du ticket.
4. Dans l'app : bouton 📷 → upload photo → appel Edge Function → pré-remplissage du form.
- ⚠️ **À faire de préférence sur ordinateur** (déploiement de la fonction plus simple).
  Déclencheur utilisateur attendu : « on fait la partie 2 ».

## 🌿 Git / déploiement
- Brancher de dev : `claude/repository-reset-Pvn0h` (gardée synchro avec `main`).
- Pages publie depuis `main`. Pousser sur `main` est autorisé par l'utilisateur pour ce projet.
- Pas de PR sauf demande explicite.

## 💡 Idées futures (backlog)
- Photo justificatif jointe à l'export (PDF agrafé / lien).
- Export PDF en plus de l'Excel.
- Catégories/chantiers récents en suggestions.
- Mise en forme Excel (bordures/gras) — non supportée par SheetJS communautaire.
