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

2. **Increase the limit for your shell** — edit `~/.zshrc` (Zsh) or `~/.bash_profile` (Bash):

```bash
echo "ulimit -n 4096" >> ~/.zshrc
source ~/.zshrc
```

3. **Recommended: use Watchman**

```bash
brew install watchman
```

After installing Watchman, restart the terminal and run:

```bash
npm start
```

## React Native / Expo Version Issues

This project pins versions via Expo SDK **54** (`react-native@0.81.x` in `package.json`).
Do **not** manually install an arbitrary React Native version (e.g. an old `0.73.x`).

If you see version mismatch warnings:

```bash
npx expo install --fix
npm install
```

## Clear Expo / Metro Cache

```bash
npx expo start -c

# Or a full reset
rm -rf node_modules .expo
npm install
npx expo start -c
```

## Metro Bundler Issues

If Metro is slow or crashes:

1. Confirm `.watchmanconfig` exists
2. Restart Watchman: `watchman shutdown-server`
3. Clear cache: `npx expo start -c`

> For device connection and QR-code issues, see [expo-guide.md](./expo-guide.md).
