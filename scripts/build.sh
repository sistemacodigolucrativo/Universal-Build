#!/usr/bin/env bash
# Variáveis exigidas: UB_KIND, UB_PROJECT_DIR, UB_TARGET, UB_MODULE e RUNNER_TEMP.
set -euo pipefail
: "${UB_KIND:?}"
: "${UB_PROJECT_DIR:?}"
: "${UB_TARGET:?}"
: "${RUNNER_TEMP:?}"
UB_MODULE="${UB_MODULE:-app}"
[[ "$UB_MODULE" =~ ^[a-zA-Z0-9_]+$ ]] || { echo "Módulo Gradle inválido" >&2; exit 2; }
case "$UB_TARGET" in apk|aab|both|release-apk) ;; *) echo "Alvo inválido: $UB_TARGET" >&2; exit 2;; esac
project="$(realpath "$UB_PROJECT_DIR")"
workspace="$(realpath "$GITHUB_WORKSPACE")"
[[ "$project" == "$workspace" || "$project" == "$workspace/"* ]] || { echo "Pasta fora do workspace" >&2; exit 2; }

out="$RUNNER_TEMP/ub-artifacts"
mkdir -p "$out"
want_apk=false
want_release=false
case "$UB_TARGET" in
  apk) want_apk=true ;;
  aab|release-apk) want_release=true ;;
  both) want_apk=true; want_release=true ;;
esac

# O projeto precisa configurar sua release signing lendo as variáveis UNIVERSAL_*.
if [[ "$want_release" == true ]]; then
  for item in UB_KEYSTORE_BASE64 UB_KEYSTORE_PASSWORD UB_KEY_ALIAS UB_KEY_PASSWORD; do
    [[ -n "${!item:-}" ]] || { echo "Para release assinada configure os quatro secrets ANDROID_KEYSTORE_* no repositório do aplicativo." >&2; exit 3; }
  done
  export UNIVERSAL_STORE_FILE="$RUNNER_TEMP/universal-release.jks"
  export UNIVERSAL_STORE_PASSWORD="$UB_KEYSTORE_PASSWORD"
  export UNIVERSAL_KEY_ALIAS="$UB_KEY_ALIAS"
  export UNIVERSAL_KEY_PASSWORD="$UB_KEY_PASSWORD"
  printf '%s' "$UB_KEYSTORE_BASE64" | base64 --decode > "$UNIVERSAL_STORE_FILE"
  chmod 600 "$UNIVERSAL_STORE_FILE"
  # Compatibilidade com projetos Flutter que já leem android/key.properties.
  if [[ "$UB_KIND" == flutter ]]; then
    cat > "$project/android/key.properties" <<KEYS
storePassword=$UNIVERSAL_STORE_PASSWORD
keyPassword=$UNIVERSAL_KEY_PASSWORD
keyAlias=$UNIVERSAL_KEY_ALIAS
storeFile=$UNIVERSAL_STORE_FILE
KEYS
    chmod 600 "$project/android/key.properties"
  fi
fi

gradle_build() {
  local android_dir="$1" task="$2"
  cd "$android_dir"
  [[ -f gradlew ]] || { echo "Gradle Wrapper ausente em $android_dir" >&2; exit 2; }
  chmod +x gradlew
  ./gradlew --no-daemon ":$UB_MODULE:$task"
}
install_js_deps() {
  cd "$project"
  if [[ -f pnpm-lock.yaml ]]; then
    corepack enable && pnpm install --frozen-lockfile
  elif [[ -f yarn.lock ]]; then
    corepack enable && yarn install --frozen-lockfile
  elif [[ -f package-lock.json ]]; then
    npm ci
  else
    npm install
  fi
}
case "$UB_KIND" in
  flutter)
    cd "$project"
    flutter pub get
    if [[ "$want_apk" == true ]]; then flutter build apk --debug; fi
    if [[ "$want_release" == true ]]; then
      if [[ "$UB_TARGET" == release-apk ]]; then flutter build apk --release
      else flutter build appbundle --release; fi
    fi
    outputs="$project/build/app/outputs"
    ;;
  react-native|android)
    android_dir="$project"
    if [[ "$UB_KIND" == react-native ]]; then
      install_js_deps
      android_dir="$project/android"
    fi
    if [[ "$want_apk" == true ]]; then gradle_build "$android_dir" assembleDebug; fi
    if [[ "$want_release" == true ]]; then
      if [[ "$UB_TARGET" == release-apk ]]; then gradle_build "$android_dir" assembleRelease
      else gradle_build "$android_dir" bundleRelease; fi
    fi
    outputs="$android_dir/$UB_MODULE/build/outputs"
    ;;
  *) echo "Tecnologia não suportada: $UB_KIND" >&2; exit 2 ;;
