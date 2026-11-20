const assert = require('node:assert/strict');
const fs = require('node:fs');
const test = require('node:test');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const read = name => fs.readFileSync(path.join(root, name), 'utf8');

test('console sends flavor through workflow into the shell engine', () => {
  const page = read('dashboard/index.html');
  const client = read('dashboard/app.js');
  const entry = read('templates/android-build.yml');
  const runner = read('.github/workflows/android-reusable.yml');
  assert.match(page, /id="android-flavor"/);
  assert.match(client, /android_flavor: \$\("android-flavor"\)\.value/);
  assert.match(entry, /android_flavor: \$\{\{ inputs\.android_flavor \}\}/);
  assert.match(runner, /UB_FLAVOR: \$\{\{ inputs\.android_flavor \}\}/);
});
