#!/usr/bin/env bash
set -euo pipefail
base="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/native" "$tmp/flutter" "$tmp/rn/android"
touch "$tmp/native/settings.gradle" "$tmp/native/gradlew"
printf 'dependencies:\n  flutter:\n    sdk: flutter\n' > "$tmp/flutter/pubspec.yaml"
printf '{"dependencies":{"react-native":"0.76.0"}}' > "$tmp/rn/package.json"
touch "$tmp/rn/android/settings.gradle"
[[ "$(bash "$base/scripts/detect.sh" "$tmp/native")" == android ]]
[[ "$(bash "$base/scripts/detect.sh" "$tmp/flutter")" == flutter ]]
[[ "$(bash "$base/scripts/detect.sh" "$tmp/rn")" == react-native ]]
if bash "$base/scripts/detect.sh" "$tmp" >/dev/null 2>&1; then echo "Falha: projeto desconhecido foi aceito" >&2; exit 1; fi
echo 'Detecção: quatro cenários passaram.'
