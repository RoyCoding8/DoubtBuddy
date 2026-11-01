#!/usr/bin/env bash
set -uo pipefail

mkdir -p evidence
status=0

if adb install -r app/build/outputs/apk/debug/app-debug.apk &&
   adb shell am start -W -n dev.doubtbuddy/.MainActivity; then
  sleep 4
  if adb shell dumpsys window | grep -E 'mCurrentFocus.*dev\.doubtbuddy'; then
    adb exec-out screencap -p > evidence/android-home.png || status=1
    test -s evidence/android-home.png || status=1
  else
    printf 'DoubtBuddy is not the foreground activity before screenshot\n' >&2
    status=1
  fi
else
  status=1
fi

./gradlew --no-daemon :app:connectedDebugAndroidTest || status=$?
adb logcat -d -t 900 > evidence/android-last-logcat.txt || true
printf 'Android emulator verification exit code: %s\n' "$status"
exit "$status"
