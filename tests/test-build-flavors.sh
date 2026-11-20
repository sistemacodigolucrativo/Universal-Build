#!/usr/bin/env bash
# Contract tests for both flavored Kotlin Master and standard Android projects.
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
tmp="$(mktemp -d)"
trap 'rm -rf "$tmp"' EXIT
mkdir -p "$tmp/mocks" "$tmp/flavored/app" "$tmp/plain/app"

cat > "$tmp/mocks/jarsigner" <<'MOCK'
#!/usr/bin/env bash
if [[ "${EXPECT_SIGNED:-false}" == true ]]; then
  [[ -n "${ANDROID_KEYSTORE_PATH:-}" && -s "$ANDROID_KEYSTORE_PATH" ]] || exit 2
  echo "jar verified"
else
  echo "jar is unsigned"
fi
MOCK
cat > "$tmp/mocks/curl" <<'MOCK'
#!/usr/bin/env bash
while [[ "$#" -gt 0 ]]; do
  if [[ "$1" == --output ]]; then
    shift
    printf 'mock bundletool' > "$1"
    exit 0
  fi
  shift
done
exit 1
MOCK
cat > "$tmp/mocks/java" <<'MOCK'
#!/usr/bin/env bash
if [[ "$*" == *"targetSdkVersion"* ]]; then echo 36; else echo 3; fi
MOCK
chmod +x "$tmp/mocks/"*

cat > "$tmp/flavored/app/build.gradle.kts" <<'GRADLE'
android {
    productFlavors {
        create("dev") { }
        create("staging") { }
        create("prod") { }
    }
}
GRADLE
printf 'applicationId=br.com.example.app\n' > "$tmp/flavored/app-config.properties"

for name in flavored plain; do
  cat > "$tmp/$name/gradlew" <<'GRADLE'
#!/usr/bin/env bash
set -euo pipefail
task="${@: -1}"
echo "$task" >> "$TEST_TASK_LOG"
case "$task" in
  :app:assembleDevDebug)
    mkdir -p app/build/outputs/apk/dev/debug app/build/outputs/apk/prod/debug
    printf 'dev debug' > app/build/outputs/apk/dev/debug/app-dev-debug.apk
    printf 'wrong flavor' > app/build/outputs/apk/prod/debug/decoy-debug.apk
    ;;
  :app:assembleStagingDebug)
    mkdir -p app/build/outputs/apk/staging/debug
    printf 'staging debug' > app/build/outputs/apk/staging/debug/app-staging-debug.apk
    ;;
  :app:assembleDebug)
    mkdir -p app/build/outputs/apk/debug
    printf 'plain debug' > app/build/outputs/apk/debug/app-debug.apk
    ;;
  :app:bundleProdRelease)
    if [[ "${EXPECT_SIGNED:-false}" == true ]]; then
      [[ -s "${ANDROID_KEYSTORE_PATH:-}" ]] || exit 51
      [[ "${ANDROID_KEYSTORE_PASSWORD:-}" == "test-password" ]] || exit 52
      [[ "${ANDROID_KEY_ALIAS:-}" == "test-alias" ]] || exit 53
      [[ "${ANDROID_KEY_PASSWORD:-}" == "key-password" ]] || exit 54
    fi
    mkdir -p app/build/outputs/bundle/prodRelease
    printf 'prod bundle' > app/build/outputs/bundle/prodRelease/app-prod-release.aab
    ;;
  *)
    echo "unexpected Gradle task: $task" >&2
    exit 5
    ;;
esac
GRADLE
  chmod +x "$tmp/$name/gradlew"
done

export PATH="$tmp/mocks:$PATH" GITHUB_WORKSPACE="$tmp" UB_KIND=android UB_MODULE=app
export TEST_TASK_LOG="$tmp/tasks.log"

run_case() {
  local name="$1" target="$2" flavor="$3"
  : > "$TEST_TASK_LOG"
  export UB_PROJECT_DIR="$tmp/$name" UB_TARGET="$target" UB_FLAVOR="$flavor" RUNNER_TEMP="$tmp/runner-$name-$target-$flavor"
  mkdir -p "$RUNNER_TEMP"
  bash "$root/scripts/build.sh" > "$tmp/build-output.log"
}

run_case flavored apk auto
grep -qx ':app:assembleDevDebug' "$TEST_TASK_LOG"
grep -qx 'dev debug' "$RUNNER_TEMP/ub-artifacts/debug.apk"

run_case flavored both-unsigned auto
grep -qx ':app:assembleDevDebug' "$TEST_TASK_LOG"
grep -qx ':app:bundleProdRelease' "$TEST_TASK_LOG"
grep -qx 'dev debug' "$RUNNER_TEMP/ub-artifacts/debug.apk"
grep -qx 'prod bundle' "$RUNNER_TEMP/ub-artifacts/unsigned.aab"

run_case flavored apk staging
grep -qx ':app:assembleStagingDebug' "$TEST_TASK_LOG"
grep -qx 'staging debug' "$RUNNER_TEMP/ub-artifacts/debug.apk"

run_case plain apk auto
grep -qx ':app:assembleDebug' "$TEST_TASK_LOG"
grep -qx 'plain debug' "$RUNNER_TEMP/ub-artifacts/debug.apk"

export EXPECT_SIGNED=true
export UB_KEYSTORE_BASE64="$(printf '%s' 'dummy keystore data' | base64 -w0)"
export UB_KEYSTORE_PASSWORD=test-password UB_KEY_ALIAS=test-alias UB_KEY_PASSWORD=key-password
run_case flavored aab auto
grep -qx ':app:bundleProdRelease' "$TEST_TASK_LOG"
grep -qx 'prod bundle' "$RUNNER_TEMP/ub-artifacts/release.aab"
[[ ! -e "$RUNNER_TEMP/universal-release.jks" ]]
unset EXPECT_SIGNED UB_KEYSTORE_BASE64 UB_KEYSTORE_PASSWORD UB_KEY_ALIAS UB_KEY_PASSWORD
if run_case flavored apk wrong-flavor > /dev/null 2>&1; then
  echo 'Invalid flavor accepted' >&2
  exit 1
fi
echo 'Universal Build Kotlin flavor/signing contract: six cases passed.'
