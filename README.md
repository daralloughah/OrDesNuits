# OrDesNuits

Boutique de luxe multilingue (11 langues, 9 devises). Site statique : HTML, Tailwind CSS v4 et JavaScript (modules ES), sans framework.

## Le parcours du visiteur

1. `index.html` : accueil. Le visiteur choisit sa langue.
2. `maisons.html` : les deux maisons, **OrDesNuits** (ouverte) et **OrDesSens** (bientôt).
3. `boutique.html#lui` / `boutique.html#elle` : les deux boutiques d'OrDesNuits.
4. `produit.html#identifiant` : la fiche d'un produit.

## Organisation des fichiers

```
index.html  maisons.html  boutique.html  produit.html  404.html
assets/img/        images (logo, visuels, bannières)
assets/fonts/      polices hébergées chez nous (générées par npm run fonts)
src/app.css        le design (source Tailwind) : c'est ici qu'on modifie le style
css/app.css        fichier généré, ne pas modifier à la main
data/catalogue.json  catalogue de démonstration (utilisé tant que Supabase n'est pas branché)
supabase/          base de données (schema.sql, seed.sql), Concierge IA, guide LISEZMOI.md
locales/*.json     les textes de chaque langue
js/config.js       RÉGLAGES : WhatsApp, Snapchat, offre 3+1, langues, devises
js/core/           le moteur : langue, prix, catalogue, panier
js/ui/             l'interface : en-tête (chrome), vitrines produit (card), concierge, effets (fx), icônes
js/pages/          un fichier par page (chaque page HTML en charge un seul)
functions/api/geo.js  devine le pays du visiteur (Cloudflare) pour lui dire bienvenue dans sa langue
scripts/           outils : polices, source des traductions
_headers           sécurité et cache pour Cloudflare Pages
```

Chaque page HTML charge **un seul** fichier CSS et **un seul** fichier JS. Les autres fichiers JS sont importés automatiquement.

## Modifier les réglages

Ouvre `js/config.js` et remplace le numéro WhatsApp et le pseudo Snapchat.

## Images attendues

Pose-les dans `assets/img/` avec exactement ces noms. Tant qu'une image manque, le site affiche un décor à la place.

| Fichier | Où | Format |
|---|---|---|
| `ordessens.webp` | carte OrDesSens (page des maisons) | portrait 4:5 |
| `banniere-lui.webp` | haut de la boutique Pour lui | paysage 16:9 |
| `banniere-elle.webp` | haut de la boutique Pour elle | paysage 16:9 |

## Construire (dans GitHub Codespaces)

```bash
npm install
npm run build     # copie les polices + génère css/app.css
npm run serve     # aperçu sur le port 3000
```

Relance `npm run css` après chaque modification de classes Tailwind ou de `src/app.css`.

Pour modifier un texte, change-le dans `scripts/locales_src.py`, puis lance `python3 scripts/locales_src.py`.

## Mise en ligne

Cloudflare Pages, branché sur ce dépôt GitHub. Build command : `npm run build`. Output directory : `/`.

## Photos produits

Deux styles possibles pour chaque produit (champ `fit` dans le catalogue) :
- par défaut : la photo remplit la vitrine ;
- `"fit": "contain"` : photo détourée (PNG à fond transparent), posée sur le piédestal sous le projecteur. C'est le rendu le plus luxueux.

Plusieurs photos : `"img"` pour la principale et `"gallery": ["…", "…"]` pour les autres.

## Langue de bienvenue

Ordre de priorité : la langue déjà choisie par le visiteur, puis le pays de son adresse IP (`/api/geo`, uniquement une fois en ligne sur Cloudflare), puis la langue de son téléphone.

## Espace gérant (Salon privé)

Adresse : `admin.html` (non référencée par Google). Au premier passage, choisis ton code à 4 chiffres.

- **Salon** : valeur du stock, ventes de la semaine, produits à réassortir.
- **Produits** : ajouter, modifier, supprimer ; prix, promo, stock (boutons − / +), encadrement, offre 3+1, visibilité, photos.
- **Ventes** : colle le message de commande WhatsApp, le stock se décompte tout seul.
- **Atelier** : studio photo (recadrage, ambiances, texte, logo, badges, cadre art déco).
- **Réglages** : exporter / importer le catalogue, changer le code.

En attendant Supabase, les modifications sont enregistrées sur l'appareil utilisé. Pour les publier : Réglages → Exporter le catalogue, puis remplacer `data/catalogue.json` sur GitHub par le fichier exporté.

Accès discret depuis le site : touche 5 fois rapidement le grand logo en bas de page.

## Version 1.4 : front-end complet

- `commande.html` : tunnel de commande (coordonnées, pays, région déduite du code postal, consentement aux offres, CGV).
- `compte.html` : comptes clients (inscription, connexion, mes commandes, offres).
- `legal.html` : mentions légales, CGV, confidentialité (les passages entre [crochets] sont à compléter).
- Salon privé : tableau de bord (CA, commandes, panier moyen, fidélité, comptes, e-mails, marge, top pays, régions, produits, moments, pistes stratégiques), commandes avec suivi et décompte du stock, clients et e-mails avec consentement, comptabilité (livre des recettes exportable, URSSAF estimée, seuils).

## Version 1.5 : back end Supabase et Concierge IA

Mode d'emploi pas à pas : **`supabase/LISEZMOI.md`**.

- Comptes clients en ligne (confirmation par e-mail, mot de passe oublié), commandes, liste d'e-mails, produits, stock et photos partagés entre tous les appareils.
- Prix et offre 3+1 recalculés par le serveur à chaque commande.
- Salon privé : connexion sécurisée du gérant, mise à jour automatique toutes les 30 secondes, alerte « Nouvelle commande ! », stock décompté par le serveur à la confirmation.
- Le Concierge répond aux questions libres grâce à Claude (fonction `supabase/functions/concierge`), avec repli WhatsApp.
- `js/core/backend.js` choisit tout seul : en ligne si `js/config.js` contient l'adresse Supabase, sinon mode aperçu sur l'appareil.

## Version 1.6 · 1.7

- Fiche produit : formats et lots (1, 2, 3, 6, 12, 24…) avec économie calculée toute seule, rituel, composition, mises en garde.
- Espace revendeurs : panier mélangé, remise par montant total (grille tirée du produit « référence »).
- 3 écrins au choix (Velours, Coffret, Galerie), mode discret, barre d'achat collante.
- Salon privé : fonctionne hors connexion (les modifs partent au retour du réseau), Croissance (conseiller budget pub), Studio pub, Atelier vidéo, Effaceur.
- **Avant de publier la v1.6/1.7 : lancer `supabase/v1.6.sql`** (colonne `extra`, prix par lots côté serveur).
