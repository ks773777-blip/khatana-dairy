#!/usr/bin/env bash
# Build a signed release APK for Khatana Dairy Manager without Gradle.
#
# Requirements (env vars, or edit the defaults below):
#   JAVA_HOME        -> a JDK 17 install
#   BUILD_TOOLS      -> Android build-tools dir (has aapt2, d8, apksigner, zipalign)
#   ANDROID_JAR      -> path to the platform android.jar
#
# Output: build/app-release.apk
set -euo pipefail
ulimit -v unlimited 2>/dev/null || true

HERE="$(cd "$(dirname "$0")/.." && pwd)"
JAVA_HOME="${JAVA_HOME:-/scratch/work/tool/jdk-17.0.20.1+1}"
BUILD_TOOLS="${BUILD_TOOLS:-/scratch/work/android-sdk/android-14}"
ANDROID_JAR="${ANDROID_JAR:-/scratch/work/android-sdk/android-34/android.jar}"

export JAVA_HOME
export PATH="$JAVA_HOME/bin:$PATH"
# The build box has a tight virtual-memory cap; keep the JVM small.
export _JAVA_OPTIONS="${_JAVA_OPTIONS:--Xmx512m -XX:MaxMetaspaceSize=160m -XX:ReservedCodeCacheSize=64m -XX:CompressedClassSpaceSize=64m -XX:+UseSerialGC -Xss512k}"

AAPT2="$BUILD_TOOLS/aapt2"
D8="$BUILD_TOOLS/d8"
APKSIGNER="$BUILD_TOOLS/apksigner"
ZIPALIGN="$BUILD_TOOLS/zipalign"

APP="$HERE/android/app/src/main"
OUT="$HERE/android/build"
rm -rf "$OUT"
mkdir -p "$OUT/classes" "$OUT/gen" "$OUT/dex"

echo ">> 1/6  compiling resources"
"$AAPT2" compile --dir "$APP/res" -o "$OUT/res.zip"

echo ">> 2/6  linking resources + assets"
"$AAPT2" link \
  -o "$OUT/base.apk" \
  -I "$ANDROID_JAR" \
  --manifest "$APP/AndroidManifest.xml" \
  -R "$OUT/res.zip" \
  --auto-add-overlay \
  -A "$APP/assets" \
  --java "$OUT/gen" \
  --min-sdk-version 24 \
  --target-sdk-version 34 \
  --version-code 1 \
  --version-name 1.0

echo ">> 3/6  compiling java"
SRCS=$(find "$APP/java" "$OUT/gen" -name '*.java')
javac -source 8 -target 8 -bootclasspath "$ANDROID_JAR" -classpath "$ANDROID_JAR" \
  -encoding UTF-8 -d "$OUT/classes" $SRCS 2>&1 | grep -v 'bootstrap class path\|source value 8\|target value 8\|deprecat' || true
test -f "$OUT/classes/com/khatana/dairymanager/MainActivity.class"

echo ">> 4/6  dexing"
CLASSES=$(find "$OUT/classes" -name '*.class')
"$D8" --lib "$ANDROID_JAR" --min-api 24 --output "$OUT/dex" $CLASSES

echo ">> 5/6  packaging"
cp "$OUT/base.apk" "$OUT/unsigned.apk"
( cd "$OUT/dex" && zip -q -j "$OUT/unsigned.apk" classes.dex )
"$ZIPALIGN" -f -p 4 "$OUT/unsigned.apk" "$OUT/aligned.apk"

echo ">> 6/6  signing"
KS="$HERE/android/keystore/release.keystore"
if [ ! -f "$KS" ]; then
  mkdir -p "$(dirname "$KS")"
  keytool -genkeypair -keystore "$KS" -alias khatana -keyalg RSA -keysize 2048 \
    -validity 10000 -storepass khatana123 -keypass khatana123 \
    -dname "CN=Khatana Dairy, O=Khatana, L=India, C=IN" >/dev/null 2>&1
fi
"$APKSIGNER" sign --ks "$KS" --ks-pass pass:khatana123 --key-pass pass:khatana123 \
  --out "$OUT/app-release.apk" "$OUT/aligned.apk"
"$APKSIGNER" verify --print-certs "$OUT/app-release.apk" | head -4

echo
echo "APK: $OUT/app-release.apk"
echo "Signing SHA-1 (register this in Google Cloud Console for Android OAuth):"
keytool -list -v -keystore "$KS" -alias khatana -storepass khatana123 2>/dev/null | grep -i 'SHA1:' | head -1
