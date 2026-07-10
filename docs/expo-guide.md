# Expo Go Connection Guide

How to run the Nourishare Expo app and connect a phone or simulator, plus
troubleshooting for the common "Internet connection appears to be offline" /
QR-code issues.

## Connecting to the App

### Option 1: Scan QR Code (Easiest)

1. **Start Expo with tunnel mode:**
   ```bash
   npx expo start --tunnel
   ```
   (Requires a free Expo account.)

2. **In the Expo Go app:**
   - Open Expo Go
   - Tap the **"Scan QR code"** button on the home screen
   - Point the camera at the QR code in your terminal
   - Wait for the app to load

### Option 2: Connect via the Expo Go Home Screen

1. **Start Expo with LAN mode:**
   ```bash
   npx expo start --lan
   ```

2. **In the Expo Go app:**
   - Look at the **home screen** of Expo Go
   - Your app should be listed under **"Recently opened"** or **"Development servers"**
   - Tap it to connect

### Option 3: Share / Enter the URL Manually (iOS/Android)

1. After starting Expo, look for a line like: `exp://192.168.1.118:8081`
2. Share or enter it:
   - **iOS:** AirDrop the URL or paste it in Notes and tap the link
   - **Android:** Share the URL via any app (Messages, Email, etc.)
   - **Manual entry:** In Expo Go tap "Enter URL manually" and enter
     `exp://YOUR_COMPUTER_IP:8081` (e.g. `exp://192.168.1.100:8081`)

### Option 4: iOS Simulator / Android Emulator (Local Testing)

```bash
npx expo start --ios       # or press 'i' when Metro is running (Mac only)
npx expo start --android   # or press 'a' when Metro is running
```

### Option 5: Custom Development Build

If you have a custom development build, open your custom dev client app and it
should automatically connect to the running Metro bundler.

## Troubleshooting

### "Internet connection appears to be offline" / QR code not working

This is the most common issue. Try these in order:

1. **Use tunnel mode (most reliable).** Routes the connection through Expo's
   servers, so it works even across different networks:
   ```bash
   npx expo start --tunnel
   ```
   Or press `s` when Expo is running and select "tunnel". Requires a free Expo
   account (`npx expo login`).

2. **Use LAN mode explicitly** (when both devices share the same WiFi):
   ```bash
   npx expo start --lan
   ```

3. **Verify the network connection:**
   - Confirm phone and computer are on the **same WiFi network**.
   - Check your computer's IP address:
     - Mac/Linux: `ifconfig | grep "inet "` or `ipconfig getifaddr en0`
     - Windows: `ipconfig`
   - Make sure the IP in the QR code matches your computer's IP.
   - Test connectivity from your phone's browser: `http://YOUR_COMPUTER_IP:8081`.
     If it fails, there's a network/firewall issue.

4. **Check firewall settings:**
   - **macOS:** System Preferences > Security & Privacy > Firewall (temporarily
     turn off to test).
   - **Windows:** Allow Node.js and Expo through Windows Defender Firewall
     (Control Panel > Windows Defender Firewall > Allow an app).

5. **Restart Metro with a clear cache:**
   ```bash
   npx expo start --clear -c
   ```

### "Cannot connect to development server"

- Restart Expo: `npx expo start --clear -c`
- Try tunnel mode: `npx expo start --tunnel`
- Check that port 8081 is accessible

### Expo Go not showing your app

- Make sure Expo is running and the Metro bundler has started
- Check that you're logged into the same Expo account (if using tunnel)
- Try restarting the Expo Go app on your phone

### Quick Debugging Commands

```bash
# Check if port 8081 is in use
lsof -i :8081

# Check your IP address
ifconfig | grep "inet "   # Mac/Linux
ipconfig                  # Windows

# Kill any process using port 8081
lsof -ti:8081 | xargs kill -9   # Mac/Linux
```

## Recommended Setup for Development

1. **For mobile device testing:** use tunnel mode
   ```bash
   npx expo start --tunnel
   ```
2. **For simulator/emulator:** use local mode
   ```bash
   npx expo start --ios    # or --android
   ```
3. **Create a free Expo account** if you want to use tunnel mode:
   ```bash
   npx expo login
   ```

> For Metro bundler crashes and the `EMFILE: too many open files` error, see
> [metro-troubleshooting.md](./metro-troubleshooting.md).
