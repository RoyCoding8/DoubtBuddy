#!/usr/bin/env bash
set -uo pipefail

mkdir -p evidence
status=0

bash scripts/verify-android-process-restart.sh || status=$?
./gradlew --no-daemon :app:connectedDebugAndroidTest || status=$?
adb logcat -d -t 900 > evidence/android-last-logcat.txt || true
printf 'Android emulator verification exit code: %s\n' "$status"
exit "$status"
