#!/usr/bin/env bash
set -uo pipefail

mkdir -p evidence
status=0
./gradlew --no-daemon :app:connectedDebugAndroidTest || status=$?

if adb install -r app/build/outputs/apk/debug/app-debug.apk &&
   adb shell am start -n dev.doubtbuddy/.MainActivity; then
  sleep 5
  adb exec-out screencap -p > evidence/android-home.png || status=1
  test -s evidence/android-home.png || status=1
else
  status=1
fi

adb logcat -d -t 900 > evidence/android-last-logcat.txt || true
printf 'Android instrumented test exit code: %s\n' "$status"
exit "$status"
