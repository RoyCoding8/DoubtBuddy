#!/usr/bin/env bash
set -euo pipefail

mkdir -p evidence
adb install -r app/build/outputs/apk/debug/app-debug.apk

dump_ui() {
  adb shell uiautomator dump /sdcard/doubtbuddy-window.xml >/dev/null
  adb exec-out cat /sdcard/doubtbuddy-window.xml > evidence/android-current.xml
}

tap_node() {
  local label="$1" position
  position=$(python3 - "$label" <<'PY'
import re
import sys
import xml.etree.ElementTree as ET

label = sys.argv[1]
root = ET.parse("evidence/android-current.xml").getroot()
for node in root.iter("node"):
    match = (node.get("class") == "android.widget.EditText" if label == "__editor__"
             else node.get("text") == label or node.get("content-desc") == label)
    if match:
        bounds = list(map(int, re.findall(r"\d+", node.get("bounds", ""))))
        if len(bounds) == 4:
            print((bounds[0] + bounds[2]) // 2, (bounds[1] + bounds[3]) // 2)
            break
else:
    raise SystemExit(f"UI node not found: {label}")
PY
)
  read -r x y <<< "$position"
  adb shell input tap "$x" "$y"
}

open_ask() {
  for attempt in 1 2 3; do
    adb shell am start -W -n dev.doubtbuddy/.MainActivity
    sleep 3
    dump_ui
    if grep -Fq "Pixel Launcher isn't responding" evidence/android-current.xml; then
      tap_node "Close app"
      continue
    fi
    if grep -Fq "What are you stuck on?" evidence/android-current.xml; then
      return 0
    fi
  done
  printf 'DoubtBuddy question screen did not open\n' >&2
  return 1
}

open_ask
tap_node "__editor__"
adb shell input text ProcessRestartProof123
adb shell input keyevent KEYCODE_BACK
dump_ui
tap_node "Solve question"
sleep 3
dump_ui
grep -Fq "Your answer" evidence/android-current.xml || {
  printf 'Offline answer did not render\n' >&2
  exit 1
}

adb shell am force-stop dev.doubtbuddy
open_ask
tap_node "Saved"
sleep 2
dump_ui
cp evidence/android-current.xml evidence/android-history-after-restart.xml
adb exec-out screencap -p > evidence/android-history-after-restart.png
grep -Fq "Saved answers" evidence/android-history-after-restart.xml
grep -Fq "ProcessRestartProof123" evidence/android-history-after-restart.xml
printf 'PASS: saved answer survives Android process termination and relaunch\n'
