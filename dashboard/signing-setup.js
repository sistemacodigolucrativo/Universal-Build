/* Automatic GitHub Actions Secrets provisioning for one Android application.
 * Secrets are sealed with the repository's GitHub public key in this browser.
 * Never send raw JKS/passwords to GitHub or store them in localStorage. */
(function (root) {
  "use strict";
  const secretNames = [
    "ANDROID_KEYSTORE_BASE64", "ANDROID_KEYSTORE_PASSWORD",
    "ANDROID_KEY_ALIAS", "ANDROID_KEY_PASSWORD"
  ];
  const $ = id => document.getElementById(id);
  let config = null;
  let generatedPassword = "";
  let unlockedPassword = "";
  let pendingRepo = "";
  let inFlight = false;
  let generationStarted = false;
  let configured = false;
  let inspectionId = 0;

  function status(message, error = false) {
    $("keygen-secrets-status").textContent = message;
    if (error && config) config.notice(message, true);
  }
  function sameRepo(repo) {
    try { return !!config && config.selected().full_name === repo.full_name; }
    catch (_) { return false; }
  }
  function assertRepo(repo) {
    if (!sameRepo(repo)) throw new Error("O aplicativo selecionado mudou. Inicie novamente por segurança.");
  }
  function clearSensitive() {
    generatedPassword = "";
    unlockedPassword = "";
    pendingRepo = "";
    generationStarted = false;
    configured = false;
    if ($("keygen-quick-password")) $("keygen-quick-password").value = "";
    $("keygen-password-box").hidden = true;
    $("keygen-saved-check").checked = false;
    $("keygen-backup-confirmed").checked = false;
    $("keygen-confirm").disabled = true;
    $("keygen-auto-configure").disabled = true;
    $("existing-key-file").value = "";
    $("existing-store-password").value = "";
    $("existing-key-password").value = "";
  }
  async function listSecrets(repo) {
    const names = new Set();
    for (let page = 1; page <= 10; page++) {
      const data = await config.api(config.repoPath(repo) + "/actions/secrets?per_page=100&page=" + page);
      if (!data || !Array.isArray(data.secrets))
        throw new Error("Não foi possível consultar os Secrets do aplicativo.");
      data.secrets.forEach(item => names.add(item.name));
      if (data.secrets.length < 100 ||
          (Number.isFinite(data.total_count) && page * 100 >= data.total_count)) return names;
    }
    throw new Error("Limite de consulta de Secrets atingido. Por segurança não é possível alterar a assinatura.");
  }
  async function repoPublicKey(repo) {
    const data = await config.api(config.repoPath(repo) + "/actions/secrets/public-key");
    if (!data || !data.key_id || !data.key)
      throw new Error("GitHub não disponibilizou a chave pública de criptografia dos Secrets.");
    return data;
  }
  async function putSecret(repo, publicKey, name, value) {
    assertRepo(repo);
    const payload = root.UniversalGithubSecrets.makePayload(value, publicKey);
    await config.api(config.repoPath(repo) + "/actions/secrets/" + name, {
      method: "PUT",
      body: JSON.stringify(payload)
    });
  }
  function allConfigured(names) {
    return secretNames.every(name => names.has(name));
  }
  async function refresh(repo = null) {
    const request = ++inspectionId;
    const active = repo || (() => { try { return config.selected(); } catch (_) { return null; } })();
    if (!active) {
      $("keygen-auto-start").disabled = true;
      $("existing-key-upload").disabled = true;
      status("Selecione um aplicativo na opção 1.");
      return;
    }
    if (!active.permissions || !active.permissions.admin) {
      $("keygen-auto-start").disabled = true;
      $("existing-key-upload").disabled = true;
      status("Esta conta precisa de acesso administrativo aos Secrets deste aplicativo.", true);
      return;
    }
    status("Consultando as configurações de assinatura no GitHub...");
    try {
      const names = await listSecrets(active);
      if (request !== inspectionId || !sameRepo(active)) return;
      const count = secretNames.filter(name => names.has(name)).length;
      configured = count === 4;
      if (configured) status("✅ Os quatro Secrets de assinatura já existem. Não gere outra chave; você pode assinar o AAB.");
      else if (count) status("⚠️ " + count + "/4 Secrets existentes. Não substitua uma chave de aplicativo já publicado; recupere o JKS original ou conclua uma configuração anterior.");
      else status("Nenhum Secret de assinatura encontrado. Se é o primeiro lançamento, você pode gerar uma nova chave automaticamente.");
      $("keygen-auto-start").disabled = configured || count > 0 || inFlight;
      $("existing-key-upload").disabled = configured || inFlight;
    } catch (error) {
      if (request !== inspectionId || !sameRepo(active)) return;
      $("keygen-auto-start").disabled = true;
      $("existing-key-upload").disabled = true;
      status("Não foi possível acessar os Secrets. Verifique permissão Actions Secrets (leitura e escrita) do token: " + error.message, true);
    }
  }
  function downloadText(filename, body) {
    const object = URL.createObjectURL(new Blob([body], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = object;
    anchor.download = filename;
    document.body.append(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(object), 30000);
  }
  function passwordNote(repoName, password) {
    return "UNIVERSAL BUILD - RECUPERAÇÃO DA CHAVE DE ASSINATURA\n" +
      "Aplicativo/repositório: " + repoName + "\n" +
      "Alias: upload\nSenha do keystore e da chave: " + password + "\n\n" +
      "IMPORTANTE: arquivo em texto simples (NÃO criptografado). Proteja-o em local privado.\n" +
      "Guarde separadamente o JKS original depois de desbloquear o backup .ubenc.\n" +
      "Nunca altere a chave usada por um app já publicado na Google Play.\n";
  }
  async function copyPassword() {
    const password = generatedPassword;
    if (!password) return;
    try {
      await navigator.clipboard.writeText(password);
      config.notice("Senha copiada. Guarde-a em seu gerenciador de senhas.");
    } catch (_) {
      config.notice("Cópia não permitida pelo navegador. Use 'Salvar instruções e senha'.", true);
    }
  }
  function savePassword() {
    if (!generatedPassword) return;
    const safe = pendingRepo.replace(/[^A-Za-z0-9_-]/g, "-");
    downloadText("Universal-Build-recuperacao-" + safe + ".txt", passwordNote(pendingRepo, generatedPassword));
    config.notice("Download do arquivo de recuperação iniciado. Ele contém senha em texto simples: proteja-o.");
  }
  async function prepareAuto() {
    if (inFlight) return;
    let repo;
    try { repo = config.selected(); }
    catch (error) { return config.notice(error.message, true); }
    if (!repo.permissions || !repo.permissions.admin)
      return status("É necessário acesso administrativo ao repositório do aplicativo.", true);
    inFlight = true;
    $("keygen-auto-start").disabled = true;
    try {
      const existing = await listSecrets(repo);
      assertRepo(repo);
      if (secretNames.some(name => existing.has(name)))
        throw new Error("Já existem Secrets de assinatura. Não será criada uma nova chave para evitar substituir a original.");
      if (!confirm("CONFIRMA primeira chave de upload para " + repo.full_name +
          "? Se este aplicativo já foi publicado, cancele e utilize a chave original.")) return;
      clearSensitive();
      generatedPassword = root.UniversalGithubSecrets.generatePassword();
      pendingRepo = repo.full_name;
      $("keygen-quick-password").value = generatedPassword;
      $("keygen-password-box").hidden = false;
      $("keygen-password-box").scrollIntoView({ behavior: "smooth", block: "center" });
      status("Senha exclusiva gerada neste navegador. Salve a senha e confirme o backup antes de iniciar.");
    } catch (error) {
      if (sameRepo(repo)) status(error.message, true);
    } finally {
      inFlight = false;
      if (sameRepo(repo)) $("keygen-auto-start").disabled = !!generatedPassword || configured;
    }
  }
  async function startGeneration() {
    if (inFlight || generationStarted) return;
    const repo = config.selected();
    if (!generatedPassword || pendingRepo !== repo.full_name || !$("keygen-saved-check").checked)
      return status("Guarde a senha gerada e marque a confirmação primeiro.", true);
    inFlight = true;
    $("keygen-confirm").disabled = true;
    try {
      const existing = await listSecrets(repo);
      assertRepo(repo);
      if (secretNames.some(name => existing.has(name)))
        throw new Error("Foram encontrados Secrets preexistentes. Geração bloqueada para não substituir sua chave.");
      const publicKey = await repoPublicKey(repo);
      assertRepo(repo);
      await putSecret(repo, publicKey, "ANDROID_KEYSTORE_PASSWORD", generatedPassword);
      // From here on a retry is safe only after inspecting the Actions run.
      status("Senha protegida no GitHub. Preparando a geração da chave...");
      await config.ensureKeygenWorkflow(false);
      let lastError;
      for (let attempt = 0; attempt < 4; attempt++) {
        try {
          await config.api(config.repoPath(repo) + "/actions/workflows/universal-keygen.yml/dispatches", {
            method: "POST", body: JSON.stringify({ ref: repo.default_branch })
          });
          lastError = null;
          break;
        } catch (error) {
          lastError = error;
          if (error.status !== 404 || attempt === 3) break;
          await new Promise(resolve => window.setTimeout(resolve, 2000));
        }
      }
      if (lastError) throw lastError;
      generationStarted = true;
      status("✅ Geração iniciada no GitHub Actions. Guarde a senha, baixe o ZIP e importe o arquivo .ubenc abaixo.");
      config.notice("Chave solicitada! Aguarde o workflow e baixe o ZIP criptografado.");
    } catch (error) {
      if (sameRepo(repo)) {
        status("Não foi possível concluir a geração: " + error.message +
          ". Verifique o histórico do GitHub antes de repetir, para não criar duas chaves.", true);
      }
    } finally {
      inFlight = false;
      $("keygen-confirm").disabled = !generatedPassword || generationStarted || !$("keygen-saved-check").checked;
    }
  }
  function onUnlock(password) {
    unlockedPassword = password;
    $("keygen-backup-confirmed").checked = false;
    $("keygen-auto-configure").disabled = true;
    status("Chave desbloqueada. Baixe o JKS, guarde a senha e confirme o backup para configurar os Secrets.");
  }
  function onLock() {
    unlockedPassword = "";
    $("keygen-backup-confirmed").checked = false;
    $("keygen-auto-configure").disabled = true;
  }
  async function configureKey(repo, keyBytes, storePassword, alias, keyPassword, mode) {
    if (inFlight) return;
    if (!(keyBytes instanceof Uint8Array) || keyBytes.length < 100 || keyBytes.length > 256 * 1024)
      throw new Error("Arquivo JKS inválido ou tamanho não aceito.");
    if (!storePassword || !alias || !keyPassword || !/^[A-Za-z0-9._-]+$/.test(alias))
      throw new Error("Senha e alias obrigatórios (alias: letras, números, ponto, hífen ou _).");
    inFlight = true;
    $("keygen-auto-configure").disabled = true;
    $("existing-key-upload").disabled = true;
    try {
      const names = await listSecrets(repo);
      assertRepo(repo);
      if (names.has("ANDROID_KEYSTORE_BASE64"))
        throw new Error("Já existe uma chave de assinatura cadastrada. Não substituímos chaves automaticamente. Se já está configurado, assine diretamente.");
      if ((names.has("ANDROID_KEY_ALIAS") || names.has("ANDROID_KEY_PASSWORD")) &&
          !confirm("A configuração anterior foi interrompida e há Secrets parciais, mas sem JKS salvo. Confirmar a conclusão com ESTA chave e senha?")) return;
      if (mode === "existing" && !confirm("Configurar a chave existente para " + repo.full_name +
          "? Confirme que este é o JKS original usado pelo aplicativo na Google Play.")) return;
      const publicKey = await repoPublicKey(repo);
      assertRepo(repo);
      const base64 = root.UniversalKeygen.toBase64(keyBytes.buffer.slice(keyBytes.byteOffset, keyBytes.byteOffset + keyBytes.byteLength));
      status("Configurando os Secrets criptografados no repositório do aplicativo...");
      // Upload private JKS LAST, so its existence marks a completed config.
      await putSecret(repo, publicKey, "ANDROID_KEYSTORE_PASSWORD", storePassword);
      await putSecret(repo, publicKey, "ANDROID_KEY_ALIAS", alias);
      await putSecret(repo, publicKey, "ANDROID_KEY_PASSWORD", keyPassword);
      await putSecret(repo, publicKey, "ANDROID_KEYSTORE_BASE64", base64);
      const confirmed = await listSecrets(repo);
      if (!allConfigured(confirmed)) throw new Error("O GitHub não confirmou os quatro Secrets.");
      configured = true;
      status("✅ Assinatura configurada: 4 Secrets criptografados no GitHub. O AAB já pode ser assinado na opção 5.");
      config.notice("Configuração concluída. Use 'Assinar AAB na nuvem' sem cadastrar Secrets manualmente.");
      unlockedPassword = "";
      generatedPassword = "";
      $("keygen-quick-password").value = "";
      $("keygen-password-box").hidden = true;
      $("existing-store-password").value = "";
      $("existing-key-password").value = "";
      $("existing-key-file").value = "";
      $("keygen-auto-start").disabled = true;
    } catch (error) {
      if (sameRepo(repo)) status("Falha na configuração automática: " + error.message, true);
    } finally {
      inFlight = false;
      $("keygen-auto-configure").disabled = configured || !unlockedPassword || !$("keygen-backup-confirmed").checked;
      $("existing-key-upload").disabled = configured;
    }
  }
  async function configureRecovered() {
    const repo = config.selected();
    const buf = config.getRecoveredKey();
    if (!buf || !unlockedPassword) return status("Primeiro importe e desbloqueie seu .ubenc.", true);
    if (!$("keygen-backup-confirmed").checked) return status("Confirme que guardou o JKS e a senha.", true);
    return configureKey(repo, new Uint8Array(buf), unlockedPassword, "upload", unlockedPassword, "recovered");
  }
  async function configureExisting() {
    const repo = config.selected();
    const file = $("existing-key-file").files[0];
    const password = $("existing-store-password").value;
    const alias = $("existing-key-alias").value.trim();
    const keyPassword = $("existing-key-password").value || password;
    if (!file || !/\.(?:jks|keystore|p12|pfx)$/i.test(file.name))
      return status("Selecione seu JKS/keystore original.", true);
    if (file.size < 100 || file.size > 256 * 1024)
      return status("Arquivo de chave precisa ter entre 100 bytes e 256 KiB.", true);
    if (!password) return status("Informe a senha original da chave.", true);
    try {
      const data = new Uint8Array(await file.arrayBuffer());
      try { await configureKey(repo, data, password, alias, keyPassword, "existing"); }
      finally { data.fill(0); }
    } catch (error) {
      status(error.message, true);
    }
  }
  function onRepoChange() {
    inspectionId++;
    clearSensitive();
    $("keygen-auto-start").disabled = true;
    $("existing-key-upload").disabled = true;
    void refresh();
  }
  function init(options) {
    config = options;
    $("keygen-auto-start").addEventListener("click", prepareAuto);
    $("keygen-password-copy").addEventListener("click", copyPassword);
    $("keygen-password-save").addEventListener("click", savePassword);
    $("keygen-saved-check").addEventListener("change", () => {
      $("keygen-confirm").disabled = !$("keygen-saved-check").checked || !generatedPassword || generationStarted || inFlight;
    });
    $("keygen-confirm").addEventListener("click", startGeneration);
    $("keygen-backup-confirmed").addEventListener("change", () => {
      $("keygen-auto-configure").disabled = !$("keygen-backup-confirmed").checked || !unlockedPassword || inFlight || configured;
    });
    $("keygen-auto-configure").addEventListener("click", configureRecovered);
    $("existing-key-upload").addEventListener("click", configureExisting);
  }
  root.UniversalSigningSetup = { init, onRepoChange, onUnlock, onLock, refresh, clearSensitive };
})(typeof globalThis !== "undefined" ? globalThis : this);
