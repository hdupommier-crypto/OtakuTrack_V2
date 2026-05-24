# OtakuTrack

Suivi personnel des animes et mangas — stockage sur base MySQL personnelle.

## Structure du projet

```
OtakuTrack/
├── index.html    — Interface utilisateur
├── app.js        — Logique front-end
├── api.php       — API backend (lecture/écriture MySQL)
├── setup.sql     — Script d'initialisation de la BDD
└── manifest.json — PWA manifest
```

## Installation

### 1. Initialiser la base de données

Connectez-vous à votre base MySQL et exécutez `setup.sql` :

```bash
mysql -h noitulosqzhip.mysql.db -u noitulosqzhip -p noitulosqzhip < setup.sql
```

Ou via phpMyAdmin : importer le fichier `setup.sql`.

### 2. Déployer les fichiers

Uploadez tous les fichiers sur votre hébergement PHP (public_html ou équivalent) :
- `index.html`
- `app.js`
- `api.php`
- `manifest.json`

### 3. Vérifier l'API

Ouvrez `https://votre-domaine.com/api.php?action=status` dans le navigateur.
Vous devez voir : `{"ok":true,"message":"API OtakuTrack opérationnelle"}`

### 4. Utiliser l'application

Ouvrez `index.html`. L'indicateur en haut à droite passe au vert quand les données sont chargées.

## Configuration BDD

Les identifiants sont dans `api.php` (lignes 3-6). Pour changer de base :

```php
define('DB_HOST', 'votre-serveur.mysql.db');
define('DB_USER', 'votre_utilisateur');
define('DB_PASS', 'votre_mot_de_passe');
define('DB_NAME', 'votre_base');
```

## Fonctionnalités

- Suivi des animes (saisons, épisodes, durée)
- Suivi des mangas (tomes disponibles / lus)
- Filtres : Tout / Finis / En cours / À voir
- Tri : alphabétique, progression, durée, dernière modification
- Mode condensé / déployé (avec poster)
- Statistiques : épisodes vus, temps de visionnage, titres terminés
- Sauvegarde automatique à chaque modification
