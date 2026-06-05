#!/bin/bash
# Start Expo with proper cleanup

# Kill any existing Expo processes
pkill -f "expo start" 2>/dev/null
pkill -f "metro" 2>/dev/null
sleep 2

# Clear watchman warning
watchman watch-del '/Users/roshan/Munchable v4' 2>/dev/null
watchman watch-project '/Users/roshan/Munchable v4' 2>/dev/null

# Clear caches
rm -rf .expo node_modules/.cache .metro 2>/dev/null

# Start Expo in LAN mode with clean cache
echo "Starting Expo in LAN mode..."
echo "Waiting for QR code to appear..."
npx expo start --lan -c

