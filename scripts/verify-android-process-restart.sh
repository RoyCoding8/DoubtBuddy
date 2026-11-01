#!/usr/bin/env bash
set -euo pipefail

mkdir -p evidence
adb shell am force-stop dev.doubtbuddy
adb shell am start -W -n dev.doubtbuddy/.MainActivity
sleep 3
adb shell uiautomator dump /sdcard/doubtbuddy-window.xml >/dev/null
adb exec-out cat /sdcard/doubtbuddy-window.xml > evidence/android-after-restart-ask.xml

location=$(python3 - <<'PY'
import re
import xml.etree.ElementTree as ET

root = ET.parse("evidence/android-after-restart-ask.xml").getroot()
for node in root.iter("node"):
    if node.get("text") == "Saved" or node.get("content-desc") == "Saved":
        bounds = list(map(int, re.findall(r"\d+", node.get("bounds", ""))))
        if len(bounds) == 4:
            print((bounds[0] + bounds[2]) // 2, (bounds[1] + bounds[3]) // 2)
            break
else:
    raise SystemExit("Saved navigation is missing after process restart")
PY
)
read -r x y <<< "$location"
adb shell input tap "$x" "$y"
sleep 2
adb shell uiautomator dump /sdcard/doubtbuddy-window.xml >/dev/null
adb exec-out cat /sdcard/doubtbuddy-window.xml > evidence/android-after-restart-saved.xml
adb exec-out screencap -p > evidence/android-history-after-restart.png

python3 - <<'PY'
import xml.etree.ElementTree as ET

root = ET.parse("evidence/android-after-restart-saved.xml").getroot()
values = [
    node.get("text", "") + " " + node.get("content-desc", "")
    for node in root.iter("node")
]
assert any("Saved answers" in value for value in values), "Saved history screen did not open"
assert any("What is Newton's second law?" in value for value in values), (
    "Offline answer is missing after full process termination"
)
print("PASS: saved answer survives Android process termination and relaunch")
PY
