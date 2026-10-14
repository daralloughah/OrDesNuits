# Brancher Supabase (environ 20 minutes, tout se fait au téléphone)

Tant que `js/config.js` ne contient pas l'adresse Supabase, le site reste en **mode aperçu** : tout est enregistré sur l'appareil. Dès que l'adresse est collée, le site passe en ligne tout seul.

> 🔐 **Les deux règles d'or**
> - La clé **`service_role` / `secret`** ne va **jamais** dans le code, sur GitHub ou dans un message. Seules l'URL et la clé **anon / publishable** vont dans `js/config.js` (elles sont publiques par conception, la sécurité est assurée par les règles de la base).
> - La clé **Anthropic** se met uniquement dans les **Secrets** de Supabase (étape 5).

---

## 1. Créer la base (SQL Editor)

1. Sur GitHub, ouvre `supabase/schema.sql` → bouton **Raw** → sélectionne tout → copie.
2. Supabase → **SQL Editor** → **New query** → colle → **Run**.
   Le message « Success. No rows returned » est normal. Le script peut être relancé sans danger.
3. Même chose avec `supabase/seed.sql` (les produits de démonstration). À lancer **une seule fois**.

Tu peux vérifier dans **Table Editor** : tables `products`, `orders`, `profiles`, `subscribers`…

## 2. Réglages des comptes (Authentication)

1. **Authentication → URL Configuration**
   - **Site URL** : `https://daralloughah.github.io/OrDesNuits/`
   - **Redirect URLs** → Add URL : `https://daralloughah.github.io/OrDesNuits/**`
   - (Plus tard, avec ton nom de domaine : ajoute aussi `https://tondomaine.com/**` et change le Site URL.)
2. **Authentication → Sign In / Providers → Email** : laisse **Confirm email** activé. C'est ce qui empêche quelqu'un de créer un compte avec l'e-mail d'un autre.

> ⚠️ L'envoi d'e-mails intégré à Supabase est limité à quelques e-mails par heure : parfait pour tester, insuffisant pour le lancement. Avant d'ouvrir au public : **Authentication → Emails → SMTP Settings** avec un service d'envoi (Brevo, Resend…). Tu peux aussi y traduire et habiller les e-mails (confirmation, mot de passe oublié).

## 3. Coller les clés publiques dans le site (✅ déjà fait dans la v1.5.1)

**Project Settings → API** (ou **API Keys**) :
- **Project URL** (ressemble à `https://abcdefgh.supabase.co`)
- **anon / publishable key** (commence par `eyJ…` ou `sb_publishable_…`)

Sur GitHub, ouvre `js/config.js` → crayon ✏️ → tout en bas :

```js
export const SUPABASE = {
  url: "https://abcdefgh.supabase.co",
  anonKey: "sb_publishable_…",
};
```

→ **Commit changes**. GitHub Pages republie le site en 1 à 2 minutes.

## 4. Devenir gérant

1. Sur le site, va sur **Mon compte** (icône 👤) → **Créer un compte** avec ton e-mail.
2. Ouvre l'e-mail de confirmation et touche le lien.
3. Supabase → **SQL Editor** → New query → remplace l'e-mail et **Run** :

```sql
insert into public.admins (user_id)
select id from auth.users where email = 'daralloughah2@gmail.com';
```

4. Ouvre `admin.html` (ou touche 5 fois le grand logo en bas de page) et connecte-toi avec ce compte. Le code PIN du mode aperçu n'existe plus : c'est une vraie connexion sécurisée.

## 5. Le Concierge IA

### a) La clé de l'IA (une seule des deux)
Supabase → **Edge Functions → Secrets** → **Add new secret** :
- **Google Gemini** (gratuit pour démarrer) : Name `GEMINI_API_KEY`, Value = ta clé Google AI Studio. Modèle par défaut : `gemini-3.5-flash-lite` (changeable avec le secret `GEMINI_MODEL`).
- **ou Anthropic Claude** : Name `ANTHROPIC_API_KEY`, Value = ta clé de [console.anthropic.com](https://console.anthropic.com) (pense à fixer une limite de dépense mensuelle dans Billing).

Si les deux sont présentes, Gemini est utilisé. Pour passer à Claude, supprime simplement le secret `GEMINI_API_KEY`.

### b) La fonction
1. Sur GitHub, ouvre `supabase/functions/concierge/index.ts` → **Raw** → copie tout.
2. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
3. Nom : `concierge` (exactement). Remplace le code d'exemple par le tien → **Deploy function**.
4. Dans la fonction → **Details / Settings** : désactive **Verify JWT** (« Enforce JWT verification ») → **Save**. Sans ça, les visiteurs non connectés ne pourraient pas parler au Concierge.

*Variante depuis Codespaces :*
```bash
npx supabase login
npx supabase functions deploy concierge --no-verify-jwt --project-ref TON_REF
npx supabase secrets set GEMINI_API_KEY=ta_cle --project-ref TON_REF
```
(`TON_REF` = les lettres avant `.supabase.co` dans ton URL.)

### Garde-fous déjà en place
- 30 messages par heure et par visiteur, 1 500 messages par jour pour tout le site (modifiables avec les secrets `CONCIERGE_HOURLY` et `CONCIERGE_DAILY`).
- Le Concierge connaît ton catalogue à jour (prix, stock, offre 3+1), répond dans la langue du client, ne promet aucun effet sur la santé, renvoie les questions médicales vers un médecin ou un pharmacien, et passe la main à WhatsApp pour le suivi des commandes.
- Si la fonction ne répond pas (clé absente, limite atteinte…), le site propose automatiquement d'écrire sur WhatsApp.
- Le texte des consignes du Concierge est dans `systemPrompt` (fichier `index.ts`) : version simple pour l'instant.
- En cas de problème : **Edge Functions → concierge → Logs** affiche l'erreur exacte renvoyée par Google ou Anthropic.

## 6. Vérifier que tout marche

- [ ] La boutique affiche les produits (venant de la base).
- [ ] Une commande test passe : elle apparaît dans le Salon privé → Commandes.
- [ ] En confirmant la commande dans le Salon, le stock baisse tout seul ; en l'annulant, il remonte.
- [ ] Un compte client voit sa commande dans **Mon compte**.
- [ ] « Mot de passe oublié » envoie bien un e-mail.
- [ ] Le Concierge répond à une question libre (« Le colis est-il discret ? »).
- [ ] Une photo ajoutée dans le Salon apparaît sur le site (elle est stockée dans **Storage → products**).

Pour la démo au fournisseur : **Salon → Réglages → Charger les données de démo** (140 commandes fictives). À retirer d'un geste avant le lancement.

## Ce qui est protégé, et comment

| Donnée | Qui peut la lire | Qui peut la modifier |
|---|---|---|
| Produits visibles | tout le monde | le gérant |
| Coûts d'achat | le gérant | le gérant |
| Commandes | le client concerné, le gérant | le gérant (le client passe par `place_order`) |
| Prix d'une commande | recalculés par le serveur : impossible de tricher depuis le navigateur | |
| Profils clients | le client lui-même, le gérant | le client (prénom, langue, offres) |
| Liste d'e-mails | le gérant | inscription volontaire uniquement (RGPD) |
| Photos | tout le monde | le gérant |
| Journal du Concierge | personne (serveur uniquement) | serveur |

Paiement en ligne (Stripe) et e-mails de commande : prochaine étape.
