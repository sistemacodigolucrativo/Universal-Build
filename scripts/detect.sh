#!/usr/bin/env bash
# Retorna: android, flutter ou react-native.
set -euo pipefail
dir="${1:-.}"
[[ -d "$dir" ]] || { echo "Diretório não encontrado: $dir" >&2; exit 2; }
cd "$dir"
if [[ -f pubspec.yaml ]] && grep -Eq '^[[:space:]]*flutter:' pubspec.yaml; then
  echo flutter
elif [[ -f package.json && -d android ]] && grep -Eq '"react-native"[[:space:]]*:' package.json; then
  [[ -f android/settings.gradle || -f android/settings.gradle.kts ]] || { echo "Projeto React Native sem Gradle Android" >&2; exit 2; }
  echo react-native
elif [[ ( -f settings.gradle || -f settings.gradle.kts ) && ( -f build.gradle || -f build.gradle.kts || -d app ) ]]; then
  echo android
else
  echo "Tipo de projeto não reconhecido. Esperados: Flutter (pubspec.yaml), React Native (package.json + android/) ou Android Gradle (settings.gradle + gradlew)." >&2
  exit 2
fi
