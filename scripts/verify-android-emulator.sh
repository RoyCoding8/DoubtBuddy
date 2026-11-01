#!/usr/bin/env bash
set -uo pipefail

mkdir -p evidence
status=0

if adb install -r app/build/outputs/apk/debug/app-debug.apk &&
   adb shell am start -W -n dev.doubtbuddy/.MainActivity; then
  sleep 4
  if adb shell uiautomator dump /sdcard/doubtbuddy-home.xml &&
     adb exec-out cat /sdcard/doubtbuddy-home.xml > evidence/android-home.xml &&
     grep -Fq 'What are you stuck on?' evidence/android-home.xml; then
    adb exec-out screencap -p > evidence/android-home.png || status=1
    test -s evidence/android-home.png || status=1
  else
    printf 'DoubtBuddy question screen was not visible before screenshot\n' >&2
    status=1
  fi
else
  status=1
fi

./gradlew --no-daemon :app:connectedDebugAndroidTest || status=$?
adb logcat -d -t 900 > evidence/android-last-logcat.txt || true
printf 'Android emulator verification exit code: %s\n' "$status"
exit "$status"
