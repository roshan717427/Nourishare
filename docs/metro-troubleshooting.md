# Metro / Build Troubleshooting

## EMFILE: Too Many Open Files Error

This error occurs on macOS when the system limit for open file descriptors is too low for Metro bundler.

### Quick Fix (Temporary)
```bash
ulimit -n 4096
npm start
```

### Permanent Fix (macOS)

1. **Check current limit:**
```bash
ulimit -n
```

2. **Increase the limit permanently:**
   - Edit or create `~/.zshrc` (for Zsh) or `~/.bash_profile` (for Bash):
```bash
echo "ulimit -n 4096" >> ~/.zshrc
source ~/.zshrc
```

   - Or for a system-wide fix, create/edit `/etc/launchd.conf`:
```bash
sudo nano /etc/launchd.conf
```
   Add: `limit maxfiles 4096 8192`

   - Then restart your computer or run:
```bash
launchctl limit maxfiles 4096 8192
```

3. **Alternative: Use Watchman (Recommended)**
```bash
brew install watchman
```

Watchman is Facebook's file watching service and handles file watching more efficiently than the default Node.js watcher.

After installing watchman, restart your terminal and run:
```bash
npm start
```

## React Native Version Mismatch

If you see warnings about React Native version mismatches:

```bash
npm install react-native@0.73.6
npm install
```

## Clear Expo Cache

If you encounter weird errors or build issues:

```bash
# Clear Expo cache
expo start -c

# Or clear everything
rm -rf node_modules
rm -rf .expo
npm install
expo start -c
```

## Metro Bundler Issues

If Metro bundler is slow or crashes:

1. Check `.watchmanconfig` exists (it should)
2. Restart watchman: `watchman shutdown-server`
3. Clear Metro cache: `expo start -c`

> For device connection and QR-code issues, see [expo-guide.md](./expo-guide.md).
