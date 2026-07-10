#!/usr/bin/env bash
# Build a release APK for QIK Anime (local, no EAS account required).
# Prerequisites (already satisfied in the dev container):
#   - Android SDK at $ANDROID_HOME (platform-tools, platforms;android-34, build-tools;34.0.0)
#   - JDK 21 at $JAVA_HOME
#   - Node.js + npm
set -e

ROOT="$(cd "$(dirname "$0")" && pwd)"
export ANDROID_HOME="${ANDROID_HOME:-$HOME/android-sdk}"
export JAVA_HOME="${JAVA_HOME:-/usr/lib/jvm/java-21-openjdk}"

cd "$ROOT"

# 1. Install dependencies (babel-preset-expo is required for JS bundling).
echo ">>> Installing npm dependencies..."
npm install

# 2. Generate keystore (one-time, skipped if exists).
KEYSTORE="$ROOT/android/app/qik-anime.keystore"
KEYSTORE_PROPS="$ROOT/android/app/keystore.properties"
if [ ! -f "$KEYSTORE" ]; then
  echo ">>> Generating signing keystore (first time only)..."
  keytool -genkey -v \
    -keystore "$KEYSTORE" \
    -alias qik-anime \
    -keyalg RSA -keysize 2048 -validity 10000 \
    -storepass android \
    -keypass android \
    -dname "CN=QIK Anime, OU=Dev, O=QIK, L=Unknown, ST=Unknown, C=RU" \
    -noprompt
fi

cat > "$KEYSTORE_PROPS" << 'EOF'
storeFile=qik-anime.keystore
storePassword=android
keyAlias=qik-anime
keyPassword=android
EOF

# 3. Generate the native android project (regenerates android/ each time).
npx expo prebuild --platform android --no-install

# 4. Patch gradle-wrapper.properties to use a mirror (services.gradle.org is blocked).
GRADLE_PROPS="$ROOT/android/gradle/wrapper/gradle-wrapper.properties"
if grep -q "services.gradle.org" "$GRADLE_PROPS" 2>/dev/null; then
  echo ">>> Switching Gradle download to mirror..."
  sed -i 's|https\\://services.gradle.org/distributions/|https\\://mirrors.cloud.tencent.com/gradle/|' "$GRADLE_PROPS"
  sed -i 's|networkTimeout=10000|networkTimeout=120000|' "$GRADLE_PROPS"
  sed -i 's|validateDistributionUrl=true|validateDistributionUrl=false|' "$GRADLE_PROPS"
fi

# 5. Patch app/build.gradle to add release signing config.
APP_BUILD_GRADLE="$ROOT/android/app/build.gradle"
if ! grep -q "keystore.properties" "$APP_BUILD_GRADLE" 2>/dev/null; then
  echo ">>> Patching build.gradle with release signing config..."

  python3 - "$APP_BUILD_GRADLE" << 'PYEOF'
import sys

path = sys.argv[1]
with open(path, 'r') as f:
    content = f.read()

old = '''    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            // Caution! In production, you need to generate your own keystore file.
            // see https://reactnative.dev/docs/signed-apk-android.
            signingConfig signingConfigs.debug'''

new = '''    signingConfigs {
        debug {
            storeFile file('debug.keystore')
            storePassword 'android'
            keyAlias 'androiddebugkey'
            keyPassword 'android'
        }
        release {
            def keystorePropsFile = rootProject.file("app/keystore.properties")
            if (keystorePropsFile.exists()) {
                def keystoreProps = new Properties()
                keystoreProps.load(new FileInputStream(keystorePropsFile))
                storeFile rootProject.file("app/${keystoreProps['storeFile']}")
                storePassword keystoreProps['storePassword']
                keyAlias keystoreProps['keyAlias']
                keyPassword keystoreProps['keyPassword']
            } else {
                storeFile file('debug.keystore')
                storePassword 'android'
                keyAlias 'androiddebugkey'
                keyPassword 'android'
            }
        }
    }
    buildTypes {
        debug {
            signingConfig signingConfigs.debug
        }
        release {
            signingConfig signingConfigs.release'''

if old not in content:
    print("ERROR: Could not find the expected signingConfigs block in build.gradle.")
    print("The build.gradle template may have changed. Please update the patch manually.")
    sys.exit(1)

content = content.replace(old, new)

with open(path, 'w') as f:
    f.write(content)

print("Patched build.gradle with release signing config.")
PYEOF "$APP_BUILD_GRADLE"
fi

# 6. Assemble a release APK (JS bundle is packaged inside — no Metro needed).
cd "$ROOT/android"
./gradlew assembleRelease --no-daemon

# 7. Copy APK to mobile/ root.
APK="$ROOT/android/app/build/outputs/apk/release/app-release.apk"
cp "$APK" "$ROOT/QIK-Anime-release.apk"
echo "=================================================="
echo "APK ready: $ROOT/QIK-Anime-release.apk"
ls -lh "$ROOT/QIK-Anime-release.apk"
echo ""
echo "This is a RELEASE APK — JS bundle is inside, no Metro server needed."
echo "Transfer it to your device and install."
echo "=================================================="
