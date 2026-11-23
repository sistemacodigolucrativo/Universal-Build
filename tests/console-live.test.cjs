const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const { summarize, selectCurrentRun, isUnsignedAabArtifact, canSignFields } = require("../dashboard/build-progress.js");
const { prepare, entries } = require("../dashboard/artifact-download.js");
const source = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

test("build progress reflects GitHub steps, not guessed Gradle percentage", () => {
  const run = { status: "in_progress", conclusion: null };
  const jobs = [{
    steps: [
      { name: "Set up job", status: "completed" },
      { name: "Checkout", status: "completed" },
      { name: "Compilar aplicativo", status: "in_progress" },
      { name: "Post Checkout", status: "queued" }
    ]
  }];
  const r = summarize(run, jobs);
  assert.equal(r.active, true);
  assert.equal(r.stage, "Compilar aplicativo");
  assert.equal(r.done, 1);
  assert.equal(r.total, 2);
  assert.equal(r.percent, 50);
  assert.equal(summarize({ status: "queued" }, []).percent, null);
  assert.equal(summarize({ status: "completed", conclusion: "success" }, []).percent, 100);
  assert.match(summarize({ status: "completed", conclusion: "failure" }, []).stage, /falhou/);
});


test("active run is shown even if GitHub created_at precedes the dispatch window", () => {
  const now = Date.parse("2026-11-21T14:09:00Z");
  const old = { id: 38, status: "completed", conclusion: "success", created_at: "2026-11-21T14:03:57Z" };
  const active = { id: 39, status: "in_progress", created_at: "2026-11-21T14:08:01Z" };
  const dispatch = { repo: "org/app", branch: "main", at: now - 10000, knownRunIds: [38] };
  const selected = selectCurrentRun([active, old], dispatch, "org/app", "main", now);
  assert.equal(selected.current.id, 39);
  assert.equal(selected.pending, true);
  // Only the selected current run is eligible for artifacts: old successful #38 is not.
  assert.notEqual(selected.current.id, old.id);
});

test("previous successful build is not selected while a new dispatch is awaiting its run", () => {
  const now = Date.parse("2026-11-21T14:09:00Z");
  const old = { id: 38, status: "completed", created_at: "2026-11-21T14:03:57Z" };
  const dispatch = { repo: "org/app", branch: "main", at: now - 5000, knownRunIds: [38] };
  assert.equal(selectCurrentRun([old], dispatch, "org/app", "main", now).current, null);
  const fresh = { id: 39, status: "completed", created_at: "2026-11-21T14:08:01Z" };
  assert.equal(selectCurrentRun([fresh, old], dispatch, "org/app", "main", now).current.id, 39);
});

test("without pending dispatch the live run wins and branch mismatches do not hide history", () => {
  const old = { id: 38, status: "completed", created_at: "2026-11-21T14:03:57Z" };
  const live = { id: 39, status: "queued", created_at: "2026-11-21T14:08:01Z" };
  const dispatch = { repo: "org/app", branch: "other", at: Date.now(), knownRunIds: [38] };
  const selected = selectCurrentRun([live, old], dispatch, "org/app", "main");
  assert.equal(selected.pending, false);
  assert.equal(selected.current.id, 39);
});

test("manual signing inputs only unlock for valid run IDs and unsigned AAB artifacts", () => {
  assert.equal(canSignFields("45184914520", "Android-QR-Studio-2-both-unsigned"), true);
  assert.equal(canSignFields(" 45184914520 ", "Android-app-12-aab-unsigned"), true);
  for (const name of ["Android-APK", "Android-app-signed", "../bad-aab-unsigned",
    "Android-app-aab-unsigned;echo", ""]) {
    assert.equal(isUnsignedAabArtifact(name), false);
  }
  for (const runId of ["", "0", "abc", "123/45", "-123"]) {
    assert.equal(canSignFields(runId, "Android-app-12-aab-unsigned"), false);
  }
});

