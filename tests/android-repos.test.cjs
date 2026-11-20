const test = require("node:test");
const assert = require("node:assert/strict");
const { classifyTree } = require("../dashboard/android-repos.js");
const tree = (files, truncated = false) => ({
  truncated,
  tree: files.map((path) => ({ path, type: "blob" }))
});
const android = (dir = "", module = "app", kotlin = true) => [
  dir + "settings.gradle" + (kotlin ? ".kts" : ""),
  dir + module + "/build.gradle" + (kotlin ? ".kts" : ""),
  dir + module + "/src/main/AndroidManifest.xml"
];
test("reconhece Android Kotlin Gradle e Java Gradle", () => {
  assert.equal(classifyTree(tree(android())), true);
  assert.equal(classifyTree(tree(android("", "app", false))), true);
});
test("reconhece Flutter com projeto Android gerado", () => {
  assert.equal(classifyTree(tree(["pubspec.yaml", ...android("android/")])), true);
});
test("reconhece React Native com pasta android", () => {
  assert.equal(classifyTree(tree(["package.json", ...android("android/", "app", false)])), true);
});
test("reconhece Capacitor e monorepo Android", () => {
  assert.equal(classifyTree(tree(["capacitor.config.ts", ...android("android/")])), true);
  assert.equal(classifyTree(tree(android("apps/mobile/android/"))), true);
  assert.equal(classifyTree(tree(android("template/"))), true);
});
test("não considera um site ou apenas o nome Android como projeto Android", () => {
  assert.equal(classifyTree(tree(["package.json", "src/App.tsx", "README.md"])), false);
  assert.equal(classifyTree(tree(["README-Android.md", "android/logo.png"])), false);
});
test("não aceita manifesto ou Gradle isolados", () => {
  assert.equal(classifyTree(tree(["app/src/main/AndroidManifest.xml"])), false);
  assert.equal(classifyTree(tree(["settings.gradle.kts", "app/build.gradle.kts"])), false);
});
test("manifesto de módulo distinto não qualifica o Gradle de outro módulo", () => {
  assert.equal(classifyTree(tree([
    "settings.gradle.kts", "feature/build.gradle.kts", "app/src/main/AndroidManifest.xml"
  ])), false);
});
test("não mistura arquivos de projetos Gradle não relacionados", () => {
  assert.equal(classifyTree(tree([
    "first/settings.gradle.kts", "second/app/build.gradle.kts",
    "second/app/src/main/AndroidManifest.xml"
  ])), false);
});
test("árvore incompleta gera resultado inconclusivo, salvo prova positiva", () => {
  assert.equal(classifyTree(tree(["settings.gradle.kts"], true)), null);
  assert.equal(classifyTree(tree(android(), true)), true);
  assert.equal(classifyTree({}), null);
});
