#!/usr/bin/env bash
set -euo pipefail
temp="$(mktemp -d)"
trap 'rm -rf "$temp"' EXIT
export UB_KEYSTORE_PASSWORD='only-for-ci-test-password-30-character'
export UB_GENERATED_KEY="$temp/android-upload-key.jks"
export UB_ENCRYPTED_OUTPUT="$temp/android-upload-key.jks.ubenc"
keytool -genkeypair -noprompt -storetype PKCS12 -keystore "$UB_GENERATED_KEY" \
  -alias upload -keyalg RSA -keysize 3072 -sigalg SHA256withRSA -validity 36500 \
  -dname "CN=Universal Build Test, O=CI" \
  -storepass "$UB_KEYSTORE_PASSWORD" -keypass "$UB_KEYSTORE_PASSWORD"
keytool -exportcert -rfc -alias upload -storetype PKCS12 \
  -keystore "$UB_GENERATED_KEY" -storepass "$UB_KEYSTORE_PASSWORD" \
  -file "$temp/upload-certificate.pem"
node scripts/keygen-encrypt.cjs
[[ -s "$UB_ENCRYPTED_OUTPUT" && -s "$temp/upload-certificate.pem" ]]
node -e '
const fs=require("node:fs");
const a=require("./scripts/keygen-encrypt.cjs");
const secret=process.env.UB_KEYSTORE_PASSWORD;
const clear=fs.readFileSync(process.env.UB_GENERATED_KEY);
const encrypted=fs.readFileSync(process.env.UB_ENCRYPTED_OUTPUT);
if(!a.decryptKeystore(encrypted,secret).equals(clear))process.exit(2);
console.log("Keystore gerado e backup AES-GCM verificados");
'
keytool -list -keystore "$UB_GENERATED_KEY" -storetype PKCS12 \
  -storepass "$UB_KEYSTORE_PASSWORD" -alias upload >/dev/null
