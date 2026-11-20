/* Evidências de projeto Android compilável; sem dependências e sem analisar nome/linguagem do repo. */
(function (root, factory) {
  const moduleApi = factory();
  if (typeof module === "object" && module.exports) module.exports = moduleApi;
  else root.AndroidRepoFilter = moduleApi;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function classifyTree(response) {
    if (!response || !Array.isArray(response.tree)) return null;
    const paths = new Set(response.tree
      .filter((entry) => entry && entry.type === "blob" && typeof entry.path === "string")
      .map((entry) => entry.path));
    const settings = [...paths].filter((path) => /(^|\/)settings\.gradle(\.kts)?$/.test(path));
    for (const settingsPath of settings) {
      const root = settingsPath.slice(0, settingsPath.lastIndexOf("/") + 1);
      for (const path of paths) {
        if (!path.startsWith(root) || !/(^|\/)build\.gradle(\.kts)?$/.test(path)) continue;
        const moduleDir = path.slice(0, path.lastIndexOf("/") + 1);
        if (moduleDir !== root && paths.has(moduleDir + "src/main/AndroidManifest.xml")) {
          return true;
        }
      }
    }
    // Árvores truncadas não são prova de ausência de Android.
    return response.truncated ? null : false;
  }
  return { classifyTree };
});
