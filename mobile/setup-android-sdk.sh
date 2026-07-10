#!/usr/bin/env bash
set -e
export ANDROID_HOME="$HOME/android-sdk"

# Already downloaded cmdline-tools, just need to install packages
echo ">>> Accepting licenses..."
yes | $ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --licenses --sdk_root="$ANDROID_HOME" 2>/dev/null
echo ">>> Installing SDK packages..."
$ANDROID_HOME/cmdline-tools/latest/bin/sdkmanager --sdk_root="$ANDROID_HOME" "platform-tools" "platforms;android-34" "build-tools;34.0.0"
echo ">>> Done."
ls -la "$ANDROID_HOME/"
