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
    state.repos = [];
    repoScanId++;
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
  // Uma consulta ao GitHub por repositório é necessária: nome/linguagem não provam que existe app Android.
  // O limite de simultaneidade impede sobrecarga e permite avisar sobre verificações incompletas.
  async function loadRepos(preferred = "") {
    if (!isSessionValid()) return;
    const requestId = ++repoScanId;
    const select = $("repo-select");
    const selectedName = preferred || select.value || (state.repo && state.repo.full_name);
    select.disabled = true;
    select.replaceChildren(new Option("Verificando projetos Android...", ""));
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
              notice("Analisando projetos Android: " + checked + "/" + candidates.length +
                " · identificados: " + androidRepos.length);
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
  function selectRepo() {
    state.repo = state.repos.find((r) => r.full_name === $("repo-select").value) || null;
    const active = !!state.repo;
    $("install-btn").disabled = !active;
    $("run-btn").disabled = !active;
    $("refresh-runs").disabled = !active;
    $("sign-btn").disabled = !active;
    $("open-repo").hidden = !active;
    if (active) {
      $("open-repo").href = "https://github.com/" + state.repo.full_name;
      $("secrets-link").href = "https://github.com/" + state.repo.full_name + "/settings/secrets/actions";
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
  async function installWorkflow() {
    const btn = $("install-btn");
    btn.disabled = true;
    if (!confirm("Instalar ou sobrescrever os dois workflows do Universal Build neste repositório?")) {
      btn.disabled = !state.repo;
      return;
    }
    notice("Instalando os workflows de compilação e assinatura...");
    try {
      await ensureWorkflow(true);
      await ensureSignWorkflow(true);
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
        body: JSON.stringify({ ref: repo.default_branch, inputs: { source_run_id: runId, artifact_name: name } })
      });
      notice("Assinatura solicitada! Acompanhe o processo no histórico. A chave de upload deve estar configurada nos Secrets do aplicativo.");
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
    const waiting = document.createElement("p");
    waiting.className = "small";
    waiting.textContent = "Consultando builds e assinaturas no GitHub...";
    list.append(waiting);
    try {
      const workflows = ["universal-build.yml", "universal-sign.yml"];
      const groups = await Promise.all(workflows.map(async (workflow) => {
        try {
          const response = await api(repoPath(repo) + "/actions/workflows/" + workflow + "/runs?per_page=12");
          return response.workflow_runs || [];
        } catch (err) {
          if (err.status === 404) return [];
          throw err;
        }
      }));
      if (!state.repo || state.repo.full_name !== repo.full_name) return;
      const runs = groups.flat().sort((a, b) => new Date(b.created_at) - new Date(a.created_at)).slice(0, 15);
      list.replaceChildren();
      if (!runs.length) {
        waiting.textContent = "Ainda não há compilações. Instale os workflows e inicie o primeiro build.";
        list.append(waiting);
        return;
      }
      for (const run of runs) {
        const isSign = run.path && run.path.endsWith("/universal-sign.yml");
        const row = document.createElement("div");
        row.className = "run";
        const details = document.createElement("div");
        details.className = "run-details";
        const title = document.createElement("div");
        title.className = "run-title";
        title.textContent = (isSign ? "Assinatura" : "Build") + " #" + run.run_number + " · " + run.head_branch;
        const meta = document.createElement("div");
        meta.className = "run-meta";
        meta.textContent = new Date(run.created_at).toLocaleString("pt-BR") + " · Run ID: " + run.id;
        const link = document.createElement("a");
        link.href = "https://github.com/" + repo.full_name + "/actions/runs/" + run.id;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "Ver logs e baixar artefatos ↗";
        details.append(title, meta, link);
        const status = document.createElement("span");
        const st = run.conclusion || run.status;
        status.className = "state " + (st === "success" ? "success" : st === "failure" ? "failure" : "");
        status.textContent = ({ success: "Concluído", failure: "Falha", in_progress: "Executando", queued: "Na fila", cancelled: "Cancelado" })[st] || st;
        row.append(details, status);
        list.append(row);
        if (st === "success") {
          try {
            const artifacts = await api(repoPath(repo) + "/actions/runs/" + run.id + "/artifacts?per_page=30");
            if (!state.repo || state.repo.full_name !== repo.full_name) return;
            for (const artifact of artifacts.artifacts || []) {
              const artifactLine = document.createElement("div");
              artifactLine.className = "artifact-line";
              const label = document.createElement("span");
              label.textContent = "📦 " + artifact.name + (artifact.expired ? " (expirado)" : "");
              artifactLine.append(label);
              if (!artifact.expired && !isSign && (artifact.name.endsWith("-aab-unsigned") || artifact.name.endsWith("-both-unsigned"))) {
                const signBtn = document.createElement("button");
                signBtn.type = "button";
                signBtn.className = "secondary";
                signBtn.textContent = "Assinar este AAB";
                signBtn.addEventListener("click", () => {
                  $("sign-run-id").value = String(run.id);
                  $("sign-artifact").value = artifact.name;
                  $("sign-form").scrollIntoView({ behavior: "smooth", block: "center" });
                  notice("AAB selecionado. Clique em Assinar AAB na nuvem.");
                });
                artifactLine.append(signBtn);
              }
              details.append(artifactLine);
            }
          } catch (_) {
            // A ausência de permissão para listar artefatos não impede abrir a execução.
          }
        }
      }
    } catch (err) {
      list.replaceChildren();
      waiting.textContent = "Histórico indisponível: " + err.message;
      list.append(waiting);
    }
  }

  $("login-form").addEventListener("submit", login);
  $("logout-btn").addEventListener("click", () => { clearSession(); notice("Conexão encerrada."); });
  $("repo-select").addEventListener("change", selectRepo);
  $("refresh-repos").addEventListener("click", () => loadRepos());
  $("new-repo-form").addEventListener("submit", createRepo);
  $("install-btn").addEventListener("click", installWorkflow);
  $("build-form").addEventListener("submit", runBuild);
  $("sign-form").addEventListener("submit", signBuild);
  $("refresh-runs").addEventListener("click", refreshRuns);
  document.addEventListener("visibilitychange", () => {
    if (!document.hidden) isSessionValid();
  });
  // Atualização discreta enquanto o painel está em primeiro plano.
  window.setInterval(() => {
    if (!document.hidden && state.repo && isSessionValid()) refreshRuns();
  }, 30000);
  restore();
})();