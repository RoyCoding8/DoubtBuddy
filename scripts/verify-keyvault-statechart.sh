#!/usr/bin/env bash
set -euo pipefail

repo="$(cd "$(dirname "$0")/.." && pwd)"
scratch="$(mktemp -d)"
trap 'rm -rf "$scratch"' EXIT
mkdir -p "$repo/evidence/keyvault-statechart"
cp "$repo/formal/KeyVaultReplacement.tla" "$repo/formal/KeyVaultReplacement.cfg" "$repo/formal/KeyVaultReplacementLegacy.cfg" "$scratch/"
export TLA2TOOLS="$scratch/tla2tools.jar"
curl --fail --location --silent --show-error --retry 3 \
    "https://github.com/tlaplus/tlaplus/releases/download/v1.7.4/tla2tools.jar" -o "$TLA2TOOLS"
echo "936a262061c914694dfd669a543be24573c45d5aa0ff20a8b96b23d01e050e88  $TLA2TOOLS" | sha256sum --check

set +e
node "$repo/pstack/skills/statechart/scripts/statechart.ts" "$scratch/KeyVaultReplacement.tla" \
    --config "$scratch/KeyVaultReplacementLegacy.cfg" --view "$repo/formal/keyvault-view.mjs" \
    --out "$scratch/legacy-chart" > "$scratch/legacy.log" 2>&1
legacy_status=$?
set -e
cat "$scratch/legacy.log"
test "$legacy_status" -eq 1
grep -q "FailedUpdateKeepsOldKey" "$scratch/legacy-chart/report.md"
cp "$scratch/legacy-chart/report.md" "$repo/evidence/keyvault-statechart/legacy-report.md"
cp "$scratch/legacy-chart/chart.mmd" "$repo/evidence/keyvault-statechart/legacy-chart.mmd"

node "$repo/pstack/skills/statechart/scripts/statechart.ts" "$scratch/KeyVaultReplacement.tla" \
    --config "$scratch/KeyVaultReplacement.cfg" --view "$repo/formal/keyvault-view.mjs" \
    --out "$scratch/fixed-chart"
cp "$scratch/fixed-chart/report.md" "$repo/evidence/keyvault-statechart/fixed-report.md"
cp "$scratch/fixed-chart/chart.mmd" "$repo/evidence/keyvault-statechart/fixed-chart.mmd"
echo "PASS: failed legacy replacement loses the old key; atomic replacement preserves it"
