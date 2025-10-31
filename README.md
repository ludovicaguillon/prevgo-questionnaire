# 🏥 Prév&Go - Questionnaire de Prévention en Santé

Version 30.0 - Conforme aux recommandations HAS • INCa • PNNS • GPAQ 2025

## 📋 Description

Questionnaire médical structuré pour la prévention en santé comprenant :
- 👤 Profil de Base
- 🏥 Antécédents Personnels (ATCDP)
- 👨‍👩‍👧‍👦 Antécédents Familiaux (ATCDF)
- 🏃 Mode de Vie - Facteurs de Risque Modifiables (FDRM)
- 🧠 Bien-être Psychologique
- 💉 Vaccination
- 🔬 Dépistages

**~250+ questions adaptatives** avec logique conditionnelle selon âge, sexe, et antécédents.

## 🚀 Installation Locale

```bash
npm install
npm start
```

L'application s'ouvrira à l'adresse `http://localhost:3000`

## 🌐 Déploiement sur Vercel

### Méthode 1 : Via GitHub (Recommandée)

1. Créez un nouveau repository GitHub
2. Uploadez tous les fichiers de ce projet
3. Allez sur vercel.com
4. Cliquez sur "New Project"
5. Importez votre repository
6. Cliquez sur "Deploy"

### Méthode 2 : Via CLI Vercel

```bash
npm install -g vercel
vercel
```

## 📦 Structure

```
prevgo-questionnaire/
├── src/
│   ├── App.js                  # Composant racine
│   ├── App.css                 # Styles principaux
│   ├── index.js                # Point d'entrée
│   ├── index.css               # Styles globaux + Tailwind
│   └── PrevGoQuestionnaire.jsx # Composant questionnaire (250+ questions)
├── public/
│   ├── index.html              # Page HTML
│   └── manifest.json           # Configuration PWA
├── package.json                # Dépendances
├── tailwind.config.js          # Configuration Tailwind
└── postcss.config.js           # Configuration PostCSS
```

## 🔧 Technologies

- React 18.2
- Tailwind CSS 3.3
- Lucide React (icônes)
- Supabase (sauvegarde automatique)

## ✨ Fonctionnalités

- ✅ 250+ questions adaptatives
- ✅ 7 sections thématiques
- ✅ 14 types de questions (radio, checkbox, échelles, tableaux, etc.)
- ✅ Logique conditionnelle sophistiquée
- ✅ Sauvegarde automatique sur Supabase
- ✅ Progression par section
- ✅ Navigation intuitive
- ✅ Design responsive
- ✅ Validation des réponses

## 📄 Licence

© 2025 Prév&Go - Tous droits réservés
