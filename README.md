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
data/catalogue.json  catalogue de démonstration (remplacé ensuite par Supabase)
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
