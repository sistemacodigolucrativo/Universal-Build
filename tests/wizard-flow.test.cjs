const assert = require("node:assert/strict");
const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const wizard = require("../dashboard/wizard-flow.js");

test("cinco etapas estáveis e acesso à assinatura de build anterior", () => {
  assert.deepEqual(wizard.STEPS.map(item => item.id), [
    "repository-panel", "admob-settings", "build-panel", "progress-panel", "signing-panel"
  ]);
  assert.equal(wizard.clamp(-3), 1);
  assert.equal(wizard.clamp(99), 5);
  assert.equal(wizard.canVisit(2, false), false);
  assert.equal(wizard.canVisit(5, false), false);
  assert.equal(wizard.canVisit(5, true), true);
});

test("HTML inclui cinco painéis, botões acessíveis e eventos do fluxo real", () => {
  const html = fs.readFileSync(path.join(__dirname, "../dashboard/index.html"), "utf8");
  const app = fs.readFileSync(path.join(__dirname, "../dashboard/app.js"), "utf8");
  const css = fs.readFileSync(path.join(__dirname, "../dashboard/style.css"), "utf8");
  for (const item of wizard.STEPS) {
    assert.match(html, new RegExp('id="' + item.id + '"'));
  }
  assert.equal((html.match(/data-step-target="[1-5]"/g) || []).length, 5);
  for (const id of ["wizard-nav", "wizard-count", "wizard-prev", "wizard-next", "wizard-progress"]) {
    assert.match(html, new RegExp('id="' + id + '"'));
  }
  assert.match(html, /src="\.\/wizard-flow\.js"/);
  assert.match(app, /ub:build-started/);
  assert.match(app, /ub:sign-selected/);
  assert.match(app, /ub:admob-saved/);
  assert.match(css, /wizard-nav button\[aria-current="step"\]/);
});

test("navegação bloqueia avançar sem repo, preserva AdMob não salvo e abre assinatura", () => {
  const original = {
    document: global.document, confirm: global.confirm, addEventListener: global.addEventListener
  };
  class Element {
    constructor() {
      this.listeners = {};
      this.hidden = false;
      this.disabled = false;
      this.value = "";
      this.dataset = {};
      this.attributes = {};
      this.classList = { add() {} };
      this.heading = { tabIndex: 0, focus() {}, scrollIntoView() {} };
    }
    addEventListener(name, handler) {
      (this.listeners[name] ||= []).push(handler);
    }
    dispatch(name) {
      for (const handler of this.listeners[name] || []) handler({});
    }
    querySelector(tag) { return tag === "h2" ? this.heading : null; }
    querySelectorAll() { return []; }
    setAttribute(name, value) { this.attributes[name] = value; }
    removeAttribute(name) { delete this.attributes[name]; }
    focus() {}
  }
  const ids = new Map();
  for (const id of [
    "app-view", "wizard-nav", "wizard-message", "repo-select", "branch-select",
    "wizard-prev", "wizard-next", "wizard-count", "wizard-progress",
    "admob-form", "logout-btn", ...wizard.STEPS.map(item => item.id)
  ]) ids.set(id, new Element());
  const buttons = Array.from({ length: 5 }, (_, index) => {
    const btn = new Element();
    btn.dataset.stepTarget = String(index + 1);
    return btn;
  });
  ids.get("wizard-nav").querySelectorAll = () => buttons;
  const hostEvents = {};
  global.document = { getElementById: id => ids.get(id) };
  global.addEventListener = (event, handler) => { (hostEvents[event] ||= []).push(handler); };
  let accepted = false;
  global.confirm = () => accepted;
  const emit = event => (hostEvents[event] || []).forEach(handler => handler());
  try {
    const controller = wizard.init();
    assert.equal(ids.get("repository-panel").hidden, false);
    assert.equal(ids.get("admob-settings").hidden, true);
    assert.equal(ids.get("wizard-next").disabled, true);
    assert.equal(buttons[4].disabled, true);

    ids.get("repo-select").value = "owner/android-app";
    ids.get("repo-select").dispatch("change");
    assert.equal(ids.get("wizard-next").disabled, false);
    assert.equal(buttons[4].disabled, false);
    ids.get("wizard-next").dispatch("click");
    assert.equal(ids.get("admob-settings").hidden, false);
    assert.equal(buttons[1].attributes["aria-current"], "step");

    ids.get("admob-form").dispatch("input");
    ids.get("wizard-next").dispatch("click");
    assert.equal(ids.get("admob-settings").hidden, false, "não sai com alterações não salvas");
    accepted = true;
    ids.get("wizard-next").dispatch("click");
    assert.equal(ids.get("build-panel").hidden, false);
    emit("ub:build-started");
    assert.equal(ids.get("progress-panel").hidden, false);
    emit("ub:sign-selected");
    assert.equal(ids.get("signing-panel").hidden, false);
    assert.equal(ids.get("wizard-next").hidden, true);
    ids.get("logout-btn").dispatch("click");
    assert.equal(ids.get("repository-panel").hidden, false);
    assert.equal(controller.show(5, false), true, "assinatura histórica funciona sem novo build");
  } finally {
    global.document = original.document;
    global.confirm = original.confirm;
    global.addEventListener = original.addEventListener;
  }
});
