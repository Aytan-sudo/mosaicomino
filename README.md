# Mosaïcomino

Puzzle de composition par formes libres. Une silhouette continue est découpée
en tesselles polygonales : triangles, quadrilatères, pentagones et formes plus
complexes, dont certaines frontières deviennent des courbes complémentaires.
Le joueur doit tout replacer sans redimensionner les pièces, sans chevauchement,
sans dépassement et sans vide.

Ce n’est pas une variante graphique de Polyominos. Il n’y a ni grille ni case :
les positions, les rotations, les courbes, les collisions et l’aire sont toutes
calculées dans un plan continu.

## Version 1.2.3 — Passeport 1.9.0

Module commun du passeport 1.9.0 : deux jeux neufs rejoignent la collection,
**Le compte est bon** (thème Nombres) et **La Ruche** (thème Mots). Rien ne
change dans le jeu.

## Version 1.2.2 — Passeport 1.8.0

Module commun du passeport 1.8.0 : **Maze for Adventurers** rejoint le thème
Aventure, aux côtés de Snake. Toute la collection est désormais raccordée. Rien
ne change dans le jeu.

## Version 1.2.1 — Passeport 1.7.0

Module commun du passeport 1.7.0 : 2048 rejoint le thème Nombres, Snake ouvre le
thème Aventure, Motamorphose le thème Mots, et Dames, Diamants, Laser & Miroirs
et Untangle rejoignent le thème Logique. Rien ne change dans le jeu.

## Version 1.2.0 — Le passeport commun

- ouvert depuis le hub avec un passeport, le jeu range préférences, composition
  en cours et statistiques dans l’espace du joueur ; en mode invité, rien ne
  change ;
- une composition achevée donne le tampon **Logique** tout de suite (indices
  compris) ; sinon, la vingtième tesselle posée dans la journée le donne aussi ;
- **correction** : recharger la page en pleine partie effaçait toutes les
  tesselles posées, car l’adresse `?jour=` relançait une composition neuve. Celle
  qui est sauvegardée est désormais reprise quand l’adresse la désigne ;
- **correction** : le titre passait sous les boutons de l’en-tête (29 px sur
  iPhone 15, 77 px sur iPhone SE). Il se règle maintenant sur la place laissée
  par les boutons, et le monogramme s’efface sur téléphone en portrait ;
- l’adresse garde le profil du passeport ; bandeau du passeport, fichiers
  `commun/` précachés.

## Version 1.1.1

- les cibles tactiles de l'interface passent à 44 px (boutons d'en-tête,
  boutons texte, listes déroulantes), conformément à la convention.

## Version 1.1

- **le bouton Miroir ne restait plus affiché là où il ne sert à rien.** Le rendu
  le cachait bien par l'attribut `hidden`, mais `.outils button { display: flex }`
  l'emportait sur le `display: none` que le navigateur y attache : le bouton
  restait donc visible sur Épure, Mosaïque et la pièce du jour, où retourner une
  tesselle n'est pas permis — visible et inerte. Un rappel `[hidden] { display:
  none !important; }` remet les choses en place, et un test structurel interdit
  désormais à toute règle d'auteur de réafficher un élément caché ;
- le son de refus remonte de 135 Hz à une chute de 400 vers 310 Hz. Un
  haut-parleur de téléphone ne restitue à peu près rien sous 300 Hz : le refus
  disait non par une profondeur qui n'arrivait jamais à l'oreille, il le dit
  maintenant par le mouvement. `tests/test-son.mjs` joue les quatre timbres
  contre un contexte audio factice et garde le plancher ;
- le contexte audio se prépare dès le premier geste et se suspend quand l'onglet
  passe à l'arrière-plan ;
- `user-scalable=no` et `touch-action: manipulation` sur les boutons : plus de
  zoom accidentel au double-tap pendant une rafale de rotations ;
- `assets/icon.svg` sert de favicon, rejoint le manifeste et la coquille hors
  ligne.

## Version 1.0

- déplacement libre au doigt ou à la souris sur un canvas haute définition ;
- sélection puis pose au toucher, utile sur les petits écrans ;
- aimantation douce seulement à proximité exacte d’un raccord ;
- collisions géométriques : une forme qui dépasse ou recouvre une autre est
  refusée ;
- rotations de 30° en Épure, 15° dans les deux autres collections ;
- retournements miroir réservés à Virtuose ;
- trois difficultés de six, huit et onze tesselles ;
- défi quotidien déterministe et études libres partageables ;
- annulation, indice, chronomètre suspendu à l’arrière-plan ;
- reprise de la composition, résultats et séries via `localStorage` ;
- six ambiances, grain optionnel, sons synthétiques et vibration ;
- contrôle clavier et respect des mouvements réduits ;
- PWA hors ligne, sans dépendance de production ni compilation.

## Pourquoi l’énigme ne se résout pas d’un coup d’œil

Les frontières sont tirées d’un pavage exact, mais plusieurs arêtes partagent
des longueurs et des rayons proches. Une courbe convaincante peut donc conduire
à un faux raccord. L’interface ne colore jamais les pièces « bien placées » :
elle vérifie uniquement la physique de l’ensemble.

Le jeu accepte toute composition valide, pas seulement la découpe d’origine.
Puisque la somme des aires des tesselles est exactement celle de la silhouette,
toutes les formes posées à l’intérieur sans recouvrement impliquent un pavage
complet.

## Les collections

| Collection | Tesselles | Rotation | Particularité |
| --- | ---: | ---: | --- |
| **Épure** | 6 | 30° | grandes formes, davantage de lignes droites |
| **Mosaïque** | 8 | 15° | courbes fréquentes et faux raccords |
| **Virtuose** | 11 | 15° | formes proches et miroirs |

## Génération géométrique

1. Une silhouette convexe est construite dans un plan logique de 1 000 × 1 000.
2. Des centres sont distribués avec une distance minimale.
3. Leur diagramme de Voronoï est découpé par demi-plans et limité à la
   silhouette.
4. Les cellules trop petites ou trop grandes sont rejetées.
5. Chaque arête partagée peut recevoir une Bézier cubique ; les deux tesselles
   utilisent exactement la même courbe en sens inverse.
6. Les pièces sont tournées, parfois réfléchies en Virtuose, puis mélangées.

La détection de collision échantillonne les Bézier, contrôle la contenance,
cherche les intersections propres et sonde les intérieurs. Les solutions de
centaines de graines sont rejouées dans les tests.

## Architecture

- `js/geometrie.js` — aires, demi-plans, Bézier, transformations et collisions ;
- `js/generateur.js` — silhouettes, Voronoï, courbes partagées et difficulté ;
- `js/partie.js` — placement libre, aimantation, miroir, victoire et indice ;
- `js/rendu.js` — dessin canvas haute définition et collection de tesselles ;
- `js/app.js` — gestes, clavier, chronomètre et écrans ;
- `js/stockage.js` — session, préférences, résultats et séries locales ;
- `css/themes.css` — six ambiances et couleurs des tesselles ;
- `css/style.css` — interface mobile, galerie, paysage et dialogues ;
- `tests/` — géométrie, génération, règles, stockage et cohérence PWA.

## Développer

```bash
npm test
npm run check
npm run serve   # http://localhost:8766
```

