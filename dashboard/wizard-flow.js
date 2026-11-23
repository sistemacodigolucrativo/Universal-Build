/* Navegação progressiva da interface (sem token, chaves ou dados sensíveis). */
(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else {
    root.UniversalWizard = api;
    api.init();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  const root = globalThis;
  const STEPS = Object.freeze([
    { id: "repository-panel", label: "Aplicativo" },
    { id: "admob-settings", label: "Anúncios" },
    { id: "build-panel", label: "Compilar" },
    { id: "progress-panel", label: "Resultados" },
    { id: "signing-panel", label: "Assinar" }
  ]);
  const clamp = value => Math.min(STEPS.length, Math.max(1, Number(value) || 1));
  const canVisit = (step, hasRepo) => clamp(step) === 1 || !!hasRepo;

  function init() {
    if (typeof document === "undefined") return;
    const app = document.getElementById("app-view");
    const nav = document.getElementById("wizard-nav");
    const help = document.getElementById("wizard-message");
    if (!app || !nav || !help) return;
    const repoSelect = document.getElementById("repo-select");
    const branchSelect = document.getElementById("branch-select");
    const previous = document.getElementById("wizard-prev");
    const next = document.getElementById("wizard-next");
    const count = document.getElementById("wizard-count");
    const progress = document.getElementById("wizard-progress");
    const buttons = Array.from(nav.querySelectorAll("[data-step-target]"));
    let current = 1;
    let adDirty = false;

    function selected() { return !!repoSelect.value; }
    function show(step, focus = true) {
      const target = clamp(step);
      if (!canVisit(target, selected())) {
        help.textContent = "Selecione primeiro um aplicativo na etapa 1.";
        current = 1;
        render();
        if (focus) repoSelect.focus();
        return false;
      }
      if (current === 2 && target !== 2 && adDirty) {
        if (!root.confirm("Existem alterações de anúncios não salvas. Deseja sair desta etapa sem salvá-las?"))
          return false;
        adDirty = false;
      }
      current = target;
      render();
      if (focus) {
        const panel = document.getElementById(STEPS[current - 1].id);
        const heading = panel.querySelector("h2");
        if (heading) {
          heading.tabIndex = -1;
          heading.focus({ preventScroll: true });
          heading.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }
      return true;
    }
    function render() {
      if (!selected() && current !== 1) current = 1;
      app.classList.add("wizard-enabled");
      STEPS.forEach((step, index) => {
        document.getElementById(step.id).hidden = index + 1 !== current;
      });
      for (const button of buttons) {
        const step = Number(button.dataset.stepTarget);
        button.disabled = !canVisit(step, selected());
        if (step === current) button.setAttribute("aria-current", "step");
        else button.removeAttribute("aria-current");
      }
      previous.disabled = current === 1;
      next.hidden = current === STEPS.length;
      next.disabled = current === 1 && !selected();
      next.textContent = current === 2 ? "Continuar (anúncios opcionais)" : "Continuar";
      count.textContent = "Etapa " + current + " de " + STEPS.length + " · " + STEPS[current - 1].label;
      progress.value = current;
      help.textContent = current === 1 ?
        (selected() ? "Aplicativo selecionado. Você pode continuar ou gerenciar os workflows." :
          "Escolha um aplicativo Android para habilitar as demais etapas.") :
        current === 2 ? "Anúncios são opcionais. Se alterar as configurações, salve antes de continuar." :
        current === 3 ? "Escolha o tipo de compilação e inicie. Configurações técnicas ficam em Avançado." :
        current === 4 ? "Acompanhe o build atual ou abra o histórico. É possível assinar um AAB anterior." :
        "Use sua chave de upload existente. Crie uma chave nova apenas para o primeiro lançamento.";
    }
    buttons.forEach(button => button.addEventListener("click", () => show(button.dataset.stepTarget)));
    previous.addEventListener("click", () => show(current - 1));
    next.addEventListener("click", () => show(current + 1));
    repoSelect.addEventListener("change", () => {
      adDirty = false;
      current = 1;
      render();
    });
    branchSelect.addEventListener("change", () => { adDirty = false; render(); });
    const admob = document.getElementById("admob-form");
    admob.addEventListener("input", () => { adDirty = true; });
    admob.addEventListener("change", () => { adDirty = true; });
    root.addEventListener("ub:admob-saved", () => { adDirty = false; render(); });
    root.addEventListener("ub:build-started", () => { show(4); });
    root.addEventListener("ub:sign-selected", () => { show(5); });
    document.getElementById("logout-btn").addEventListener("click", () => {
      adDirty = false;
      current = 1;
      render();
    });
    render();
    return { show, render };
  }
  return { STEPS, clamp, canVisit, init };
});
