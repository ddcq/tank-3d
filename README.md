
![Tank 3D - Ukrainian Tank Defense](public/screenshot.jpg)

# Tank 3D — Ukrainian Tank Defense

> **Un jeu de tir arcade 3D où vous contrôlez un char ukrainien face aux vagues de soldats russes.**  
> Inspiré de *Space Invaders*, avec visée par suivi de tête via webcam (MediaPipe) et rendu Three.js.

---

## 🎮 Gameplay

Vous pilotez un char ukrainien positionné au bout d'une longue avenue dévastée par la guerre.  
En face de vous, des vagues de soldats russes avancent en formation à la manière de *Space Invaders* : ils se déplacent latéralement, descendent progressivement vers vous, et tirent.

### Objectif
- **Détruisez tous les soldats** de chaque vague pour passer à la suivante.
- Chaque vague augmente en difficulté : plus de soldats, déplacement plus rapide, intervalle de tir réduit.

### Mécaniques
- **Visée balistique** : les obus suivent une trajectoire parabolique (gravité). Un **prévisualisateur de trajectoire** (pointillés + crosshair) vous aide à ajuster votre tir.
- **Tir à zone** : les obus explosent au sol ou à l'impact, infligeant des dégâts de zone (rayon de 5 unités).
- **Effets visuels** : particules de sang, flaques de sang au sol, explosions avec anneau de feu.
- **Buildings destructurés** : l'environnement urbain reflète les ravages de la guerre (immeubles intacts, endommagés ou en ruine).

---

## 🕹️ Contrôles

| Touche | Action |
|---|---|
| `A` / `←` | Déplacer le char à gauche |
| `D` / `→` | Déplacer le char à droite |
| `Espace` | Tirer (maintenir pour tir automatique) |
| `Q` / `E` | Viser à gauche / droite (clavier) |
| `R` / `F` | Viser vers le haut / bas (clavier) |
| `T` | Activer / désactiver le suivi de tête |
| `C` | Calibrer le suivi de tête |
| `H` | Recentrer le suivi de tête |
| `R` | Recommencer la partie (game over) |

### 🧠 Suivi de tête (webcam)

Le jeu utilise **MediaPipe Face Landmarker** pour détecter les mouvements de votre tête via la webcam :

- Tournez la tête à **gauche/droite** → visez latéralement
- Inclinez la tête **haut/bas** → ajustez l'angle de tir
- Ouvrez la **bouche** → tirez (*trigger* buccal)

> ⚠️ Le site doit être servi en **HTTPS** pour accéder à la webcam  
> (le projet utilise `@vitejs/plugin-basic-ssl` en développement).

---

## 🧱 Architecture technique

### Stack

| Technologie | Rôle |
|---|---|
| **[Three.js](https://threejs.org/)** `^0.170.0` | Moteur de rendu 3D WebGL |
| **[MediaPipe Tasks Vision](https://developers.google.com/mediapipe/solutions/vision/face_landmarker)** | Détection faciale pour le suivi de tête |
| **[Vite](https://vitejs.dev/)** | Bundler et serveur de développement avec HTTPS |
| **TypeScript** | Langage typé |

### Structure du projet

```
src/
├── main.ts                          # Point d'entrée
├── engine/
│   ├── Game.ts                      # Boucle de jeu, gestion d'état, spawning
│   └── Renderer.ts                  # Configuration WebGL (shadow maps, tone mapping)
├── player/
│   ├── Player.ts                    # Logique joueur : mouvement, visée, tir
│   ├── Tank.ts                      # Modèle 3D du char ukrainien (chenilles, tourelle, couleurs)
│   ├── InputManager.ts              # Gestion des entrées clavier
│   ├── CameraController.ts          # Caméra troisième personne (vue du dessus)
│   └── Humanoid.ts                  # Modèle humanoïde générique avec animation de marche
├── entities/
│   ├── Entity.ts                    # Classe de base abstraite
│   ├── EntityManager.ts             # Gestion du cycle de vie des entités
│   ├── Bullet.ts                    # Obus joueur (trajectoire parabolique)
│   ├── EnemyBullet.ts               # Balles ennemies
│   ├── EnemySoldier.ts              # Soldat russe (modèle, tir, animation de mort)
│   └── TrajectoryPreview.ts         # Prédiction de trajectoire (pointillés + crosshair)
├── world/
│   ├── WorldManager.ts              # Génération du monde (route, bâtiments)
│   ├── Terrain.ts                   # Route et trottoirs
│   ├── Building.ts                  # Bâtiments procéduraux (3 états : intact, endommagé, ruine)
│   └── Environment.ts               # Éclairage (soleil, hémisphère, fog), ciel
├── formation/
│   └── FormationController.ts       # Mouvement de formation à la Space Invaders
├── physics/
│   └── PhysicsSystem.ts             # Détection de collisions, explosions, dégâts de zone
├── effects/
│   ├── ExplosionEffect.ts           # Effet d'explosion (disque, cœur, anneau)
│   └── BloodEffect.ts               # Particules de sang avec gravité et fondu
├── systems/
│   └── headTracking/
│       ├── HeadTrackingSystem.ts    # Intégration MediaPipe (webcam → yaw/pitch/mouth)
│       ├── HeadTrackingTypes.ts     # Types et interface du système
│       ├── HeadTrackingConfig.ts    # Configuration des sensibilités et limites
│       └── OneEuroFilter.ts         # Filtre de lissage pour les données de tracking
├── ui/
│   ├── HUD.ts                       # Score, vague, vies (affichage overlay)
│   ├── SaveManager.ts               # Sauvegarde localStorage (score, vague, vies)
│   └── styles.css                   # Styles globaux
├── assets/
│   └── AssetManager.ts              # Gestionnaire de textures avec cache
└── utils/
    ├── constants.ts                 # Constantes globales
    └── math.ts                      # Fonctions mathématiques (lerp, clamp, smoothstep)
```

---

## 🚀 Installation et exécution

### Prérequis
- Node.js >= 18
- npm

### Commandes

```bash
# Installer les dépendances
npm install

# Lancer en développement (HTTPS)
npm run dev

# Compiler pour la production
npm run build

# Prévisualiser le build
npm run preview
```

Le jeu est accessible sur **`https://localhost:5173`** (le SSL est nécessaire pour la webcam).

---

## 🖼️ Captures d'écran

| |
|---|
| *Bientôt disponible* |

---

## 🧪 Déploiement

Le build de production se trouve dans le dossier `dist/`.  
Déployez-le sur n'importe quel serveur statique (GitHub Pages, Netlify, Vercel, etc.).

---

## 📄 Licence

MIT © 2026 Denis DECLERCQ — voir le fichier [LICENSE](./LICENSE).

---

## 🙏 Crédits

- **[Three.js](https://threejs.org/)** — Moteur 3D
- **[MediaPipe](https://mediapipe.dev/)** — Suivi facial
- **[Vite](https://vitejs.dev/)** — Outil de build
- Inspiration : *Space Invaders* (Taito, 1978)
