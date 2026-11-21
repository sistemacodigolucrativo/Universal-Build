/* Configuração de monetização por aplicativo. Não carrega anúncios nem credenciais. */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.UniversalAdMobConfig = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const PATH = "config/universal-build-admob.json";
  const DEMO = Object.freeze({
    appId: "ca-app-pub-3940256099942544~3347511713",
    banner: "ca-app-pub-3940256099942544/9214589741",
    interstitial: "ca-app-pub-3940256099942544/1033173712",
    rewarded: "ca-app-pub-3940256099942544/5224354917"
  });
  const APP_ID = /^ca-app-pub-\d{16}~\d{10}$/;
  const AD_UNIT = /^ca-app-pub-\d{16}\/\d{10}$/;
  const formats = ["banner", "interstitial", "rewarded"];
  function defaults() {
    return {
      version: 1,
      mode: "off",
      appId: "",
      units: { banner: "", interstitial: "", rewarded: "" },
      enabled: { banner: false, interstitial: false, rewarded: false },
      interstitialCooldownSeconds: 120
    };
  }
  function normalize(input) {
    if (!input || typeof input !== "object" || Array.isArray(input)) {
      throw new Error("Configuração AdMob inválida.");
    }
    if (input.version !== 1) throw new Error("Versão de configuração AdMob não suportada.");
    const result = defaults();
    result.mode = input.mode;
    result.appId = input.appId;
    result.interstitialCooldownSeconds = input.interstitialCooldownSeconds;
    if (!input.units || !input.enabled || typeof input.units !== "object" ||
        typeof input.enabled !== "object" || Array.isArray(input.units) ||
        Array.isArray(input.enabled)) {
      throw new Error("Unidades AdMob ou formatos inválidos.");
    }
    for (const format of formats) {
      result.units[format] = input.units[format];
      result.enabled[format] = input.enabled[format];
    }
    validate(result);
    return result;
  }
  function validate(config) {
    if (!["off", "test", "live"].includes(config.mode)) {
      throw new Error("Escolha um modo de monetização válido.");
    }
    if (typeof config.appId !== "string" || (config.appId && !APP_ID.test(config.appId))) {
      throw new Error("App ID AdMob inválido: use o formato ca-app-pub-...~...");
    }
    if (!Number.isInteger(config.interstitialCooldownSeconds) ||
        config.interstitialCooldownSeconds < 30 ||
        config.interstitialCooldownSeconds > 3600) {
      throw new Error("Intervalo de intersticial deve ficar entre 30 e 3600 segundos.");
    }
    for (const format of formats) {
      if (typeof config.enabled[format] !== "boolean") {
        throw new Error("Ativação do formato " + format + " inválida.");
      }
      const unit = config.units[format];
      if (typeof unit !== "string" || (unit && !AD_UNIT.test(unit))) {
        throw new Error("ID da unidade " + format + " inválido.");
      }
    }
    if (config.mode === "live") {
      if (!APP_ID.test(config.appId) || config.appId === DEMO.appId) {
        throw new Error("Produção exige App ID real e diferente do demonstrativo.");
      }
      if (!formats.some((format) => config.enabled[format])) {
        throw new Error("Ative pelo menos um formato para o modo de produção.");
      }
      for (const format of formats) {
        if (config.enabled[format] && (!AD_UNIT.test(config.units[format]) ||
            Object.values(DEMO).includes(config.units[format]))) {
          throw new Error("Produção exige uma unidade AdMob real para " + format + ".");
        }
      }
    }
    return true;
  }
  function effective(config) {
    const normalized = normalize(config);
    if (normalized.mode !== "test") return normalized;
    return {
      ...normalized,
      appId: DEMO.appId,
      units: { banner: DEMO.banner, interstitial: DEMO.interstitial, rewarded: DEMO.rewarded }
    };
  }
  return { PATH, DEMO, formats, defaults, normalize, validate, effective };
});
