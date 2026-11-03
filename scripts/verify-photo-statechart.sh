#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
mkdir -p "$repo/evidence/photo-statechart"
cp "$repo/formal/PhotoSelection.tla" "$repo/formal/PhotoSelection.cfg" "$repo/formal/PhotoSelectionLegacy.cfg" "$scratch/"
export TLA2TOOLS="$scratch/tla2tools.jar"
curl --fail --location --silent --show-error --retry 3 \
    "https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar" -o "$TLA2TOOLS"
echo "936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88  $TLA2TOOLS" | sha256sum --check

set +e
node "$repo/pstack/skills/statechart/scripts/statechart.ts" "$scratch/PhotoSelection.tla" \
    --config "$scratch/PhotoSelectionLegacy.cfg" --view "$repo/formal/photo-view.mjs" \
    --out "$scratch/legacy-chart" > "$scratch/legacy.log" 2>&1
legacy_status=$?
set -e
cat "$scratch/legacy.log"
test "$legacy_status" -eq 1
grep -q "LatestPhotoWins" "$scratch/legacy-chart/report.md"
grep -q "RemovedPhotoStaysRemoved" "$scratch/legacy-chart/report.md"
grep -q "OldErrorsCannotReturn" "$scratch/legacy-chart/report.md"
grep -q "OldAnswerClearedDuringImport" "$scratch/legacy-chart/report.md"
cp "$scratch/legacy-chart/report.md" "$repo/evidence/photo-statechart/legacy-report.md"
cp "$scratch/legacy-chart/chart.mmd" "$repo/evidence/photo-statechart/legacy-chart.mmd"

node "$repo/pstack/skills/statechart/scripts/statechart.ts" "$scratch/PhotoSelection.tla" \
    --config "$scratch/PhotoSelection.cfg" --view "$repo/formal/photo-view.mjs" \
    --out "$scratch/fixed-chart"
cp "$scratch/fixed-chart/report.md" "$repo/evidence/photo-statechart/fixed-report.md"
if [ -f "$scratch/fixed-chart/chart.mmd" ]; then
    cp "$scratch/fixed-chart/chart.mmd" "$repo/evidence/photo-statechart/fixed-chart.mmd"
fi
echo "PASS: legacy photo races have counterexamples; revised photo transitions hold all invariants"
