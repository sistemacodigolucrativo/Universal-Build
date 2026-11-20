#!/usr/bin/env bash
# Variáveis exigidas: UB_KIND, UB_PROJECT_DIR, UB_TARGET, UB_MODULE e RUNNER_TEMP.
set -euo pipefail
: "${UB_KIND:?}"
: "${UB_PROJECT_DIR:?}"
: "${UB_TARGET:?}"
: "${RUNNER_TEMP:?}"
UB_MODULE="${UB_MODULE:-app}"
[[ "$UB_MODULE" =~ ^[a-zA-Z0-9_]+$ ]] || { echo "Módulo Gradle inválido" >&2; exit 2; }
case "$UB_TARGET" in apk|aab|both|release-apk|aab-unsigned|both-unsigned) ;; *) echo "Alvo inválido: $UB_TARGET" >&2; exit 2;; esac
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
  both|both-unsigned) want_apk=true; want_release=true ;;
  aab-unsigned) want_release=true ;;
esac

# O projeto precisa configurar sua release signing lendo as variáveis UNIVERSAL_*.
if [[ "$want_release" == true && "$UB_TARGET" != aab-unsigned && "$UB_TARGET" != both-unsigned ]]; then
  for item in UB_KEYSTORE_BASE64 UB_KEYSTORE_PASSWORD UB_KEY_ALIAS UB_KEY_PASSWORD; do
    [[ -n "${!item:-}" ]] || { echo "Para release assinada configure os quatro secrets ANDROID_KEYSTORE_* no repositório do aplicativo." >&2; exit 3; }
  done
  export UNIVERSAL_STORE_FILE="$RUNNER_TEMP/universal-release.jks"
  export UNIVERSAL_STORE_PASSWORD="$UB_KEYSTORE_PASSWORD"
  export UNIVERSAL_KEY_ALIAS="$UB_KEY_ALIAS"
  export UNIVERSAL_KEY_PASSWORD="$UB_KEY_PASSWORD"
  printf '%s' "$UB_KEYSTORE_BASE64" | base64 --decode > "$UNIVERSAL_STORE_FILE"
  chmod 600 "$UNIVERSAL_STORE_FILE"
  # Suportar os dois contratos: Universal-Build legado e app Kotlin/Compose.
  export ANDROID_KEYSTORE_PATH="$UNIVERSAL_STORE_FILE"
  export ANDROID_KEYSTORE_PASSWORD="$UNIVERSAL_STORE_PASSWORD"
  export ANDROID_KEY_ALIAS="$UNIVERSAL_KEY_ALIAS"
  export ANDROID_KEY_PASSWORD="$UNIVERSAL_KEY_PASSWORD"
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
  if [[ -f gradlew ]]; then
    chmod +x gradlew
    ./gradlew --no-daemon ":$UB_MODULE:$task"
  else
    echo "Gradle Wrapper não encontrado: usando Gradle provisionado pelo GitHub Actions (compatibilidade dependente do projeto)."
    gradle --no-daemon ":$UB_MODULE:$task"
  fi
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
# Gradle sem flavors permanece inalterado. O Kotlin Master define dev/staging/prod
# e, no modo automático, gera debug em dev e release em prod.
gradle_debug_task=assembleDebug
gradle_release_bundle_task=bundleRelease
gradle_release_apk_task=assembleRelease
gradle_debug_dir=apk/debug
gradle_release_bundle_dir=bundle/release
gradle_release_apk_dir=apk/release

resolve_gradle_variant() {
  local android_dir="$1" choice="${UB_FLAVOR:-auto}" build_file
  case "$choice" in auto|dev|staging|prod) ;; *) echo "Flavor inválido: $choice" >&2; exit 2;; esac
  local debug_flavor="" release_flavor=""
  if [[ "$choice" != auto ]]; then
    debug_flavor="$choice"
    release_flavor="$choice"
  else
    build_file="$android_dir/$UB_MODULE/build.gradle.kts"
    if [[ -f "$android_dir/app-config.properties" && -f "$build_file" ]] &&
       grep -Fq 'create("dev")' "$build_file" &&
       grep -Fq 'create("prod")' "$build_file"; then
      debug_flavor=dev
      release_flavor=prod
      echo "Kotlin Master: flavors automáticos (APK devDebug; AAB/release prodRelease)"
    fi
  fi
  if [[ -n "$debug_flavor" ]]; then
    local debug_cap="${debug_flavor^}" release_cap="${release_flavor^}"
    gradle_debug_task="assemble${debug_cap}Debug"
    gradle_release_bundle_task="bundle${release_cap}Release"
    gradle_release_apk_task="assemble${release_cap}Release"
    gradle_debug_dir="apk/$debug_flavor/debug"
    gradle_release_bundle_dir="bundle/${release_flavor}Release"
    gradle_release_apk_dir="apk/$release_flavor/release"
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
    resolve_gradle_variant "$android_dir"
    if [[ "$want_apk" == true ]]; then gradle_build "$android_dir" "$gradle_debug_task"; fi
    if [[ "$want_release" == true ]]; then
      if [[ "$UB_TARGET" == release-apk ]]; then gradle_build "$android_dir" "$gradle_release_apk_task"
      else gradle_build "$android_dir" "$gradle_release_bundle_task"; fi
    fi
    outputs="$android_dir/$UB_MODULE/build/outputs"
    ;;
  *) echo "Tecnologia não suportada: $UB_KIND" >&2; exit 2 ;;