function makeZip(contents) {
  const locals = [];
  const directory = [];
  let offset = 0;
  for (const [name, data] of contents) {
    const filename = Buffer.from(name);
    const bytes = Buffer.from(data);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(bytes.length, 18);
    local.writeUInt32LE(bytes.length, 22);
    local.writeUInt16LE(filename.length, 26);
    locals.push(local, filename, bytes);
    const header = Buffer.alloc(46);
    header.writeUInt32LE(0x02014b50);
    header.writeUInt16LE(0, 10);
    header.writeUInt32LE(bytes.length, 20);
    header.writeUInt32LE(bytes.length, 24);
    header.writeUInt16LE(filename.length, 28);
    header.writeUInt32LE(offset, 42);
    directory.push(header, filename);
    offset += local.length + filename.length + bytes.length;
  }
  const size = directory.reduce((n, b) => n + b.length, 0);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50);
  eocd.writeUInt16LE(contents.length, 8);
  eocd.writeUInt16LE(contents.length, 10);
  eocd.writeUInt32LE(size, 12);
  eocd.writeUInt32LE(offset, 16);
  return Buffer.concat([...locals, ...directory, eocd]);
}
function arrayBuffer(buf) {
  return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
}

test("a single APK artifact becomes a direct APK download", async () => {
  const bytes = arrayBuffer(makeZip([["debug.apk", "apk-binary"]]));
  const files = entries(bytes);
  assert.equal(files.length, 1);
  const result = await prepare(bytes, "release-123");
  assert.equal(result.archive, false);
  assert.equal(result.filename, "debug.apk");
  assert.equal(Buffer.from(await result.blob.arrayBuffer()).toString(), "apk-binary");
});

test("multiple outputs stay in a ZIP archive without incorrect APK labeling", async () => {
  const bytes = arrayBuffer(makeZip([["debug.apk", "apk"], ["unsigned.aab", "aab"]]));
  const result = await prepare(bytes, "both-unsigned");
  assert.equal(result.archive, true);
  assert.equal(result.filename, "both-unsigned.zip");
});

test("invalid or malicious-looking ZIP cannot create arbitrary paths", async () => {
  const malicious = arrayBuffer(makeZip([["../danger.apk", "unsafe"]]));
  assert.equal(entries(malicious).length, 0);
  assert.equal((await prepare(malicious, "some-file")).archive, true);
  assert.equal((await prepare(arrayBuffer(Buffer.from("bad")), "other")).archive, true);
});

test("console UI is wired to real Actions jobs and artifact download", () => {
  const html = source("dashboard/index.html");
  const js = source("dashboard/app.js");
  for (const id of ["toast-stack", "branch-select", "repo-scan-status", "build-progress",
    "build-progress-bar", "build-progress-title", "build-progress-label", "admob-settings"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.doesNotMatch(html, /src="\.\/artifact-download\.js"/);
  assert.match(html, /src="\.\/build-progress\.js"/);
  assert.match(html, /src="\.\/keygen-client\.js"/);
  for (const id of ["history-details", "history-list", "history-more", "sign-validation", "keygen-start", "keygen-unlock", "keygen-save-jks", "keygen-copy-base64"]) assert.match(html, new RegExp('id="' + id + '"'));
  assert.match(js, /function downloadArtifact\(/);
  assert.match(js, /universal-build\.yml/);
  assert.match(js, /historyFragment\.append\(row\)/);
  assert.match(js, /"history-summary"\)\.textContent/);
  assert.match(js, /\/actions\/runs\//);
  assert.match(js, /\/artifacts\//);
  assert.doesNotMatch(js, /redirect: "follow"/);
  assert.match(js, /\/actions\/runs\/" \+ run\.id \+ "\/jobs/);
  assert.match(js, /ref: branch, inputs/);
  assert.match(js, /function selectedBranch/);
  assert.match(js, /function notice\(/);
  assert.match(js, /selectCurrentRun\(/);
  assert.match(js, /querySelectorAll\("\.artifact-line"\)/);
  assert.match(js, /"run-list"\)\.replaceChildren\(\)/);
  assert.match(js, /function loadRunArtifacts\(/);
  assert.match(js, /function loadHistoricalArtifacts\(/);
  assert.match(js, /historyPageLimit/);
  assert.match(js, /"history-details"\)\.hidden = false/);
  assert.match(js, /"sign-run-id"\)\.addEventListener\("input", updateSignAvailability\)/);
  assert.match(js, /"sign-artifact"\)\.addEventListener\("input", updateSignAvailability\)/);
  assert.match(js, /const artifact = \(source\.artifacts \|\| \[\]\)\.find/);
  assert.doesNotMatch(js, /statusValue === "success" && selection\.current\?\.id === run\.id/);
  assert.ok(html.indexOf("2 · Monetização") < html.indexOf("3 · Configurar"));
  assert.ok(html.indexOf("3 · Configurar") < html.indexOf("4 · Progresso"));
  assert.ok(html.indexOf("4 · Progresso") < html.indexOf("5 · Assinatura"));
  assert.doesNotMatch(html, /id="notice"/);
});
