# Munchable

A recipe-logging social app: a React Native / Expo mobile client backed by a
Vercel serverless API (Firestore-backed).

## Project Layout

- `App.js`, `screens/`, `components/`, `config/`, `assets/` — Expo mobile app.
- `api/` — Vercel serverless functions (the live backend). File-based routing
  serves each file as `/api/<name>`.
- `scripts/` — helper scripts (`START_EXPO.sh` to launch Expo, `test_api.sh` to
  smoke-test the API).
- `docs/` — documentation (see below).
- `archive/` — unused alternate backends (Flask prototype, Firebase Functions),
  kept for reference only.

## Getting Started

```bash
npm install
npm start          # or ./scripts/START_EXPO.sh
```

## Documentation

- [docs/frontend.md](docs/frontend.md) — Expo app overview, structure, and setup.
- [docs/expo-guide.md](docs/expo-guide.md) — connecting a device/simulator and connection troubleshooting.
- [docs/metro-troubleshooting.md](docs/metro-troubleshooting.md) — Metro / `EMFILE` / cache fixes.
- [docs/api-testing.md](docs/api-testing.md) — API endpoint reference and curl examples.
