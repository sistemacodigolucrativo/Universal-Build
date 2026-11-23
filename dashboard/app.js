/* Universal Build: zero dependências, zero backend próprio.
   O token fica em localStorage até a próxima meia-noite do aparelho.
   Nunca inclua tokens no código-fonte ou no GitHub Actions. */
(() => {
  "use strict";
  const API = "https://api.github.com";
  const CORE = "sistemacodigolucrativo/Universal-Build";
  const STORAGE = "ub-session-v1";
  const MAX_ZIP = 15 * 1024 * 1024;
  const state = { token: "", login: "", expires: 0, repos: [], repo: null };
  let repoScanId = 0;
  let adConfigRequestId = 0;
  let branchRequestId = 0;
  let refreshRequestId = 0;
  let lastDispatch = null;
  let recoveredUploadKey = null;
  const artifactsByRun = new Map();
  const knownRunIds = new Map();
  let currentAdConfig = { name: "", branch: "", sha: null, loaded: false };
  const $ = (id) => document.getElementById(id);

  /* Transient notifications are accessible, floating and dismissible toasts. */
  function notice(message, error = false) {
    if (!message) return;
    const container = $("toast-stack");
    if ([...container.children].some(item =>
        item.querySelector(".toast__message")?.textContent === message)) return;
    const toast = document.createElement("div");
    toast.className = "toast " + (error ? "toast--error" :
      /salv[ao]|conclu|conectad[oa]|sucesso/i.test(message) ?
      "toast--success" : "toast--info");
    toast.setAttribute("role", error ? "alert" : "status");
    const info = document.createElement("p");
    info.className = "toast__message";
    info.textContent = message;
    const close = document.createElement("button");
    close.type = "button";
    close.className = "toast__close";
    close.setAttribute("aria-label", "Fechar aviso");
    close.textContent = "×";
    close.addEventListener("click", () => toast.remove());
    toast.append(info, close);
    container.append(toast);
    while (container.children.length > 4) container.firstElementChild.remove();
    window.setTimeout(() => toast.remove(), error ? 9000 : 5000);
  }
  function midnight() {
    const day = new Date();
    day.setHours(24, 0, 0, 0);
    return day.getTime();
  }
  // Private key material exists only in memory until the user downloads it.
  function forgetRecoveredKey() {
    if (recoveredUploadKey) new Uint8Array(recoveredUploadKey).fill(0);
    recoveredUploadKey = null;
    $("keygen-recovered").hidden = true;
    $("keygen-password").value = "";
    $("keygen-encrypted").value = "";
    $("keygen-result").textContent = "A chave será desbloqueada somente neste navegador.";
  }
  function clearSession() {
    forgetRecoveredKey();
    state.token = "";
    state.login = "";
    state.expires = 0;
    state.repo = null;
    state.repos = [];
    repoScanId++;
    adConfigRequestId++;
    branchRequestId++;
    refreshRequestId++;
    currentAdConfig = { name: "", branch: "", sha: null, loaded: false };
    lastDispatch = null;
    artifactsByRun.clear();
    knownRunIds.clear();
    $("branch-select").replaceChildren(new Option("Selecione primeiro um repositório", ""));
    $("branch-select").disabled = true;
    $("build-progress").hidden = true;
    $("run-list").replaceChildren();
    $("history-list").replaceChildren();
    $("history-details").open = false;
    $("admob-save").disabled = true;
    $("admob-status").textContent = "Selecione um projeto Android para carregar as configurações.";
    localStorage.removeItem(STORAGE);
    $("token").value = "";
    $("app-view").hidden = true;
    $("login-view").hidden = false;
  }
  function isSessionValid() {
    if (state.token && Date.now() < state.expires) return true;
    if (state.token) {
      clearSession();
      notice("Sessão encerrada à meia-noite. Conecte-se novamente.", true);
    }
    return false;
  }
  function persistSession() {
    localStorage.setItem(STORAGE, JSON.stringify({
      login: state.login, token: state.token, expires: state.expires
    }));
  }
  async function api(path, options = {}) {
    if (!isSessionValid()) throw new Error("Sessão expirada.");
    const response = await fetch(API + path, {
      ...options,
      headers: {
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "Authorization": "Bearer " + state.token,
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {})
      }
    });
    if (response.status === 204) return null;
    let payload;
    try { payload = await response.json(); }
    catch (_) { payload = {}; }
    if (!response.ok) {
      const msg = (payload && payload.message) || ("HTTP " + response.status);
      const error = new Error("GitHub: " + msg + " (" + response.status + ")");
      error.status = response.status;
      if (response.status === 401) clearSession();
      throw error;
    }
    return payload;
  }
  function utf8Base64(str) {
    return bytesBase64(new TextEncoder().encode(str));
  }
  function bytesBase64(bytes) {
    let raw = "";
    const chunk = 32768;
    for (let i = 0; i < bytes.length; i += chunk) {
      raw += String.fromCharCode(...bytes.subarray(i, i + chunk));
    }
    return btoa(raw);
  }
  function decodeGitHubFile(obj) {
    if (obj.encoding !== "base64" || !obj.content) throw new Error("Conteúdo de template indisponível.");
    const raw = atob(obj.content.replace(/\s+/g, ""));
    return new TextDecoder().decode(Uint8Array.from(raw, (c) => c.charCodeAt(0)));
  }
  function repoPath(repo) {
    return "/repos/" + repo.full_name.split("/").map(encodeURIComponent).join("/");
  }
  function selected() {
    if (!state.repo) throw new Error("Selecione um repositório.");
    return state.repo;
  }
  function selectedBranch(repo = selected()) {
    return $("branch-select").value || repo.default_branch;
  }
  function showApp() {
    $("login-view").hidden = true;
    $("app-view").hidden = false;
    $("connection-info").textContent = "@" + state.login + " · sessão válida até meia-noite";
  }
  async function login(ev) {
    ev.preventDefault();
    const login = $("username").value.trim();
    const token = $("token").value.trim();
    if (!login || !token) return;
    $("login-btn").disabled = true;
    notice("Validando token diretamente no GitHub...");
    try {
      state.token = token;
      state.expires = midnight();
      const me = await api("/user");
      if (me.login.toLowerCase() !== login.toLowerCase()) {
        state.token = "";
        throw new Error("Usuário informado não corresponde ao proprietário do token.");
      }
      state.login = me.login;
      persistSession();
      showApp();
      notice("GitHub conectado. Selecione um repositório para continuar.");
      await loadRepos();
    } catch (err) {
      if (!state.login) state.token = "";
      notice(err.message, true);
    } finally { $("login-btn").disabled = false; }
  }
  async function restore() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE) || "null");
      if (!saved || !saved.token || !saved.login || Date.now() >= saved.expires) {
        localStorage.removeItem(STORAGE);
        return;
      }
      state.token = saved.token;
      state.login = saved.login;
      state.expires = saved.expires;
      showApp();
      await loadRepos();
    } catch (err) {
      clearSession();
      notice("Não foi possível restaurar a conexão. Faça login novamente.", true);
    }
  }
  // Uma consulta ao GitHub por repositório é necessária: nome/linguagem não provam que existe app Android.
  // O limite de simultaneidade impede sobrecarga e permite avisar sobre verificações incompletas.
  async function loadRepos(preferred = "") {
    if (!isSessionValid()) return;
    const requestId = ++repoScanId;
    const select = $("repo-select");
    const selectedName = preferred || select.value || (state.repo && state.repo.full_name);
    select.disabled = true;
    select.replaceChildren(new Option("Verificando projetos Android...", ""));
    $("repo-scan-status").textContent = "Consultando a estrutura dos projetos...";
    state.repos = [];
    selectRepo();
    notice("Localizando repositórios e verificando a estrutura Android...");
    try {
      const all = [];
      for (let page = 1; page <= 5; page++) {
        const data = await api("/user/repos?affiliation=owner&sort=updated&per_page=100&page=" + page);
        if (requestId !== repoScanId) return;
        if (!Array.isArray(data)) throw new Error("Resposta inválida ao listar repositórios.");
        all.push(...data);
        if (data.length < 100) break;
      }
      const candidates = all.filter((r) =>
        r.permissions && r.permissions.push && !r.archived && !r.disabled &&
        r.full_name !== CORE && r.default_branch
      );
      const androidRepos = [];
      let next = 0;
      let checked = 0;
      let unknown = 0;
      let interrupted = null;
      async function worker() {
        while (requestId === repoScanId && next < candidates.length && !interrupted) {
          const repo = candidates[next++];
          try {
            const tree = await api(repoPath(repo) + "/git/trees/" +
              encodeURIComponent(repo.default_branch) + "?recursive=1");
            if (requestId !== repoScanId) return;
            const classification = window.AndroidRepoFilter.classifyTree(tree);
            if (classification === true) androidRepos.push(repo);
            if (classification === null) unknown++;
          } catch (err) {
            if (requestId !== repoScanId) return;
            unknown++;
            if ([401, 403, 429].includes(err.status)) interrupted = err;
          } finally {
            checked++;
            if (requestId === repoScanId && (checked % 10 === 0 || checked === candidates.length)) {
              $("repo-scan-status").textContent = "Analisando " + checked + "/" + candidates.length +
                " projetos · identificados: " + androidRepos.length;
            }
          }
        }
      }
      await Promise.all(Array.from({ length: Math.min(8, candidates.length) }, () => worker()));
      if (requestId !== repoScanId) return;
      state.repos = androidRepos.sort((a, b) => a.full_name.localeCompare(b.full_name));
      select.replaceChildren(new Option(state.repos.length ?
        "Selecione um projeto Android" : "Nenhum projeto Android identificado", ""));
      for (const r of state.repos) {
        select.add(new Option(r.full_name + (r.private ? " · privado" : ""), r.full_name));
      }
      if (selectedName && state.repos.some((r) => r.full_name === selectedName)) {
        select.value = selectedName;
      }
      selectRepo();
      $("repo-scan-status").textContent = "Análise concluída: " + androidRepos.length + " projeto(s) Android.";
      const partial = !!interrupted || unknown > 0;
      notice(state.repos.length + " projeto(s) Android identificado(s) entre " +
        candidates.length + " repositório(s) analisáveis." +
        (partial ? " " + unknown + " não puderam ser confirmados." : "") +
        (interrupted ? " Verificação interrompida: " + interrupted.message : ""),
        partial);
    } catch (err) {
      if (requestId === repoScanId) notice("Não foi possível verificar os projetos Android: " + err.message, true);
    } finally {
      if (requestId === repoScanId) select.disabled = false;
    }
  }
  async function loadBranches(repo) {
    const requestId = ++branchRequestId;
    const selector = $("branch-select");
    const name = repo.full_name;
    selector.disabled = true;
    try {
      const response = await api(repoPath(repo) + "/branches?per_page=100");
      if (!state.repo || state.repo.full_name !== name || requestId !== branchRequestId) return;
      const names = Array.isArray(response) ? response.map(item => item.name) : [];
      if (!names.includes(repo.default_branch)) names.unshift(repo.default_branch);
      selector.replaceChildren();
      for (const item of names) {
        selector.add(new Option(item + (item === repo.default_branch ? " (padrão)" : ""), item));
      }
      selector.value = repo.default_branch;
      selector.disabled = false;
      loadAdmobConfig(repo);
      refreshRuns();
    } catch (error) {
      if (!state.repo || state.repo.full_name !== name || requestId !== branchRequestId) return;
      selector.disabled = false;
      notice("Não foi possível listar branches; usando " + repo.default_branch + ": " + error.message, true);
      loadAdmobConfig(repo);
      refreshRuns();
    }
  }

  function selectRepo() {
    state.repo = state.repos.find(r => r.full_name === $("repo-select").value) || null;
    const active = !!state.repo;
    $("install-btn").disabled = !active;
    $("run-btn").disabled = !active;
    $("refresh-runs").disabled = !active;
    $("sign-btn").disabled = !active;
    $("keygen-start").disabled = !active;
    forgetRecoveredKey();
    $("history-details").open = false;
    $("history-list").replaceChildren();
    $("admob-save").disabled = true;
    $("open-repo").hidden = !active;
    adConfigRequestId++;
    branchRequestId++;
    refreshRequestId++;
    lastDispatch = null;
    artifactsByRun.clear();
    // The previous repository must never leave stale artifact buttons on screen.
    $("run-list").replaceChildren();
    $("build-progress").hidden = true;
    currentAdConfig = { name: "", branch: "", sha: null, loaded: false };
    renderAdmobConfig(window.UniversalAdMobConfig.defaults());
    $("admob-status").textContent = active ? "Carregando configurações do projeto..." :
      "Selecione um projeto Android para carregar as configurações.";
    const branches = $("branch-select");
    branches.replaceChildren(new Option(
      active ? state.repo.default_branch + " (padrão)" : "Selecione primeiro um repositório",
      active ? state.repo.default_branch : ""));
    branches.disabled = !active;
    if (active) {
      $("open-repo").href = "https://github.com/" + state.repo.full_name;
      $("secrets-link").href = "https://github.com/" + state.repo.full_name + "/settings/secrets/actions";
      $("keygen-secrets-link").href = $("secrets-link").href;
      $("keygen-runs-link").href = "https://github.com/" + state.repo.full_name + "/actions/workflows/universal-keygen.yml";
      $("sign-runs-link").href = "https://github.com/" + state.repo.full_name + "/actions/workflows/universal-sign.yml";
      loadBranches(state.repo);
    } else {
      $("run-list").replaceChildren();
      const p = document.createElement("p");
      p.className = "small";
      p.textContent = "Selecione um repositório para visualizar o histórico.";
      $("run-list").append(p);
    }
  }

  function changeBranch() {
    if (!state.repo) return;
    adConfigRequestId++;
    refreshRequestId++;
    currentAdConfig = { name: "", branch: "", sha: null, loaded: false };
    $("admob-save").disabled = true;
    renderAdmobConfig(window.UniversalAdMobConfig.defaults());
    $("admob-status").textContent = "Carregando configurações da branch " + selectedBranch() + "...";
    $("build-progress").hidden = true;
    lastDispatch = null;
    forgetRecoveredKey();
    $("history-details").open = false;
    $("history-list").replaceChildren();
    // Invalidate artifacts belonging to the previously selected branch immediately.
    $("run-list").replaceChildren();
    loadAdmobConfig(state.repo);
    refreshRuns();
  }

  function renderAdmobConfig(config) {
    $("admob-mode").value = config.mode;
    $("admob-app-id").value = config.appId;
    $("admob-cooldown").value = String(config.interstitialCooldownSeconds);
    for (const format of window.UniversalAdMobConfig.formats) {
      $("admob-" + format + "-enabled").checked = config.enabled[format];
      $("admob-" + format + "-id").value = config.units[format];
    }
  }
  function readAdmobForm() {
    const config = window.UniversalAdMobConfig.defaults();
    config.mode = $("admob-mode").value;
    config.appId = $("admob-app-id").value.trim();
    config.interstitialCooldownSeconds = Number($("admob-cooldown").value);
    for (const format of window.UniversalAdMobConfig.formats) {
      config.enabled[format] = $("admob-" + format + "-enabled").checked;
      config.units[format] = $("admob-" + format + "-id").value.trim();
    }
    return window.UniversalAdMobConfig.normalize(config);
  }
  async function loadAdmobConfig(repo) {
    const id = ++adConfigRequestId;
    const name = repo.full_name;
    const branch = selectedBranch(repo);
    const path = repoPath(repo) + "/contents/" + window.UniversalAdMobConfig.PATH;
    try {
      let file = null;
      try {
        file = await api(path + "?ref=" + encodeURIComponent(branch));
      } catch (error) {
        if (error.status !== 404) throw error;
      }
      const config = file ? window.UniversalAdMobConfig.normalize(
        JSON.parse(decodeGitHubFile(file))) : window.UniversalAdMobConfig.defaults();
      if (id !== adConfigRequestId || !state.repo || state.repo.full_name !== name || selectedBranch() !== branch) return;
      renderAdmobConfig(config);
      currentAdConfig = { name, branch, sha: file ? file.sha : null, loaded: true };
      $("admob-save").disabled = false;
      $("admob-status").textContent = file ?
        "Configuração carregada do GitHub (modo: " + config.mode + ")." :
        "Sem configuração salva. O modo padrão é desativado.";
    } catch (error) {
      if (id !== adConfigRequestId || !state.repo || state.repo.full_name !== name || selectedBranch() !== branch) return;
      currentAdConfig = { name, branch, sha: null, loaded: false };
      $("admob-save").disabled = true;
      $("admob-status").textContent = "Falha ao carregar; salvamento bloqueado: " + error.message;
      notice("Não foi possível ler AdMob em " + name + ": " + error.message, true);
    }
  }
  async function saveAdmobConfig(ev) {
    ev.preventDefault();
    const repo = selected();
    const branch = selectedBranch(repo);
    if (!currentAdConfig.loaded || currentAdConfig.name !== repo.full_name ||
        currentAdConfig.branch !== branch) {
      return notice("Carregue primeiro as configurações AdMob desta branch.", true);
    }
    let config;
    try { config = readAdmobForm(); }
    catch (err) { return notice(err.message, true); }
    if (!confirm("Salvar configurações AdMob em " + repo.full_name +
        "? Isso cria um commit na branch " + branch +
        ". Alterações de App ID exigem nova compilação e integração Android.")) return;
    const btn = $("admob-save");
    btn.disabled = true;
    const name = repo.full_name;
    const path = repoPath(repo) + "/contents/" + window.UniversalAdMobConfig.PATH;
    try {
      const body = {
        message: "config(admob): atualizar configuração de monetização",
        content: utf8Base64(JSON.stringify(config, null, 2) + "\n"),
        branch
      };
      if (currentAdConfig.sha) body.sha = currentAdConfig.sha;
      const response = await api(path, { method: "PUT", body: JSON.stringify(body) });
      if (state.repo && state.repo.full_name === name) {
        if (selectedBranch(repo) === branch) currentAdConfig.sha = response.content.sha;
        $("admob-status").textContent = "Salvo em " + name + " · modo " + config.mode +
          ". É preciso integrar esta configuração no aplicativo e recompilar.";
        notice("Configuração AdMob salva com sucesso no GitHub.");
      }
    } catch (error) {
      if (state.repo && state.repo.full_name === name) {
        $("admob-status").textContent = "Não foi possível salvar: " + error.message;
        notice(error.message, true);
      }
    } finally {
      btn.disabled = !state.repo || state.repo.full_name !== name || !currentAdConfig.loaded;
    }
  }
  async function createRepo(ev) {
    ev.preventDefault();
    const name = $("new-repo-name").value.trim();
    const isPrivate = $("new-repo-private").value === "true";
    if (!/^[A-Za-z0-9._-]+$/.test(name)) return notice("Nome de repositório inválido.", true);
    notice("Criando repositório no GitHub...");
    try {
      const repo = await api("/user/repos", {
        method: "POST",
        body: JSON.stringify({ name, private: isPrivate, auto_init: true, description: "Projeto Android gerenciado pelo Universal Build" })
      });
      await loadRepos(repo.full_name);
      notice("Repositório criado: " + repo.full_name + ". Ele aparecerá na lista após receber um projeto Android válido.");
    } catch (err) { notice(err.message + ". Se o token não permitir criação, crie o repositório pelo site GitHub.", true); }
  }
  async function template(file = "android-build.yml") {
    const path = "/repos/" + CORE + "/contents/templates/" + file + "?ref=main";
    return decodeGitHubFile(await api(path));
  }
  async function ensureWorkflow(force) {
    const repo = selected();
    const path = repoPath(repo) + "/contents/.github/workflows/universal-build.yml";
    let existing = null;
    try { existing = await api(path + "?ref=" + encodeURIComponent(repo.default_branch)); }
    catch (e) { if (e.status !== 404) throw e; }
    if (existing && !force) return false;
    const yml = await template();
    const body = {
      message: (existing ? "ci: atualizar" : "ci: instalar") + " Universal Build",
      content: utf8Base64(yml), branch: repo.default_branch
    };
    if (existing) body.sha = existing.sha;
    await api(path, { method: "PUT", body: JSON.stringify(body) });
    return true;
  }
  async function ensureSignWorkflow(force = false) {
    const repo = selected();
    const path = repoPath(repo) + "/contents/.github/workflows/universal-sign.yml";
    let existing = null;
    try { existing = await api(path + "?ref=" + encodeURIComponent(repo.default_branch)); }
    catch (e) { if (e.status !== 404) throw e; }
    if (existing && !force) return false;
    const yml = await template("android-sign.yml");
    const body = {
      message: (existing ? "ci: atualizar" : "ci: instalar") + " workflow de assinatura Universal Build",
      content: utf8Base64(yml), branch: repo.default_branch
    };
    if (existing) body.sha = existing.sha;
    await api(path, { method: "PUT", body: JSON.stringify(body) });
    return true;
  }
  async function ensureKeygenWorkflow(force = false) {
    const repo = selected();
    const path = repoPath(repo) + "/contents/.github/workflows/universal-keygen.yml";
    let existing = null;
    try { existing = await api(path + "?ref=" + encodeURIComponent(repo.default_branch)); }
    catch (e) { if (e.status !== 404) throw e; }
    if (existing && !force) return false;
    const yml = await template("android-keygen.yml");
    const body = {
      message: (existing ? "ci: atualizar" : "ci: instalar") + " gerador de chave Universal Build",
      content: utf8Base64(yml), branch: repo.default_branch
    };
    if (existing) body.sha = existing.sha;
    await api(path, { method: "PUT", body: JSON.stringify(body) });
    return true;
  }
  async function generateUploadKey() {
    const btn = $("keygen-start");
    const repo = selected();
    if (!confirm("Gerar chave SOMENTE para primeiro uso em " + repo.full_name +
        "? Se já publicou este app, reutilize a chave anterior. Confirma que guardou " +
        "uma senha forte em ANDROID_KEYSTORE_PASSWORD no GitHub?")) return;
    btn.disabled = true;
    try {
      const created = await ensureKeygenWorkflow(false);
      if (created) notice("Workflow de chaves instalado. A ativação no GitHub pode levar alguns segundos.");
      await api(repoPath(repo) + "/actions/workflows/universal-keygen.yml/dispatches", {
        method: "POST", body: JSON.stringify({ ref: repo.default_branch })
      });
      notice("Geração solicitada. Abra o link do GitHub Actions e baixe o ZIP criptografado quando concluir.");
      $("keygen-runs-link").focus();
    } catch (err) {
      notice("Não foi possível gerar chave: " + err.message, true);
    } finally { btn.disabled = !state.repo; }
  }
  async function unlockUploadKey() {
    const btn = $("keygen-unlock");
    const file = $("keygen-encrypted").files[0];
    const password = $("keygen-password").value;
    if (!file || !file.name.endsWith(".ubenc")) return notice("Selecione um arquivo .ubenc.", true);
    btn.disabled = true;
    forgetRecoveredKey();
    // Forgetting inputs above is intentional for repo switches, not for unlocking.
    try {
      const encrypted = await file.arrayBuffer();
      recoveredUploadKey = await window.UniversalKeygen.decrypt(encrypted, password);
      $("keygen-recovered").hidden = false;
      $("keygen-result").textContent = "Chave desbloqueada localmente. Baixe e faça backup agora.";
    } catch (err) {
      $("keygen-result").textContent = err.message;
      notice(err.message, true);
    } finally { btn.disabled = false; }
  }
  function saveRecoveredKey() {
    if (!recoveredUploadKey) return;
    const url = URL.createObjectURL(new Blob([recoveredUploadKey], { type: "application/octet-stream" }));
    const a = document.createElement("a");
    a.href = url; a.download = "android-upload-key.jks";
    document.body.append(a); a.click(); a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60000);
    notice("Download do JKS iniciado. Guarde cópia independente da chave e das senhas.");
  }
  async function copyRecoveredBase64() {
    if (!recoveredUploadKey) return;
    try {
      await navigator.clipboard.writeText(window.UniversalKeygen.toBase64(recoveredUploadKey));
      notice("Base64 copiado. Cole em ANDROID_KEYSTORE_BASE64 nos Secrets do aplicativo.");
    } catch (_) {
      notice("O navegador não permitiu copiar. Use outro navegador HTTPS com acesso à área de transferência.", true);
    }
  }
  async function installWorkflow() {
    const btn = $("install-btn");
    btn.disabled = true;
    if (!confirm("Instalar ou sobrescrever os três workflows (build, assinatura e chave) neste repositório?")) {
      btn.disabled = !state.repo;
      return;
    }
    notice("Instalando workflows de compilação, assinatura e geração de chaves...");
    try {
      await ensureWorkflow(true);
      await ensureSignWorkflow(true);
      await ensureKeygenWorkflow(true);
      notice("Workflows instalados/atualizados. A ativação pode levar alguns segundos.");
    } catch (err) { notice(err.message, true); }
    finally { btn.disabled = !state.repo; }
  }
  async function signBuild(ev) {
    ev.preventDefault();
    const btn = $("sign-btn");
    btn.disabled = true;
    try {
      const repo = selected();
      const runId = $("sign-run-id").value.trim();
      const name = $("sign-artifact").value.trim();
      if (!/^[0-9]+$/.test(runId) || !/^[A-Za-z0-9._-]+$/.test(name) || !/-aab-unsigned$|-both-unsigned$/.test(name)) {
        throw new Error("Informe o Run ID e o nome de um artefato AAB unsigned criado pelo Universal Build.");
      }
      notice("Verificando workflow de assinatura...");
      await ensureSignWorkflow(false);
      await api(repoPath(repo) + "/actions/workflows/universal-sign.yml/dispatches", {
        method: "POST",
        body: JSON.stringify({ ref: selectedBranch(repo), inputs: { source_run_id: runId, artifact_name: name } })
      });
      notice("Assinatura solicitada! Acompanhe pelo link de assinaturas do GitHub. Os quatro Secrets devem estar cadastrados.");
      await refreshRuns();
    } catch (err) { notice(err.message, true); }
    finally { btn.disabled = !state.repo; }
  }
  async function uploadZip(file) {
    if (!file || !file.name.toLowerCase().endsWith(".zip")) throw new Error("Selecione um arquivo .zip.");
    if (file.size > MAX_ZIP) throw new Error("ZIP excede 15 MiB. Envie o projeto diretamente a um repositório GitHub.");
    const repo = selected();
    if (!repo.private && !confirm("Este repositório é público. O conteúdo do ZIP poderá ficar público. Deseja continuar?")) {
      throw new Error("Envio cancelado.");
    }
    const path = "uploads/ub-project-" + Date.now() + ".zip";
    const data = bytesBase64(new Uint8Array(await file.arrayBuffer()));
    await api(repoPath(repo) + "/contents/" + path, {
      method: "PUT",
      body: JSON.stringify({
        message: "build: importar fonte ZIP para Universal Build",
        content: data,
        branch: repo.default_branch
      })
    });
    return path;
  }
  async function runBuild(ev) {
    ev.preventDefault();
    const btn = $("run-btn");
    btn.disabled = true;
    try {
      const repo = selected();
      const branch = selectedBranch(repo);
      notice("Verificando workflow e preparando compilação na branch " + branch + "...");
      const installed = await ensureWorkflow(false);
      let zip = "";
      const file = $("project-zip").files[0];
      if (file) {
        notice("Enviando ZIP para o repositório (limite 15 MiB)...");
        zip = await uploadZip(file);
      }
      const inputs = {
        build_target: $("build-target").value,
        project_dir: $("project-dir").value.trim() || ".",
        android_module: $("android-module").value.trim() || "app",
        android_flavor: $("android-flavor").value,
        java_version: $("java-version").value,
        node_version: $("node-version").value,
        flutter_version: $("flutter-version").value.trim(),
        upload_zip_path: zip
      };
      // Um workflow recém-criado pode demorar a ser registrado pela API.
      let error;
      for (let i = 0; i < 3; i++) {
        try {
          await api(repoPath(repo) + "/actions/workflows/universal-build.yml/dispatches", {
            method: "POST", body: JSON.stringify({ ref: branch, inputs })
          });
          error = null;
          break;
        } catch (e) {
          error = e;
          if (e.status !== 404 || !installed) break;
          await new Promise((resolve) => setTimeout(resolve, 1800));
        }
      }
      if (error) throw error;
      lastDispatch = { repo: repo.full_name, branch, at: Date.now(),
        knownRunIds: (knownRunIds.get(repo.full_name + "/" + branch) || []).slice() };
      // Hide previous build artifacts before the next GitHub API response arrives.
      $("run-list").querySelectorAll(".artifact-line").forEach(line => line.remove());
      $("build-progress").hidden = false;
      $("build-progress-title").textContent = "Solicitação enviada · aguardando GitHub Actions";
      $("build-progress-bar").removeAttribute("value");
      $("build-progress-label").textContent = "A execução será identificada na próxima atualização automática.";
      notice("Build solicitado na branch " + branch + ". Acompanhe o progresso no painel.");
      $("project-zip").value = "";
      await refreshRuns();
    } catch (err) { notice(err.message, true); }
    finally { btn.disabled = !state.repo; }
  }

  // A native GitHub link downloads the ZIP in the signed-in browser without
  // reading GitHub's 302 artifact redirect through CORS-blocked fetch().
  function downloadArtifact(repo, run, artifact) {
    return "https://github.com/" + repo.full_name + "/actions/runs/" +
      encodeURIComponent(run.id) + "/artifacts/" + encodeURIComponent(artifact.id);
  }

  function createProgress(data, compact = false) {
    const wrapper = document.createElement("div");
    wrapper.className = compact ? "run-progress" : "build-progress";
    const label = document.createElement("p");
    label.className = "small";
    const progress = document.createElement("progress");
    progress.max = 100;
    if (data.percent !== null) progress.value = data.percent;
    progress.setAttribute("aria-label", "Etapas do workflow GitHub Actions");
    const detail = data.total ?
      data.done + " de " + data.total + " etapas concluídas" :
      "Aguardando detalhes do GitHub Actions";
    label.textContent = data.stage + " · " + detail +
      " (progresso das etapas, não porcentagem real do Gradle)";
    wrapper.append(progress, label);
    return wrapper;
  }

  function artifactDescription(artifact) {
    const name = artifact.name.toLowerCase();
    if (name.includes("both-unsigned")) return "APK + AAB sem assinatura";
    if (name.includes("unsigned")) return "AAB sem assinatura";
    if (name.includes("signed") || name.includes("assinado")) return "AAB de release assinado";
    if (name.includes("aab") || name.includes("bundle")) return "Bundle AAB";
    if (name.includes("apk")) return "APK instalável";
    return "Artefato da execução";
  }

  function displayPrimaryProgress(selection, details, branch) {
    const box = $("build-progress");
    const current = selection.current;
    if (!current) {
      if (selection.pending) {
        box.hidden = false;
        $("build-progress-title").textContent = "Aguardando início do workflow na branch " + branch;
        $("build-progress-bar").removeAttribute("value");
        $("build-progress-label").textContent = "O GitHub ainda não disponibilizou uma execução nova.";
      } else {
        box.hidden = true;
      }
      return;
    }
    const data = details.get(current.id) ||
      window.UniversalBuildProgress.summarize(current, []);
    box.hidden = false;
    $("build-progress-title").textContent = "Execução #" + current.run_number +
      " · " + current.head_branch + " · " + data.stage;
    if (data.percent === null) $("build-progress-bar").removeAttribute("value");
    else $("build-progress-bar").value = data.percent;
    $("build-progress-label").textContent = data.total ?
      data.done + "/" + data.total + " etapas concluídas · dados do GitHub Actions, não do Gradle." :
      "Aguardando detalhes das etapas no GitHub Actions; atualização automática.";
  }

  async function refreshRuns() {
    if (!state.repo || !isSessionValid() || document.hidden) return;
    const request = ++refreshRequestId;
    const repo = state.repo;
    const branch = selectedBranch(repo);
    const list = $("run-list");
    // Do not blank the screen on every poll: preserve controls until data arrives.
    if (!list.children.length) {
      const p = document.createElement("p");
      p.className = "small";
      p.textContent = "Consultando builds do GitHub...";
      list.append(p);
    }
    try {
      const workflows = ["universal-build.yml"];
      const groups = await Promise.all(workflows.map(async workflow => {
        try {
          const url = repoPath(repo) + "/actions/workflows/" + workflow +
            "/runs?per_page=12&branch=" + encodeURIComponent(branch);
          const response = await api(url);
          return response.workflow_runs || [];
        } catch (error) {
          if (error.status === 404) return [];
          throw error;
        }
      }));
      if (request !== refreshRequestId || !state.repo ||
          state.repo.full_name !== repo.full_name || selectedBranch(repo) !== branch) return;
      const runs = [...new Map(groups.flat().map(run => [run.id, run])).values()]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 15);
      const active = runs.filter(run => run.status !== "completed").slice(0, 5);
      const progressRows = await Promise.all(active.map(async run => {
        try {
          const response = await api(repoPath(repo) + "/actions/runs/" + run.id + "/jobs?per_page=100");
          return [run.id, window.UniversalBuildProgress.summarize(run, response.jobs || [])];
        } catch (_) {
          return [run.id, window.UniversalBuildProgress.summarize(run, [])];
        }
      }));
      if (request !== refreshRequestId || !state.repo ||
          state.repo.full_name !== repo.full_name || selectedBranch(repo) !== branch) return;
      knownRunIds.set(repo.full_name + "/" + branch, runs.map(run => run.id));
      const details = new Map(progressRows);
      const selection = window.UniversalBuildProgress.selectCurrentRun(
        runs, lastDispatch, repo.full_name, branch);
      displayPrimaryProgress(selection, details, branch);
      const fragment = document.createDocumentFragment();
      const historyFragment = document.createDocumentFragment();
      let historicalCount = 0;
      if (!selection.current) {
        const p = document.createElement("p");
        p.className = "small";
        p.textContent = selection.pending ? "Identificando o novo build no GitHub Actions..." :
          "Nenhuma compilação recente nesta branch. Inicie um build.";
        fragment.append(p);
      }
      for (const run of runs) {
        const isSign = false;
        const statusValue = run.conclusion || run.status;
        const row = document.createElement("div");
        row.className = "run";
        const main = document.createElement("div");
        main.className = "run-details";
        const title = document.createElement("div");
        title.className = "run-title";
        title.textContent = (isSign ? "Assinatura" : "Build") + " #" + run.run_number +
          " · " + run.head_branch;
        const meta = document.createElement("div");
        meta.className = "run-meta";
        meta.textContent = new Date(run.created_at).toLocaleString("pt-BR") +
          " · Run ID: " + run.id;
        const logs = document.createElement("a");
        logs.href = "https://github.com/" + repo.full_name + "/actions/runs/" + run.id;
        logs.target = "_blank";
        logs.rel = "noopener noreferrer";
        logs.textContent = "Ver logs no GitHub";
        main.append(title, meta);
        if (details.has(run.id)) main.append(createProgress(details.get(run.id), true));
        main.append(logs);
        const badge = document.createElement("span");
        badge.className = "state " + (statusValue === "success" ? "success" :
          statusValue === "failure" ? "failure" : "");
        badge.textContent = ({
          success: "Concluído", failure: "Falhou", in_progress: "Executando",
          queued: "Na fila", waiting: "Aguardando", cancelled: "Cancelado",
          timed_out: "Tempo esgotado", action_required: "Ação necessária"
        })[statusValue] || statusValue;
        row.append(main, badge);
        // Keep old runs visible for logs, but never offer artifacts from a previous run.
        if (statusValue === "success" && selection.current?.id === run.id) {
          try {
            let response = artifactsByRun.get(repo.full_name + "/" + run.id);
            if (!response) {
              response = await api(repoPath(repo) + "/actions/runs/" + run.id + "/artifacts?per_page=100");
              artifactsByRun.set(repo.full_name + "/" + run.id, response);
              if (artifactsByRun.size > 120) artifactsByRun.delete(artifactsByRun.keys().next().value);
            }
            if (request !== refreshRequestId || !state.repo ||
                state.repo.full_name !== repo.full_name || selectedBranch(repo) !== branch) return;
            for (const artifact of response.artifacts || []) {
              const line = document.createElement("div");
              line.className = "artifact-line";
              const label = document.createElement("span");
              label.textContent = "📦 " + artifactDescription(artifact) + " · " +
                artifact.name + (artifact.expired ? " · expirado" : "");
              line.append(label);
              if (!artifact.expired) {
                const actions = document.createElement("div");
                actions.className = "artifact-actions";
                const download = document.createElement("a");
                download.className = "secondary artifact-download";
                download.href = downloadArtifact(repo, run, artifact);
                download.target = "_blank";
                download.rel = "noopener noreferrer";
                download.textContent = "Baixar ZIP no GitHub";
                download.title = "Requer sessão iniciada no GitHub";
                actions.append(download);
                if (!isSign && (artifact.name.endsWith("-aab-unsigned") ||
                    artifact.name.endsWith("-both-unsigned"))) {
                  const sign = document.createElement("button");
                  sign.type = "button";
                  sign.className = "secondary";
                  sign.textContent = "Selecionar para assinatura";
                  sign.addEventListener("click", () => {
                    $("sign-run-id").value = String(run.id);
                    $("sign-artifact").value = artifact.name;
                    $("sign-form").scrollIntoView({ behavior: "smooth", block: "center" });
                    notice("AAB sem assinatura selecionado. Confira os dados e inicie a assinatura.");
                  });
                  actions.append(sign);
                }
                line.append(actions);
              }
              main.append(line);
            }
          } catch (error) {
            const info = document.createElement("p");
            info.className = "small";
            info.textContent = "Artefatos indisponíveis nesta execução: " + error.message;
            main.append(info);
          }
        }
        if (selection.current?.id === run.id) fragment.append(row);
        else { historicalCount++; historyFragment.append(row); }
      }
      list.replaceChildren(fragment);
      $("history-list").replaceChildren(historyFragment);
      $("history-summary").textContent = "Compilações anteriores (" + historicalCount + ")";
      $("history-details").hidden = historicalCount === 0;
    } catch (error) {
      if (request !== refreshRequestId || !state.repo ||
          state.repo.full_name !== repo.full_name) return;
      const p = document.createElement("p");
      p.className = "small";
      p.textContent = "Não foi possível atualizar o histórico: " + error.message;
      list.replaceChildren(p);
      $("history-list").replaceChildren();
      $("history-details").hidden = true;
      // Periodic polling must not flood the toast stack when the API rate-limits.
    }
  }

  $("login-form").addEventListener("submit", login);
  $("logout-btn").addEventListener("click", () => { clearSession(); notice("Conexão encerrada."); });
  $("repo-select").addEventListener("change", selectRepo);
  $("branch-select").addEventListener("change", changeBranch);
  $("refresh-repos").addEventListener("click", () => loadRepos());
  $("new-repo-form").addEventListener("submit", createRepo);
  $("install-btn").addEventListener("click", installWorkflow);
  $("build-form").addEventListener("submit", runBuild);
  $("admob-form").addEventListener("submit", saveAdmobConfig);
  $("sign-form").addEventListener("submit", signBuild);
  $("keygen-start").addEventListener("click", generateUploadKey);
  $("keygen-unlock").addEventListener("click", unlockUploadKey);
  $("keygen-save-jks").addEventListener("click", saveRecoveredKey);
  $("keygen-copy-base64").addEventListener("click", copyRecoveredBase64);
  $("refresh-runs").addEventListener("click", refreshRuns);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) isSessionValid();
  });
  // Polling real do GitHub Actions, em intervalos curtos; não simula progresso do Gradle.
  window.setInterval(() => {
    if (!document.hidden && state.repo && isSessionValid()) refreshRuns();
  }, 12000);
  restore();
})();