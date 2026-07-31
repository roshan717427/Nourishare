# Nourishare

A recipe-sharing social app for home cooks: React Native / Expo (iOS) client
with a Vercel serverless API backed by Firebase Auth and Cloud Firestore.
Includes AI recipe suggestions (Google Gemini) with a Python rule-based fallback.

## Project Layout

- `App.js`, `screens/`, `components/`, `context/`, `config/`, `utils/`, `assets/` — Expo mobile app
- `api/` — Vercel serverless functions (`/api/<name>`). Major routes: `social`, `recipeLog`, `aiSuggestions`, `mealPlan`, plus profile CRUD. Python helpers `getSuggestions` / `analyzePersonality` are internal-only (shared secret), not called by the app directly
- `firebase/` — Firestore rules and indexes
- `ios/` — native iOS project (EAS Build / Xcode)
- `scripts/` — `START_EXPO.sh`, `test_api.sh`
- `docs/` — documentation (see below)
- `archive/` — unused alternate backends (Flask / Firebase Functions), reference only

## Getting Started

```bash
npm install
npm start          # or ./scripts/START_EXPO.sh
```

Production API (configured in `config/api.js`): `https://nourishare.vercel.app/api`

For a device/simulator walkthrough, see [docs/expo-guide.md](docs/expo-guide.md).
Full app features (push notifications, store builds) use an EAS development build or TestFlight — not Expo Go alone.

## Documentation

- [docs/frontend.md](docs/frontend.md) — Expo app overview, structure, and setup
- [docs/expo-guide.md](docs/expo-guide.md) — connecting a device/simulator and connection troubleshooting
- [docs/metro-troubleshooting.md](docs/metro-troubleshooting.md) — Metro / `EMFILE` / cache fixes
- [docs/api-testing.md](docs/api-testing.md) — API endpoint reference and curl examples
- [docs/FIREBASE_SETUP.md](docs/FIREBASE_SETUP.md) — Firebase Auth / project notes

## Secrets

Do **not** commit service-account JSON, `.env` files, Gemini keys, or `INTERNAL_API_SECRET`.
Server secrets live in Vercel (and EAS where needed). `serviceAccountKey.json` and `.env*` are gitignored.
