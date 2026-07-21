<p align="center">
  <img src="public/logo.svg" alt="Guest Manager" width="120" height="120" />
</p>

<h1 align="center">🥂 Guest Manager</h1>

<p align="center">
  <em>“L’art de recevoir, simplifié.”</em>
</p>

<p align="center">
  <a href="https://nextjs.org/"><img src="https://img.shields.io/badge/Next.js-16.2-black?style=flat-square&logo=next.js" alt="Next.js" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.0-blue?style=flat-square&logo=typescript" alt="TypeScript" /></a>
  <a href="https://supabase.com/"><img src="https://img.shields.io/badge/Supabase-2.0-green?style=flat-square&logo=supabase" alt="Supabase" /></a>
  <a href="https://tailwindcss.com/"><img src="https://img.shields.io/badge/Tailwind_CSS-4-06B6D4?style=flat-square&logo=tailwindcss" alt="Tailwind CSS" /></a>
  <a href="https://ui.shadcn.com/"><img src="https://img.shields.io/badge/shadcn%2Fui-latest-000000?style=flat-square&logo=shadcnui" alt="shadcn/ui" /></a>
  <a href="https://react-pdf.org/"><img src="https://img.shields.io/badge/%40react--pdf-4.5-red?style=flat-square&logo=adobe" alt="@react-pdf" /></a>
  <br />
  <a href="./LICENSE"><img src="https://img.shields.io/badge/Licence-MIT-yellow?style=flat-square" alt="License" /></a>
  <a href="https://www.framer.com/motion/"><img href=""><img src="https://img.shields.io/badge/Framer_Motion-12-purple?style=flat-square&logo=framer" alt="Framer Motion" /></a>
  <img src="https://img.shields.io/badge/Statut-En%20production-success?style=flat-square" alt="Status" />
</p>

---

## 📖 Présentation

**Guest Manager** est une application web professionnelle dédiée à la gestion d'invités pour des événements haut de gamme — mariages, galas, soirées d'entreprise. Elle couvre l'intégralité du cycle de vie d'un événement :

1. **Organisation** — importez, catégorisez et organisez vos listes d'invités (singletons, couples, familles)
2. **Placement** — créez un plan de table par glisser-déposer avec contraintes intelligentes
3. **Accueil** — check-in en temps réel depuis une tablette, synchronisé sur tous les postes
4. **Analyse** — tableau de bord statistique avec graphiques et indicateurs clés
5. **Export** — générez des rapports PDF professionnels pour le staff, le traiteur et les archives

---

## ✨ Fonctionnalités

| Fonctionnalité | Description |
|---|---|
| 👥 **Gestion des invités** | CRUD complet, groupes (couples/familles), recherche, filtres |
| 📥 **Import/Export CSV** | Import avec mapping de colonnes, export brut ou filtré |
| 🪑 **Plan de salle** | Drag & drop, validation de capacité, verrouillage de tables |
| 📱 **Check-in temps réel** | Interface tablette, synchronisation multi-postes, mode hors-ligne |
| 📊 **Tableau de bord** | KPI, courbe d'arrivées, répartition catégories, occupation des tables |
| 📄 **Rapports PDF** | Master Book, fiches par table, synthèse traiteur, fiche de présence |
| 🔐 **Sécurité** | Authentification Supabase, RLS, rôles admin/host |
| 🔄 **Temps réel** | Supabase Realtime, mise à jour instantanée sur tous les écrans |

---

## 🛠 Stack technique

| Technologie | Utilisation |
|---|---|
| [Next.js 16](https://nextjs.org/) (App Router) | Framework React full-stack |
| [TypeScript](https://www.typescriptlang.org/) (strict) | Typage statique |
| [Supabase](https://supabase.com/) | Base de données PostgreSQL, Auth, Realtime |
| [Tailwind CSS v4](https://tailwindcss.com/) | Styling utilitaire |
| [shadcn/ui](https://ui.shadcn.com/) | Composants UI (Radix primitives) |
| [Zustand](https://zustand-demo.pmnd.rs/) | État client avec persistance offline |
| [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) | Formulaires typés et validation |
| [@react-pdf/renderer](https://react-pdf.org/) | Génération de PDF côté serveur |
| [Recharts](https://recharts.org/) | Graphiques interactifs |
| [Framer Motion](https://www.framer.com/motion/) | Animations fluides |
| [@dnd-kit](https://dndkit.com/) | Drag & drop accessible |

---

## 🚀 Installation

### Prérequis

- Node.js 18+
- npm ou yarn
- Un projet [Supabase](https://supabase.com/) (gratuit)

### Étapes

```bash
# 1. Cloner le dépôt
git clone https://github.com/votre-org/guest-manager.git
cd guest-manager

# 2. Installer les dépendances
npm install

# 3. Configurer les variables d'environnement
cp .env.example .env.local
# Remplir NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY

# 4. Lancer le serveur de développement
npm run dev
```

Ouvrir [http://localhost:3000](http://localhost:3000) 🎉

---

## 📁 Structure du projet

```
guest-manager/
├── src/
│   ├── app/                         # Pages Next.js (App Router)
│   │   ├── (auth)/                  # Login, Register
│   │   ├── (dashboard)/             # Dashboard, gestion événements
│   │   │   ├── dashboard/           # Accueil, création, archivés, profil
│   │   │   └── event/[eventId]/     # Détail, invités, tables, placement, settings, dashboard, reports
│   │   ├── (reception)/             # Interface de check-in
│   │   └── api/reports/             # API de génération PDF/CSV
│   ├── components/                  # Composants React
│   │   └── ui/                      # shadcn/ui (Button, Card, Dialog, etc.)
│   ├── lib/                         # Logique métier
│   │   ├── supabase/                # Clients Supabase (server + browser)
│   │   ├── store/                   # Zustand (état offline, réception)
│   │   ├── hooks/                   # useRealtimeGuests
│   │   └── pdf/                     # Moteur PDF (templates, utils)
│   └── types/                       # Types générés Supabase
├── public/                          # Assets statiques (logo, favicon)
├── supabase/                        # Migrations SQL
├── project_info.md                  # Documentation détaillée du projet
└── README.md                        # Ce fichier
```

---

## 🧪 Scripts disponibles

| Commande | Description |
|---|---|
| `npm run dev` | Serveur de développement (Turbopack) |
| `npm run build` | Build de production |
| `npm run start` | Lancement du serveur de production |
| `npm run lint` | Vérification ESLint |

---

## 📸 Aperçu

| Page | Description |
|---|---|
| **Landing page** | Vitrine avec présentation des fonctionnalités |
| **Dashboard** | Liste des événements avec cartes et statuts |
| **Gestion invités** | CRUD, filtres, import/export CSV |
| **Plan de salle** | Drag & drop avec validation |
| **Check-in** | Interface tablette temps réel |
| **Statistiques** | Graphiques, KPI, alertes |
| **Rapports** | Génération PDF (Master Book, fiches tables, traiteur) |

---

## 🤝 Contribution

Les contributions sont les bienvenues ! Veuillez consulter le fichier [`project_info.md`](./project_info.md) pour comprendre les décisions d'architecture et les conventions de code.

### Règles
- Commentaires en français
- TypeScript strict (pas de `any`)
- Pas de commit direct sans validation
- Consulter `project_info.md` avant chaque décision

---

## 📄 Licence

Ce projet est sous licence **MIT**. Voir le fichier [LICENSE](LICENSE).

---

<p align="center">
  Fait avec ❤️ pour des réceptions inoubliables.<br />
  <strong>Guest Manager</strong> — <em>L'art de recevoir, simplifié.</em>
</p>
