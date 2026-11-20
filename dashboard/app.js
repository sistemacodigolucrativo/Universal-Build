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
  const $ = (id) => document.getElementById(id);

  function notice(message, error = false) {
    const box = $("notice");
    box.hidden = !message;
    box.textContent = message || "";
    box.classList.toggle("error", !!error);
  }
  function midnight() {
    const day = new Date();
    day.setHours(24, 0, 0, 0);
    return day.getTime();
  }
  function clearSession() {
    state.token = "";
    state.login = "";
    state.expires = 0;
    state.repo = null;
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
  async function loadRepos(preferred = "") {
    if (!isSessionValid()) return;
    notice("Carregando repositórios...");
    try {
      const all = [];
      for (let page = 1; page <= 5; page++) {
        const data = await api("/user/repos?affiliation=owner&sort=updated&per_page=100&page=" + page);
        all.push(...data);
        if (data.length < 100) break;
      }
      state.repos = all.filter((r) => r.permissions && r.permissions.push);
      const select = $("repo-select");
      const selectedName = preferred || (state.repo && state.repo.full_name);
      select.replaceChildren(new Option("Selecione um repositório", ""));
      for (const r of state.repos) {
        select.add(new Option(r.full_name + (r.private ? " · privado" : ""), r.full_name));
      }
      if (selectedName && state.repos.some((r) => r.full_name === selectedName)) {
        select.value = selectedName;
      }
      selectRepo();
      notice("Repositórios atualizados.");
    } catch (err) { notice(err.message, true); }
  }
  function selectRepo() {
    state.repo = state.repos.find((r) => r.full_name === $("repo-select").value) || null;
    const active = !!state.repo;
    $("install-btn").disabled = !active;
    $("run-btn").disabled = !active;
    $("refresh-runs").disabled = !active;
    $("open-repo").hidden = !active;
    if (active) {
      $("open-repo").href = "https://github.com/" + state.repo.full_name;
      refreshRuns();
    } else {
      $("run-list").replaceChildren();
      const p = document.createElement("p");
      p.className = "small";
      p.textContent = "Selecione um repositório para visualizar o histórico.";
      $("run-list").append(p);
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
      notice("Repositório criado: " + repo.full_name);
    } catch (err) { notice(err.message + ". Se o token não permitir criação, crie o repositório pelo site GitHub.", true); }
  }
  async function template() {
    const path = "/repos/" + CORE + "/contents/templates/android-build.yml?ref=main";
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
  async function installWorkflow() {
    const btn = $("install-btn");
    btn.disabled = true;
    notice("Instalando workflow reutilizável no repositório selecionado...");
    try {
      const changed = await ensureWorkflow(true);
      notice(changed ? "Workflow instalado/atualizado. A ativação pode levar alguns segundos no GitHub." : "Workflow existente.");
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
      notice("Verificando workflow e preparando compilação...");
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
            method: "POST", body: JSON.stringify({ ref: repo.default_branch, inputs })
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
      notice("Build solicitado! Atualize o histórico em alguns segundos.");
      $("project-zip").value = "";
      await refreshRuns();
    } catch (err) { notice(err.message, true); }
    finally { btn.disabled = !state.repo; }
  }
  async function refreshRuns() {
    if (!state.repo || !isSessionValid()) return;
    const repo = state.repo;
    const list = $("run-list");
    list.replaceChildren();
    const p = document.createElement("p");
    p.className = "small";
    p.textContent = "Buscando execuções...";
    list.append(p);
    try {
      const result = await api(repoPath(repo) + "/actions/workflows/universal-build.yml/runs?per_page=10");
      if (!state.repo || state.repo.full_name !== repo.full_name) return;
      list.replaceChildren();
      if (!result.workflow_runs.length) {
        p.textContent = "Ainda não há builds nesse repositório.";
        list.append(p);
        return;
      }
      for (const run of result.workflow_runs) {
        const row = document.createElement("div");
        row.className = "run";
        const text = document.createElement("div");
        const title = document.createElement("div");
        title.className = "run-title";
        title.textContent = "Build #" + run.run_number + " · " + run.head_branch;
        const meta = document.createElement("div");
        meta.className = "run-meta";
        meta.textContent = new Date(run.created_at).toLocaleString("pt-BR") + " · " + (run.display_title || "Android");
        const link = document.createElement("a");
        link.href = "https://github.com/" + repo.full_name + "/actions/runs/" + run.id;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Ver build e baixar ↗";
        text.append(title, meta, link);
        const status = document.createElement("span");
        const s = run.conclusion || run.status;
        status.className = "state " + (s === "success" ? "success" : s === "failure" ? "failure" : "");
        status.textContent = ({ success: "Sucesso", failure: "Falha", in_progress: "Executando", queued: "Na fila", cancelled: "Cancelado" })[s] || s;
        row.append(text, status);
        list.append(row);
      }
    } catch (err) {
      list.replaceChildren();
      p.textContent = "Histórico indisponível: " + err.message;
      list.append(p);
    }
  }

  $("login-form").addEventListener("submit", login);
  $("logout-btn").addEventListener("click", () => { clearSession(); notice("Conexão encerrada."); });
  $("repo-select").addEventListener("change", selectRepo);
  $("refresh-repos").addEventListener("click", () => loadRepos());
  $("new-repo-form").addEventListener("submit", createRepo);
  $("install-btn").addEventListener("click", installWorkflow);
  $("build-form").addEventListener("submit", runBuild);
  $("refresh-runs").addEventListener("click", refreshRuns);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) isSessionValid();
  });
  restore();
})();