esac

copy_result() {
  local pattern="$1" name="$2" path
  path="$(find "$outputs" -type f -name "$pattern" -print -quit 2>/dev/null || true)"
  [[ -n "$path" && -s "$path" ]] || { echo "Arquivo esperado não produzido: $pattern (em $outputs)" >&2; exit 4; }
  if [[ "$name" == *.aab ]]; then
    jarsigner -verify -strict "$path" >/dev/null || { echo "AAB não possui assinatura verificável" >&2; exit 4; }
    # Para novos apps Android mobile, Google Play exige API de destino >= 36 desde agosto/2026.
    # Validação no manifesto compilado, não apenas no build.gradle original.
    local bundletool="$RUNNER_TEMP/bundletool-all-1.18.3.jar" required_api=36 target_api version_code
    curl --fail --location --silent --show-error --retry 3 \
      "https://github.com/google/bundletool/releases/download/1.18.3/bundletool-all-1.18.3.jar" \
      --output "$bundletool"
    [[ -s "$bundletool" ]] || { echo "bundletool indisponível; não é possível validar o AAB." >&2; exit 4; }
    target_api="$(java -jar "$bundletool" dump manifest --bundle="$path" --xpath='/manifest/uses-sdk/@android:targetSdkVersion' | tr -dc '0-9')"
    version_code="$(java -jar "$bundletool" dump manifest --bundle="$path" --xpath='/manifest/@android:versionCode' | tr -dc '0-9')"
    [[ "$target_api" =~ ^[0-9]+$ && "$target_api" -ge "$required_api" ]] || {
      echo "AAB incompatível com Google Play: targetSdk=$target_api; mínimo exigido: API $required_api." >&2
      exit 4
    }
    [[ "$version_code" =~ ^[0-9]+$ && "$version_code" -gt 0 ]] || {
      echo "AAB inválido: versionCode ausente ou inválido." >&2; exit 4
    }
    echo "Play Store: AAB assinado, targetSdk=$target_api e versionCode=$version_code (não garante aprovação na loja)."
  elif [[ "$name" == release.apk ]]; then
    local verifier
    verifier="$(find "$ANDROID_HOME/build-tools" -type f -name apksigner -print | sort -V | tail -1)"
    [[ -x "$verifier" ]] || { echo "apksigner não encontrado" >&2; exit 4; }
    "$verifier" verify "$path" || { echo "APK release inválido ou não assinado" >&2; exit 4; }
  fi
  cp "$path" "$out/$name"
  echo "Arquivo produzido: $name"
}
if [[ "$want_apk" == true ]]; then copy_result '*-debug.apk' debug.apk; fi
if [[ "$want_release" == true ]]; then
  if [[ "$UB_TARGET" == release-apk ]]; then copy_result '*-release.apk' release.apk
  else copy_result '*.aab' release.aab; fi
fi
# Credenciais não são carregadas nos artefatos.
if [[ -n "${UNIVERSAL_STORE_FILE:-}" ]]; then rm -f "$UNIVERSAL_STORE_FILE"; fi
if [[ "$UB_KIND" == flutter && "$want_release" == true ]]; then rm -f "$project/android/key.properties"; fi
