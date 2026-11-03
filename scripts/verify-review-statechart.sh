#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
mkdir -p "$repo/evidence/review-statechart"
cp "$repo/formal/ReviewVisibility.tla" "$repo/formal/ReviewVisibility.cfg" "$repo/formal/ReviewVisibilityLegacy.cfg" "$scratch/"
export TLA2TOOLS="$scratch/tla2tools.jar"
curl --fail --location --silent --show-error --retry 3 \
    "https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar" -o "$TLA2TOOLS"
echo "936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88  $TLA2TOOLS" | sha256sum --check

set +e
node "$repo/pstack/skills/statechart/scripts/statechart.ts" "$scratch/ReviewVisibility.tla" \
    --config "$scratch/ReviewVisibilityLegacy.cfg" --view "$repo/formal/review-view.mjs" \
    --out "$scratch/legacy-chart" > "$scratch/legacy.log" 2>&1
legacy_status=$?
set -e
cat "$scratch/legacy.log"
test "$legacy_status" -eq 1
grep -q "OnlyCurrentQuestionRevealed" "$scratch/legacy-chart/report.md"
grep -q "a different question becomes due" "$scratch/legacy-chart/report.md"
cp "$scratch/legacy-chart/report.md" "$repo/evidence/review-statechart/legacy-report.md"
cp "$scratch/legacy-chart/chart.mmd" "$repo/evidence/review-statechart/legacy-chart.mmd"

node "$repo/pstack/skills/statechart/scripts/statechart.ts" "$scratch/ReviewVisibility.tla" \
    --config "$scratch/ReviewVisibility.cfg" --view "$repo/formal/review-view.mjs" \
    --out "$scratch/fixed-chart"
cp "$scratch/fixed-chart/report.md" "$repo/evidence/review-statechart/fixed-report.md"
cp "$scratch/fixed-chart/chart.mmd" "$repo/evidence/review-statechart/fixed-chart.mmd"
echo "PASS: legacy review state exposes another question; fixed review state holds its invariants"
