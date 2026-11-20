#!/usr/bin/env bash
# Assina AAB já compilado, sem executar código do aplicativo.
set -euo pipefail
: "${RUNNER_TEMP:?}"
: "${UB_SOURCE_AAB:?}"
: "${UB_KEYSTORE_BASE64:?}"
: "${UB_KEYSTORE_PASSWORD:?}"
: "${UB_KEY_ALIAS:?}"
: "${UB_KEY_PASSWORD:?}"

src="$(realpath "$UB_SOURCE_AAB")"
[[ -f "$src" && -s "$src" && ! -L "$src" ]] || { echo "AAB de origem ausente ou inválido." >&2; exit 2; }
[[ "$src" == "$RUNNER_TEMP/"* ]] || { echo "AAB fora da pasta temporária permitida." >&2; exit 2; }
[[ "$src" == *.aab ]] || { echo "Formato inválido (esperado .aab)." >&2; exit 2; }

# Recusa arquivos já assinados; evita misturar certificados e mudar identidade.
report="$(jarsigner -verify "$src" 2>&1 || true)"
[[ "$report" == *"jar is unsigned"* ]] || { echo "Fonte já assinada ou inválida: use um AAB sem assinatura." >&2; exit 2; }
work="$RUNNER_TEMP/signing"
mkdir -p "$work"
trap 'rm -f "$work/upload.jks"' EXIT
printf '%s' "$UB_KEYSTORE_BASE64" | base64 --decode > "$work/upload.jks"
chmod 600 "$work/upload.jks"
jarsigner -keystore "$work/upload.jks" \
  -storepass:env UB_KEYSTORE_PASSWORD -keypass:env UB_KEY_PASSWORD \
  -sigalg SHA256withRSA -digestalg SHA-256 \
  -signedjar "$work/release-signed.aab" "$src" "$UB_KEY_ALIAS"
check="$(jarsigner -verify "$work/release-signed.aab" 2>&1)"
[[ "$check" == *"jar verified"* ]] || { echo "AAB assinado falhou na validação." >&2; exit 4; }

bundletool="$RUNNER_TEMP/bundletool-all-1.18.3.jar"
curl --fail --location --silent --show-error --retry 3 \
  "https://github.com/google/bundletool/releases/download/1.18.3/bundletool-all-1.18.3.jar" \
  --output "$bundletool"
target="$(java -jar "$bundletool" dump manifest --bundle="$work/release-signed.aab" --xpath='/manifest/uses-sdk/@android:targetSdkVersion' | tr -dc '0-9')"
version="$(java -jar "$bundletool" dump manifest --bundle="$work/release-signed.aab" --xpath='/manifest/@android:versionCode' | tr -dc '0-9')"
[[ "$target" =~ ^[0-9]+$ && "$target" -ge 36 ]] || { echo "Google Play: targetSdk deve ser pelo menos 36 (para Android mobile no momento)." >&2; exit 4; }
[[ "$version" =~ ^[0-9]+$ && "$version" -gt 0 ]] || { echo "Google Play: versionCode inválido." >&2; exit 4; }
echo "AAB assinado validado: targetSdk=$target, versionCode=$version. Verificar políticas Google Play antes do envio."
