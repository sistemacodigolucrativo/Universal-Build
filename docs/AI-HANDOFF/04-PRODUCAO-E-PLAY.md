# 04 — Produção, assinatura, distribuição e segurança

## Princípios

**Ciclo de desenvolvimento ≠ ciclo de release.** A etapa de teste cria um APK debug e pode produzir AAB unsigned. O upload ao Google Play Console exige **AAB de release assinado**, identidade correta, controles de segurança e aprovação das políticas Google Play. O Universal Build **não** faz publicação automática.

**Antes de executar produção:** conferir requisitos *atuais* do Play Console (API alvo, Billing quando aplicável, permissões, privacidade, idade, anúncios, exigências de teste), pois políticas mudam. A documentação existente cita `targetSdk 36` para Android mobile em novembro de 2026 e o motor rejeita bundle com API abaixo de 36; isso descreve a regra codificada, **não substitui verificação junto ao Google**.

## 1. Preparação de release

- `applicationId` e assinatura de upload consistentes com o aplicativo já cadastrado; não mudar identidade após publicar sem plano de migração.
- `versionCode` maior do que o último enviado ao Google Play; `versionName` coerente.
- Tela de inicialização, ícones, strings, idioma, acessibilidade, min/target/compile SDK e testes em dispositivos.
- Compatibilidade com Android 7–16 e ROMs (One UI/HyperOS etc.) **somente** se houver evidência; pipeline não testa todas as ROMs.
- Política de privacidade, Play Data Safety, fluxo de consentimento e política de anúncios, quando houver SDKs.
- Revisão de licença, bibliotecas, segredos, logs, permissões, backup e armazenamento de dados.

## 2. Escolher um dos dois fluxos de assinatura

### Fluxo recomendado: compilar e assinar depois

1. Na versão aprovada do app, rodar `build_target=aab-unsigned` (ou `both-unsigned`).
2. Confirmar sucesso e obter Run ID + nome exato do artifact. Não publicar `unsigned.aab`.
3. Criar **no repositório do aplicativo** os quatro secrets de assinatura para workflow apropriado:
   - `ANDROID_KEYSTORE_BASE64` — JKS de upload codificado em Base64.
   - `ANDROID_KEYSTORE_PASSWORD` — senha da keystore.
   - `ANDROID_KEY_ALIAS` — alias da chave.
   - `ANDROID_KEY_PASSWORD` — senha da chave.
4. Pelo painel ou Actions, disparar `.github/workflows/universal-sign.yml` com `source_run_id` e `artifact_name` unsigned.
5. O fluxo chama `sign-reusable.yml@main`, baixa o artifact **sem recompilar a fonte**, executa `scripts/sign-aab.sh`, verifica `jarsigner`, `targetSdk` e `versionCode`, e publica `release-signed.aab`.
6. Verificar fingerprint/certificado de upload, arquivo gerado, origem do build, assinatura e conteúdo; então subir manualmente no Play Console com os demais requisitos.

**Limites:** o workflow posterior assina **AAB**, não APK release; precisa do artefato e secrets corretos. A origem do AAB deve ser confiável. O JKS e senhas reais não podem aparecer no Git, IA ou logs.

### Fluxo alternativo: assinar durante a compilação

Os targets `aab` e `both` passam secrets ao motor e exportam `UNIVERSAL_STORE_*`/`UNIVERSAL_KEY_*` e `ANDROID_KEYSTORE_*`; o script Gradle do aplicativo deve consumir essas variáveis em sua configuração de `release`. `release-apk` segue a assinatura integrada ao Gradle. A PR/release deve validar os artefatos gerados, não apenas concluir o job.

### Fluxo específico do Kotlin Master

O workflow próprio `.github/workflows/release.yml` usa o **GitHub Environment `release`**, decodifica um JKS temporário e gera `assembleProdRelease` + `bundleProdRelease`. Esse é um **terceiro caminho operacional** do template, distinto do comando no painel. Se os secrets forem configurados no environment e não no repositório, um workflow que espera secrets de repositório pode não recebê-los; verificar o escopo correto por workflow.

## 3. Critérios de aprovação e evidências mínimas

| Fase | Gate / evidência |
|---|---|
| Fonte | PR revisada, branch/commit conhecido, checklist de requisito completo |
| Estática | CI, lint, testes, dependências, verificação de permissões e secrets |
| APK | Artifact associado ao SHA, instalação no Android, navegação, offline/retomada, ausência de crashes |
| AAB unsigned | Artifact, SHA, manifest verificado, declaração explícita de que **não é publicável** |
| AAB assinado | `jarsigner` validado, certificado correto, `targetSdk/versionCode`, keystore guardada |
| Console Play | Teste interno quando aplicável, avisos e formulários concluídos, upload aceito |
| Produção | Track rollout, versionCode, URL/versão, crash/ANR e checklist de reversão |

A simples existência de workflow não confirma aprovação no Play Console nem instalação funcional em aparelhos.

## 4. Implantação do painel Universal Build

O workflow `.github/workflows/deploy-pages.yml` publica **somente `dashboard/`** quando há push relevante em `main` ou `workflow_dispatch`. Antes de anunciar nova opção do painel, verificar:
1. PR aceita e código na branch usada pelo deploy.
2. GitHub Pages configurado para **GitHub Actions**.
3. Último run `Publicar Universal Build no GitHub Pages` bem-sucedido.
4. URL publicada responde por HTTPS, apresenta a interface nova e funciona no celular autenticado.

Documentação sem alteração em `dashboard/` **não dispara** automaticamente Pages; isso não é falha do manual.

## 5. Ameaças operacionais e regras

- PAT no `localStorage` é **risco assumido**; não compartilhar dispositivo, não colocar token em frontend, URL, docs ou conversa.
- Nunca commitar JKS, password, Base64 de keystore ou `key.properties`.
- Branch principal e workflow `@main` são superfícies de risco: exigem revisão, CI e estratégia de reversão.
- Workflows release com secrets não devem compilar código de origem não confiável.
- Releases/AdMob demandam consentimento, Play Data Safety e revisão regulatória aplicável.
- É responsabilidade de quem publica manter backups da keystore e procedimentos de recuperação no Google Play App Signing.

Referência canônica: [guia existente de assinatura e Play Store](../ASSINATURA-E-PLAY-STORE.md).
