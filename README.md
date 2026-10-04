# Curio — Premium Collection Management

A full-featured Progressive Web App (PWA) for managing personal collections of any kind — books, vinyl records, art, memorabilia, and more.

![React](https://img.shields.io/badge/React-19-blue?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-5.9-blue?logo=typescript)
![Firebase](https://img.shields.io/badge/Firebase-12-orange?logo=firebase)
![Vite](https://img.shields.io/badge/Vite-7-purple?logo=vite)
![PWA](https://img.shields.io/badge/PWA-Ready-green)

## Features

### Collection Management
- Create unlimited collections with custom categories
- Add items with rich metadata: title, description, condition, location, quantity
- Custom field types per category: text, number, date, select, currency, tags, images, and more
- Bulk actions: edit, delete, archive multiple items at once
- Duplicate detection and resolution

### Financial Tracking
- Track purchase price and current valuation for each item
- Value history with charts showing appreciation/depreciation over time
- Multi-currency support (USD, EUR, TRY, GBP, JPY, CHF) with real-time conversion via [Frankfurter API](https://www.frankfurter.dev/)
- Automatic ROI and gain/loss calculations

### Dashboard & Analytics
- Customizable widget-based dashboard
- Charts: value over time, category distribution, acquisition timeline, value by category
- Stats: total collection value, item count, top categories
- Activity feed and recent items at a glance

### Collaboration
- Multi-user support with role-aware access controls (admin, editor, viewer)
- Activity log with full audit trail of all changes
- Contributor management

### Additional Features
- **Wishlist** — track desired items with priority levels and target prices
- **Lending Tracker** — record who you've lent items to with condition monitoring
- **Maintenance Logs** — track repairs and restoration with dates and costs
- **Barcode / QR Code** — scan barcodes to add items, generate QR labels for physical tagging
- **Book Search** — auto-fill item data via OpenLibrary API
- **Export** — download your collection as CSV
- **Print Labels** — print physical tags for your items
- **PWA** — installable on iOS, Android, and desktop with offline support

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | React 19 + TypeScript |
| Build Tool | Vite 7 |
| Styling | Tailwind CSS 4 + Radix UI |
| Animations | Framer Motion |
| State | Zustand (with persistence) |
| Forms | React Hook Form + Zod |
| Backend | Firebase (Auth, Firestore, Storage) |
| Charts | Recharts |
| PWA | Vite PWA + Workbox |
| Testing | Vitest + Testing Library |

## Data & Security

- Firestore data is scoped per user under `users/{uid}/...`
- Firebase Storage access rules live in [`storage.rules`](./storage.rules)
- Firestore rules are configured through [`firebase.json`](./firebase.json)

## Getting Started

### Prerequisites

- Node.js 18+
- A [Firebase](https://firebase.google.com/) project with Auth, Firestore, and Storage enabled

### Installation

```bash
git clone https://github.com/canberkyigit/CollectionApp.git
cd CollectionApp
npm install
```

### Environment Variables

Copy `.env.example` to `.env` and fill in your Firebase credentials:

```bash
cp .env.example .env
```

```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
```

### Development

```bash
npm run dev
```

### Build

```bash
npm run build
npm run preview
```

### Desktop App

Develop the Electron desktop app directly from this repo:

```bash
npm run desktop:install
npm run desktop:dev
```

Build the installer artifacts:

```bash
npm run desktop:dist:universal
```

Before shipping a manual desktop build, bump the version in this `package.json`. The desktop wrapper reads it during manual builds.

GitHub automation no longer updates `CollectionApp-Desktop` when this repo changes. Run the desktop sync workflow manually only when you want to move the desktop app to a new web commit.

Enable desktop auto-update by building with a feed URL:

```bash
COLLECTVAULT_UPDATE_URL=https://your-domain.com/collectvault npm run desktop:dist:universal
```

### Testing

```bash
npm run test          # run once
npm run test:watch    # watch mode
npm run test:coverage # coverage report
npm run test:ui       # Vitest UI
```

## Project Structure

```
src/
├── components/
│   ├── ui/            # Base UI primitives
│   ├── layout/        # App shell pieces
│   ├── shared/        # Shared screens, dialogs, cards, motion helpers
│   └── dashboard/     # Dashboard customization UI
├── data/              # Starter/demo data used for offline mode
├── lib/               # Utilities, icons, valuation and contributor helpers
├── pages/             # Route-level screens
├── services/          # Firebase, auth, CSV/export, currency, storage
├── store/             # Zustand stores and persistence
├── test/              # Test setup and helpers
└── types/             # TypeScript domain models
```

## License

MIT
