#!/usr/bin/env bash
set -uo pipefail

mkdir -p evidence
status=0
gradle --no-daemon :app:connectedDebugAndroidTest || status=$?

if adb shell am start -n dev.doubtbuddy/.MainActivity; then
  sleep 5
  adb exec-out screencap -p > evidence/android-home.png || true
fi

adb logcat -d -t 900 > evidence/android-last-logcat.txt || true
printf 'Android instrumented test exit code: %s\n' "$status"
exit "$status"
