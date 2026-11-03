#!/usr/bin/env bash
set -e

echo "========================================================"
echo "   ClipSync - Building Android APK (Native Gradle)"
echo "========================================================"
echo ""

# 1. Build frontend distribution
echo "[1/3] Building frontend assets with Vite..."
npm run build

# 2. Sync to Android project
echo "[2/3] Syncing assets to native Android project..."
npx cap sync android

# 3. Build APK
echo "[3/3] Compiling Android APK with Gradle..."
if [ -f "android/gradlew" ]; then
    chmod +x android/gradlew
    cd android
    ./gradlew assembleDebug
    echo ""
    echo "========================================================"
    echo "SUCCESS! Android APK built at:"
    echo "  android/app/build/outputs/apk/debug/app-debug.apk"
    echo "========================================================"
else
    echo "Gradle wrapper not found in android/."
fi
