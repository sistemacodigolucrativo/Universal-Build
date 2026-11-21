# 07 — Runbook, checklists de qualidade e recuperação

## Checklist A — Ao receber uma solicitação

- [ ] Definir se envolve **Universal Build (orquestração)**, **Kotlin Master (módulo comum)** ou **app derivado (produto)**.
- [ ] Confirmar owner, repo, branch/HEAD, PRs, permissões e repositório privado.
- [ ] Ler código de entrada, testes, documentação e workflows relacionados; **não responder só com uma suposição ou memória de chat**.
- [ ] Converter a demanda em requisitos verificáveis e registrar limites.
- [ ] Checar compatibilidade Android, permissões, privacidade, SDKs, política Play e riscos.
- [ ] Se houver código, trabalhar em branch isolada, criar PR e preservar `main` até autorização.

## Checklist B — Novo app Kotlin

- [ ] Repositório novo via **Use this template** do Kotlin Master, não via projeto vazio/WebView.
- [ ] Identidade `app-config.properties` validada (`applicationId`, `versionCode`, `versionName`, ícones).
- [ ] Arquitetura `app`/`core`/`feature` preservada; Koin e navegação integrados.
- [ ] Remover demonstrações obsoletas; testes úteis no lugar.
- [ ] Flavors `dev`, `staging`, `prod`; CI para código revisado.
- [ ] APK instalado no Android e teste manual; sem alegar compatibilidade universal.
- [ ] Documentação do app derivado, roadmap e evidências.

## Checklist C — Pré-build e CI

- [ ] Módulo `app`, diretório `.`, Java/SDK compatíveis, Gradle Wrapper íntegro.
- [ ] Projeto aparece no filtro Android do console; caso não, conferir manifesto e tree Git.
- [ ] Workflow `universal-build.yml` disponível na branch padrão do app.
- [ ] `validateAppConfig` e testes do código/modificação novos passam.
- [ ] `ktlintCheck`, `detekt`, lint e build correto passam (quando aplicáveis).
- [ ] `workflow_dispatch` e artefato associados ao SHA certo.
- [ ] Sem segredos em código, configs, logs ou artifacts.

## Checklist D — Produção

- [ ] Confirmação explícita para ativar produção/merge.
- [ ] `versionCode` crescente, `applicationId` estável, permissões revisadas.
- [ ] Teste real em dispositivo, Play Console e acessibilidade conforme risco.
- [ ] AAB **assinado** com certificado de upload esperado; não confundir com `unsigned.aab`.
- [ ] Secrets corretos no **repositório/app ou Environment** compatível com o workflow.
- [ ] Google Play policies, formulários, Ads, privacidade, assinatura e target SDK atuais.
- [ ] Evidências de upload/rollout/versão no console e plano de reversão.

## Checklist E — AdMob

- [ ] UI no Universal Build **implantada** (não apenas PR).
- [ ] Aplicativo derivado contém `:core:ads` e lê o contrato JSON.
- [ ] `mode=off` como configuração segura inicial.
- [ ] IDs de teste usados em `dev/staging`; nenhuma impressão com IDs reais em depuração.
- [ ] Banner sem sobreposição, privacidade/UMP revisadas.
- [ ] Intersticial em transição natural com cooldown; recompensado com opt-in e benefício transparente.
- [ ] Sem crédito de moedas sem verificação server-side/idempotência.
- [ ] Nova compilação após configurar IDs; teste no Android com APK/SHA correspondente.
- [ ] Publicação de produção com revisão de requisitos AdMob/Play e aprovação.

## Troubleshooting — decisões baseadas em evidência

