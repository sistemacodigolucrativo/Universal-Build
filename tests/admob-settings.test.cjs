const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const ads = require("../dashboard/admob-config.js");

const root = path.resolve(__dirname, "..");
const text = file => fs.readFileSync(path.join(root, file), "utf8");
const appId = "ca-app-pub-1234567890123456~1234567890";
const unitId = "ca-app-pub-1234567890123456/1234567890";

test("off is the safe default, with no ad formats enabled", () => {
  const config = ads.normalize(ads.defaults());
  assert.equal(config.mode, "off");
  assert.deepEqual(config.enabled, { banner: false, interstitial: false, rewarded: false });
});

test("test mode uses Google demo identifiers without changing saved real IDs", () => {
  const config = ads.defaults();
  config.mode = "test";
  config.appId = appId;
  config.units.banner = unitId;
  config.enabled.banner = true;
  const effective = ads.effective(config);
  assert.equal(effective.appId, ads.DEMO.appId);
  assert.equal(effective.units.banner, ads.DEMO.banner);
  assert.equal(config.appId, appId);
});

test("live mode needs real IDs and an enabled format", () => {
  const config = ads.defaults();
  config.mode = "live";
  assert.throws(() => ads.normalize(config), /App ID real/);
  config.appId = appId;
  assert.throws(() => ads.normalize(config), /pelo menos um formato/);
  config.enabled.rewarded = true;
  assert.throws(() => ads.normalize(config), /unidade AdMob real/);
  config.units.rewarded = unitId;
  assert.equal(ads.normalize(config).units.rewarded, unitId);
  config.units.rewarded = ads.DEMO.rewarded;
  assert.throws(() => ads.normalize(config), /unidade AdMob real/);
});

test("reject invalid formats, cooldown and corrupt config", () => {
  const config = ads.defaults();
  config.mode = "other";
  assert.throws(() => ads.normalize(config), /modo/);
  config.mode = "off";
  config.interstitialCooldownSeconds = 1;
  assert.throws(() => ads.normalize(config), /Intervalo/);
  assert.throws(() => ads.normalize({ version: 2 }), /Versão/);
  assert.throws(() => ads.normalize(null), /inválida/);
});

test("dashboard wires controls, GitHub persistence and safe default", () => {
  const html = text("dashboard/index.html");
  const js = text("dashboard/app.js");
  assert.match(html, /id="admob-settings"/);
  assert.match(html, /src="\.\/admob-config\.js"/);
  for (const id of ["admob-form", "admob-mode", "admob-app-id", "admob-banner-id",
      "admob-interstitial-id", "admob-rewarded-id", "admob-cooldown", "admob-save"]) {
    assert.ok(html.includes('id="' + id + '"'));
  }
  assert.match(js, /UniversalAdMobConfig\.PATH/);
  assert.match(js, /function loadAdmobConfig/);
  assert.match(js, /function saveAdmobConfig/);
  assert.match(js, /currentAdConfig\.sha/);
  assert.match(js, /branch: repo\.default_branch/);
});
