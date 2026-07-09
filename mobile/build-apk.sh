#!/usr/bin/env bash
# Build a debug APK for QIK Anime (local, no EAS account required).
# Prerequisites (already satisfied in this environment):
#   - Android SDK at $ANDROID_HOME (platform-tools, platforms;android-34, build-tools;34.0.0)
#   - JDK 17
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
export JAVA_HOME="${JAVA_HOME:-C:\\Program Files\\Eclipse Adoptium\\jdk-17.0.19.10-hotspot}"

cd "$ROOT"

# 1. Generate the native android project from app.json (idempotent).
npx expo prebuild --platform android --no-install

# 2. Assemble a debug APK.
cd android
./gradlew assembleDebug --no-daemon

# 3. Locate the produced APK.
APK="$ROOT/android/app/build/outputs/apk/debug/app-debug.apk"
echo "=================================================="
echo "APK ready: $APK"
ls -lh "$APK"
echo "=================================================="