| Problema | Onde olhar antes de agir |
|---|---|
| "Meu repositório não aparece" | `dashboard/android-repos.js`; árvore Git na **branch padrão** e permissão do token |
| "Botão iniciar build indisponível" | seleção de repo, login PAT, validade até meia-noite |
| "Workflow não encontrado" | `.github/workflows/universal-build.yml` no app, YAML, registro de Actions e permissões |
| "É um projeto web" | Universal Build não cria Android nativo de site; projeto Android/WebView precisa ser projetado separadamente |
| "Gradle falhou" | primeiro erro do run, dependências, variante, JDK, SDK, flavors; não reexecutar às cegas |
| "AAB unsigned não assina" | artifact correto, Run ID e nome, secrets, `sign-reusable.yml`, `sign-aab.sh` |
| "AAB rejeitado pela Play" | assinatura/certificado, package, `versionCode`, targetSdk, política, formulário, bundle |
| "APK instalou mas recurso falha" | dispositivo/Android, permissões, logs, rede, UI, classe/feature e SHA gerado |
| "AdMob não aparece" | `mode`, flags, IDs de teste, consentimento UMP, build instalado, conexão, restrições da conta |
| "UI nova do Universal Build não aparece" | PR não mesclada, Pages publica `main/dashboard`, run `deploy-pages`, cache |
| "Alterei Kotlin Master mas app antigo não mudou" | derivação via template não é sincronização; incorporar patches no repo do app |
| "Documentação diz X, código diz Y" | prevalece código + CI; abrir issue/PR para atualizar a documentação |

## Estratégia de rollback

- **Dashboard:** reverter commit de `dashboard/` em PR e reimplantar Pages; não restaurar token algum.
- **Motor de build:** reverter o commit na branch apropriada ou temporariamente fixar SHA anterior testado no workflow do aplicativo (exige revisão), então executar smoke.
- **Aplicativo Android:** não regravar `main` à força; preferir `git revert` do commit ou PR de correção, incrementar `versionCode` para nova release.
- **AdMob:** na próxima compilação configurar `mode=off`; isso **não** desativa anúncios em APK já instalado sem mecanismo remoto.
- **Chave de upload:** recuperar do backup seguro/procedimento Google Play App Signing, nunca recriar silenciosamente outra identidade de assinatura.

## Modelo de entrega ao usuário

Informe em linguagem direta: o que foi executado, arquivos/branches/PRs, CI (com run), como reproduzir, o que **não** foi feito, risco/limitação e próxima ação. Não usar "concluído" para tarefas cujo gate final ainda está rodando. Se usuário pedir apenas documentação/análise, não alterar código do app ou publicar.

## Atualização contínua

Documentação evolui **junto com a PR**. Para cada funcionalidade:
1. Atualizar a fonte de código e os testes.
2. Atualizar a seção correspondente neste manual.
3. Inserir status e evidência em `06-ESTADO-E-RASTREABILIDADE.md` (ou linkar arquivo de etapa).
4. Anotar decisões reversíveis, riscos, próximos passos e rollback.
5. Validar links relativos, comandos e correspondência com a branch real.

**Responsabilidade compartilhada:** este manual é a memória versionada de como trabalhar; o histórico completo de cada app vive prioritariamente no repositório próprio desse aplicativo.

## Gate adicional — console 2.0

- [ ] Branch escolhida no console equivale à branch onde `config/universal-build-admob.json` foi salva e ao `ref` enviado ao workflow de build.
- [ ] Verificar que o workflow de dispatch existe na branch padrão do aplicativo antes de solicitar execução em branch de feature.
- [ ] Confirmar toasts de erro/sucesso, foco do botão de fechar, contraste e responsividade no Android.
- [ ] Validar que a barra mostra **etapas do Actions**, sem prometer percentual exato ou duração do Gradle.
- [ ] Verificar artifact único APK/AAB, artifact múltiplo ZIP, expirado e cenário de bloqueio CORS — oferecer link de fallback para o run.
- [ ] Conferir que o card de assinatura está após downloads e só aceita AAB unsigned selecionado, com secrets isolados.

Veja [guia detalhado de execução](../CONSOLE-UX-ADMOB-PROGRESSO.md).
