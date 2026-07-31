# Expo Connection Guide

How to run the Nourishare Expo app and connect a phone or simulator, plus
troubleshooting for the common "Internet connection appears to be offline" /
QR-code issues.

## Which runtime to use

| Goal | Use |
| --- | --- |
| Quick UI iteration | Expo Go (many screens work) |
| Push notifications, production-parity native behavior | **EAS development build** or **TestFlight** |
| iOS Simulator | `npx expo start --ios` / `npm run ios` |

Push registration in this app expects a real device build path (`expo-notifications` + EAS project id).

## Connecting to the App

### Option 1: Scan QR Code (Easiest for Expo Go)

1. **Start Expo with tunnel mode:**
   ```bash
   npx expo start --tunnel
   ```
   (Requires a free Expo account.)

2. **In the Expo Go app:**
   - Open Expo Go
   - Tap **Scan QR code**
   - Point the camera at the QR code in your terminal

### Option 2: LAN (same Wi‑Fi)

```bash
npx expo start --lan
```

Then open the development server from Expo Go’s home screen / recently opened list.

### Option 3: Enter the URL Manually

1. After starting Expo, look for a line like: `exp://192.168.1.118:8081`
2. In Expo Go, enter that URL manually (or share it to the phone)

### Option 4: iOS Simulator / Android Emulator

```bash
npx expo start --ios       # or press `i` when Metro is running (Mac)
npx expo start --android   # or press `a`
# or
npm run ios
npm run android
```

### Option 5: Custom Development Build / TestFlight

Install your EAS development client or TestFlight build. Open it while Metro is
running (dev client) or use the standalone TestFlight binary against the
production API.

## Troubleshooting

### "Internet connection appears to be offline" / QR code not working

1. **Tunnel mode (most reliable across networks):**
   ```bash
   npx expo start --tunnel
   ```
   Or press `s` in the Expo CLI and select tunnel. Requires `npx expo login`.

2. **LAN mode** when phone and computer share Wi‑Fi:
   ```bash
   npx expo start --lan
   ```

3. **Verify network:**
   - Same Wi‑Fi for LAN mode
   - Mac IP: `ipconfig getifaddr en0` or `ifconfig | grep "inet "`
   - Test from the phone browser: `http://YOUR_COMPUTER_IP:8081`

4. **Firewall:** temporarily allow Node/Expo through macOS/Windows firewall to test

5. **Clear cache:**
   ```bash
   npx expo start --clear
   ```

### "Cannot connect to development server"

- `npx expo start --clear`
- Try `--tunnel`
- Confirm nothing else is bound to port 8081: `lsof -i :8081`

### Expo Go not showing your app

- Wait until Metro has fully started
- Same Expo account when using tunnel
- Restart Expo Go

### Quick Debugging Commands

```bash
lsof -i :8081
ipconfig getifaddr en0          # Mac Wi‑Fi IP
lsof -ti:8081 | xargs kill -9   # free port 8081
```

## Recommended Setup

1. **Phone on another network / flaky LAN:** `npx expo start --tunnel`
2. **Simulator:** `npx expo start --ios`
3. **Expo account (for tunnel):** `npx expo login`

> For Metro crashes and `EMFILE: too many open files`, see
> [metro-troubleshooting.md](./metro-troubleshooting.md).