esac

copy_result() {
  local pattern="$1" name="$2" path directory="$outputs"
  [[ -z "${3:-}" ]] || directory="$outputs/$3"
  path="$(find "$directory" -type f -name "$pattern" -print -quit 2>/dev/null || true)"
  [[ -n "$path" && -s "$path" ]] || { echo "Arquivo esperado não produzido: $pattern (em $directory)" >&2; exit 4; }
  if [[ "$name" == *.aab || "$name" == unsigned.aab ]]; then
    if [[ "$name" == unsigned.aab ]]; then
      local unsigned_report
      unsigned_report="$(jarsigner -verify "$path" 2>&1 || true)"
      [[ "$unsigned_report" == *"jar is unsigned"* ]] || {
        echo "AAB esperado sem assinatura, mas a configuração Gradle produziu um AAB assinado. Remova o signingConfig de release para o modo unsigned." >&2; exit 4
      }
    else
      # -strict falha com certificados autoassinados de upload, que são válidos para Play App Signing.
      # Confirmar o texto de verificação evita falsos positivos em arquivos sem assinatura.
      local signature_report
      signature_report="$(jarsigner -verify "$path" 2>&1)" || {
        echo "AAB com assinatura inválida: $signature_report" >&2; exit 4
      }
      [[ "$signature_report" == *"jar verified"* ]] || {
        echo "AAB sem assinatura verificável: $signature_report" >&2; exit 4
      }

    fi
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
    echo "Play Store: AAB validado (assinatura: $name), targetSdk=$target_api e versionCode=$version_code (não garante aprovação na loja)."
  elif [[ "$name" == release.apk ]]; then
    local verifier
    verifier="$(find "$ANDROID_HOME/build-tools" -type f -name apksigner -print | sort -V | tail -1)"
    [[ -x "$verifier" ]] || { echo "apksigner não encontrado" >&2; exit 4; }
    "$verifier" verify "$path" || { echo "APK release inválido ou não assinado" >&2; exit 4; }
  fi
  cp "$path" "$out/$name"
  echo "Arquivo produzido: $name"
}
# Seleção exata por variante: não capturar outro flavor por ordem arbitrária do find.
result_debug_dir="" result_release_bundle_dir="" result_release_apk_dir=""
if [[ "$UB_KIND" != flutter ]]; then
  result_debug_dir="$gradle_debug_dir"
  result_release_bundle_dir="$gradle_release_bundle_dir"
  result_release_apk_dir="$gradle_release_apk_dir"
fi
if [[ "$want_apk" == true ]]; then copy_result '*-debug.apk' debug.apk "$result_debug_dir"; fi
if [[ "$want_release" == true ]]; then
  if [[ "$UB_TARGET" == release-apk ]]; then copy_result '*-release.apk' release.apk "$result_release_apk_dir"
  elif [[ "$UB_TARGET" == aab-unsigned || "$UB_TARGET" == both-unsigned ]]; then copy_result '*.aab' unsigned.aab "$result_release_bundle_dir"
  else copy_result '*.aab' release.aab "$result_release_bundle_dir"; fi
fi
# Credenciais não são carregadas nos artefatos.
if [[ -n "${UNIVERSAL_STORE_FILE:-}" ]]; then rm -f "$UNIVERSAL_STORE_FILE"; fi
if [[ "$UB_KIND" == flutter && -n "${UNIVERSAL_STORE_FILE:-}" ]]; then rm -f "$project/android/key.properties"; fi
