#!/usr/bin/env bash
set -e

echo "========================================================"
echo "   ClipSync - Building Android APK (Serverless Wi-Fi)"
echo "========================================================"
echo ""

# Check for Flutter or Android SDK
if command -v flutter &> /dev/null; then
    echo "[1/2] Building Android APK with Flutter SDK..."
    if [ -d "flutter_app" ]; then
        cd flutter_app
        flutter pub get
        flutter build apk --release
        echo ""
        echo "SUCCESS! Android APK built at:"
        echo "  flutter_app/build/app/outputs/flutter-apk/app-release.apk"
    else
        echo "Flutter project folder not found."
    fi
else
    echo "Notice: Flutter CLI is not installed locally."
    echo "You can either:"
    echo "1. Run GitHub Actions: push to GitHub and the APK builds automatically for free!"
    echo "2. Install Flutter (https://flutter.dev) and run: flutter build apk --release"
fi
