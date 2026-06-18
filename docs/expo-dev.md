# Expo dev server


Expo also writes a local `.expo/` folder (gitignored). The same instructions are in `.expo/README.md` on your machine after you start the server.

## Start the dev server

From the **project root**:

```bash
npx expo start
```

**Physical device (tunnel):**

```bash
npx expo start --tunnel
```

**Clear Metro cache** — add `-c`:

```bash
npx expo start -c
# or combined:
npx expo start --tunnel -c
```

## Open the app

1. Install [Expo Go](https://expo.dev/go) on your phone.
2. Scan the QR code shown in the terminal (or in the Expo dev tools page).
3. Ensure phone and computer can reach each other (tunnel helps when LAN does not).

## Files here

- `devices.json` — devices that recently opened this project.
- `settings.json` — dev server / manifest configuration for this machine.
