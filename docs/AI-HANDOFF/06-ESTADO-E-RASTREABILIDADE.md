# 06 — Estado rastreável, decisões, pendências e último handoff

**Snapshot inicial:** 21/11/2026, baseado no GitHub, em `main` e nos metadados das PRs acessíveis nessa data. **Atenção:** esta página não consulta automaticamente o GitHub nem indica que um trabalho foi mesclado depois da data. Abra os links para verificar o estado atual.

## Inventário de frentes

| ID | Frente | Situação observada em 21/11/2026 | Referência / próximo gate |
|---|---|---|---|
| UB-001 | Orquestrador e scripts Universal Build | Código em `main`, testes/CI e smoke próprios disponíveis | `scripts/build.sh`, `scripts/detect.sh`, `.github/workflows/android-reusable.yml` |
| UB-002 | Painel de seleção, builds, assinatura | Código em `main`; uso autenticado no Android requer validação independente | `dashboard/app.js`, `dashboard/README.md` |
| UB-003 | Pages | Workflow em `main`; deploy/URL só podem ser considerados confirmados por run e navegação | `.github/workflows/deploy-pages.yml` |
| KT-001 | Template Kotlin Mestre | `is_template=true`, `main` com Compose/MVVM/Koin/Room e arquivos de configuração | [Repo Kotlin Master](https://github.com/sistemacodigolucrativo/Kotlin-Master-Boilerplate) (privado) |
| QR-001 | QR Studio MVP | **PR aberta** sobre `main`; não atribuir QR funcional à `main` | [QR PR 6](https://github.com/sistemacodigolucrativo/QR-Studio/pull/6) |
| ADS-001 | Painel AdMob por app | **PR aberta em rascunho**; não implantado em `main` | [Universal Build PR 5](https://github.com/sistemacodigolucrativo/Universal-Build/pull/5) |
| ADS-002 | AdMob nativo reutilizável | **PR aberta em rascunho**; não incorporado na `main` mestre | [Kotlin Master PR 12](https://github.com/sistemacodigolucrativo/Kotlin-Master-Boilerplate/pull/12) |
| ADS-003 | AdMob no QR Studio | **PR aberta em rascunho**, base = branch do QR MVP | [QR PR 7](https://github.com/sistemacodigolucrativo/QR-Studio/pull/7) |
| ADS-004 | Experimento de banner QR Studio | **PR aberta em rascunho**, base = branch AdMob; `mode=test` | [QR PR 8](https://github.com/sistemacodigolucrativo/QR-Studio/pull/8) |
| DOC-001 | Este handoff e protocolo `AGENTS.md` | Preparado em `docs/ai-handoff-operational-manual` para revisão | Conferir CI, PR e eventual merge |

**Não inferir:** aprovação Google Play, implantação real da PR 5 no Pages, ativação de anúncios reais, sincronização entre branches, acesso de outra IA a repo privado ou sucesso em todas as ROMs. Esses marcos carecem de evidências específicas no retrato acima.

## Decisões técnicas já expressas no código

| Decisão | Evidência | Implicação |
|---|---|---|
| Universal Build é código independente, sem backend próprio | `docs/ARQUITETURA.md`, `dashboard/app.js` | Não inventar APIs persistentes/banco no console |
| Kotlin Master é **template de código nativo** | README Kotlin, `is_template=true` | Derivar via GitHub Template, não recriar base nem confundir com WebView |
| Template com flavors `dev/staging/prod` | `app/build.gradle.kts` | APK `devDebug`, AAB `prodRelease` no fluxo automático |
| Builds executam no GitHub Actions | `templates/android-build.yml`, `android-reusable.yml` | Sem Android Studio local |
| Chave de upload não pertence ao repositório público | `docs/ASSINATURA-E-PLAY-STORE.md`, `sign-reusable.yml` | Usar GitHub Secrets no app |
| AdMob desativado por padrão | Branches de Ads, contrato JSON v1 | Testes com IDs demonstrativos; produção exige autorização e configuração |
| Console/engine referenciam Universal Build `@main` | `templates/*.yml`, workflows | Política de versionamento/pinning a avaliar |

## Backlog de auditoria e continuidade

| Prioridade | Pendência | Critério de aceite |
|---|---|---|
| P0 | Conferir status atual das PRs 5/12/6/7/8 antes de merge | Branch/commit/run atualizado, conflitos resolvidos, autorização explícita |
| P0 | Revisar política de segredos e fluxo release nos projetos derivados | Nenhuma credencial em código/log, chave de upload correta, AAB assinado |
| P0 | Não confundir `main` com branch do produto QR e de AdMob | Evidência de qual branch gerou o APK testado |
| P1 | Validação autenticada do novo painel AdMob pós-deploy | URL Pages efetiva, login/persistência e comportamento confirmado no Android |
| P1 | Teste real do banner com configuração e APK correspondentes | Artifact SHA, consentimento, exibição de teste e logs sem erros |
| P1 | AdMob por formato: pontos de exibição e recompensas | UX não intrusiva, cooldown, opt-in, SSV para moedas |
| P1 | Versões e compatibilidade do motor `@main` | Decisão de pin por SHA, política de rollback e teste cross-repo |
| P2 | Prova real de Flutter e React Native | Runs completos de cada adaptador e testes no aparelho |
| P2 | Teste manual One UI/HyperOS/tablets e acessibilidade | Matriz de dispositivos e relatório verificável |
| P2 | Sincronização de requisitos entre repos e agentes | Registros de etapa/ADR mantidos por PR |
| P3 | Painel remoto de controle de anúncios já instalados | Projeto próprio, backend seguro, política de atualizações — não implementado |

## Como registrar cada nova etapa

Uma IA só deve registrar `CONCLUÍDO` quando houver **artefato + critérios de aceite + evidência**. Use o modelo abaixo em um novo arquivo datado (ou na descrição da PR/issue com link neste índice):

```text
ID / projeto:
Objetivo e escopo:
Data e responsável:
Branch de origem:
Commit HEAD antes/depois:
Arquivos alterados:
Decisões / alternativas descartadas:
Testes realizados (comandos + resultados):
GitHub Actions (URL do run + SHA):
Testes manuais Android (dispositivo, versão, resultado):
Status: proposto | código em branch | CI validado | mesclado | implantado | testado em aparelho
Riscos e pendências:
Próxima ação:
Rollback:
```

### Checklist de retomada da IA

1. Ler `AGENTS.md` e toda a documentação indexada.
2. Abrir **HEAD e PRs** dos 3 repositórios; conferir se o template privado está acessível.
3. Identificar última entrega cronológica **por commit e run**, não pela ordem de mensagens do chat.
4. Atualizar a tabela deste arquivo em PR se houver mudança constatada.
5. Solicitar autorização para merges, releases, deploy ou produção quando essas ações não foram explicitamente solicitadas.

## Atualização posterior — 21/11/2026

- **UB-ADS painel:** [PR #5](https://github.com/sistemacodigolucrativo/Universal-Build/pull/5) mesclada em `main`, commit `07e1d8dd224e8d3b7d98b9a47edda3da0d31fabc`.
- **UB-UX console:** [PR #7](https://github.com/sistemacodigolucrativo/Universal-Build/pull/7) mesclada em `main`, commit `167d70f0068e3f767322b60b548f4b5ce77a3978`. Inclui AdMob por branch, toasts, progresso real de **etapas** e downloads com fallback ZIP/Actions.
- **Documentação funcional:** [docs/CONSOLE-UX-ADMOB-PROGRESSO.md](../CONSOLE-UX-ADMOB-PROGRESSO.md).
- **Kotlin Master / QR Studio:** contrato JSON padrão `off`, teste Python de schema/integração Gradle e README atualizado nas branches `feature/universal-admob-native` desses repositórios. **Não declarar `main` nativa atualizada antes de confirmar os merges e CI finais**.
- **Deploy Pages:** verificar run posterior ao commit da PR #7; merge não comprova automaticamente renderização no celular. Interface autenticada, download via redirecionamento/CORS e anúncio real exigem testes manuais.

Os registros anteriores neste arquivo são **snapshot histórico** anterior a esses merges, não o estado mais atual.

## Atualização de promoção QR Studio — 21/11/2026

- `QR-001`: [PR 6](https://github.com/sistemacodigolucrativo/QR-Studio/pull/6) mesclada em `main`; SHA de merge `3af1ba89c49e7a3802a0f04ee0aea5fb42f9a829`.
- `ADS-003`: [PR 7](https://github.com/sistemacodigolucrativo/QR-Studio/pull/7) mesclada em `main`; SHA `de30ad8f760e83aa2e393e6a75c33a70c9402859`. Gate da branch com [teste completo](https://github.com/sistemacodigolucrativo/QR-Studio/actions/runs/44926648632) e [integração Universal Build](https://github.com/sistemacodigolucrativo/QR-Studio/actions/runs/44926649077) aprovados.
- `ADS-004`: [PR 8](https://github.com/sistemacodigolucrativo/QR-Studio/pull/8) de banner de teste **continua separada**, com IDs de conta próprios registrados em branch experimental; **não publicar esta configuração como monetização em produção**.
- `ADS-002`: Kotlin Master [PR 12](https://github.com/sistemacodigolucrativo/Kotlin-Master-Boilerplate/pull/12) **mesclada à `main`**, commit `c0a364eb3653ae89207cbb97d5c26bbae80f5613`, após [integração Universal Build](https://github.com/sistemacodigolucrativo/Kotlin-Master-Boilerplate/actions/runs/44926643940) e [gate Android completo](https://github.com/sistemacodigolucrativo/Kotlin-Master-Boilerplate/actions/runs/44926643754) aprovados.
- `DOC-001`: [PR 6](https://github.com/sistemacodigolucrativo/Universal-Build/pull/6) do handoff mesclada na `main` (SHA `157bbabe692378133b4972bca40afaa5a44226cf`). UI no Pages [deploy aprovado](https://github.com/sistemacodigolucrativo/Universal-Build/actions/runs/44926916377).

**Nota final:** os três repositórios Universal Build, Kotlin Master e QR Studio contêm a integração pertinente na branch principal, mas **a configuração AdMob de apps já instalados não muda sem novo APK/AAB**. Produção e downloads diretos ainda precisam de testes com navegador/dispositivo/conta reais.

## Correção da seleção de execuções e downloads — 21/11/2026

- **ID:** UB-UX-002.
- **Origem:** divergência reportada no console ao acompanhar o build #39 (`main`) com gate `ktlint e detekt` (6/10 etapas) enquanto a faixa superior indicava "GitHub ainda não disponibilizou as etapas"; downloads do build #38 permaneciam visíveis.
- **Repositório / branch:** `sistemacodigolucrativo/Universal-Build`, `fix/workflow-progress-current-downloads-20261121`; branch de origem `main` no SHA `cf786f60ebe38c2d01e31827aa9cbe1990977fe6`.
- **Alterações:** `dashboard/build-progress.js` centraliza a escolha da execução atual e considera IDs conhecidos no despacho, tolerância de horário e fallback para execução ativa; `dashboard/app.js` usa a mesma referência nos cards e só mostra artefatos de `selection.current`, preservando o histórico sem downloads antigos; `tests/console-live.test.cjs` inclui regressões; `docs/AI-HANDOFF/03-DESENVOLVIMENTO-E-BUILDS.md` documenta comportamento.
- **PR:** [#9 — sincronizar progresso e downloads da execução atual](https://github.com/sistemacodigolucrativo/Universal-Build/pull/9).
- **Evidência automatizada inicial:** [GitHub Actions run 44929158298](https://github.com/sistemacodigolucrativo/Universal-Build/actions/runs/44929158298), `check` concluído com sucesso (sintaxe Node, testes do console, testes shell/Python e validações YAML). **CI da última alteração documental pode requerer nova execução.**
- **Estado:** código em branch + CI da implementação validado. **Não mesclado nem implantado**, sem teste manual autenticado no Android.
- **Critérios de aceite manuais:** execução ativa não pode coexistir com texto de ausência de etapas; somente run atual pode disponibilizar APK/AAB; build anterior permanece consultável por logs, não por download no card; testes com estado em fila, em andamento e concluído.
- **Limitações:** o bloqueio de download direto por redirecionamento/CORS do GitHub é uma questão independente; esta correção não altera o transporte dos arquivos.
- **Rollback:** reverter commits desta PR (se incorporada); não alterar workflows nem credenciais para desfazer a correção.

## Revisão do fluxo, downloads e gerador de chaves — 23/11/2026

- **IDs:** UB-UX-001 (build atual e histórico), UB-UX-002 (download GitHub sem fetch), UB-KEY-001 (primeiro gerador de chave), UB-UX-003 (campos avançados).
- **Base:** `main` inicial `cf786f60ebe38c2d01e31827aa9cbe1990977fe6`, incorporando mudanças propostas na [PR #9](https://github.com/sistemacodigolucrativo/Universal-Build/pull/9).
- **Implementação:** `feat/current-build-downloads-keygen-ux-20261123` em [PR #10](https://github.com/sistemacodigolucrativo/Universal-Build/pull/10), que agrega a PR anterior. Evitar merge duplicado.
- **Código:** `dashboard/app.js`, `dashboard/index.html`, `dashboard/style.css`, `dashboard/keygen-client.js`, `dashboard/build-progress.js`, `scripts/keygen-encrypt.cjs`, `templates/android-keygen.yml`, `.github/workflows/keygen-reusable.yml`; testes Node/Shell, CI e docs.
- **Segurança:** só backup cifrado (.ubenc) da chave é disponibilizado como Artifact; certificado público PEM. Secrets privados no repositório do app e recuperação WebCrypto local. Não gerar nova chave para um app já publicado.
- **Evidências CI:** [run 45189605419](https://github.com/sistemacodigolucrativo/Universal-Build/actions/runs/45189605419) e [run 45190469876](https://github.com/sistemacodigolucrativo/Universal-Build/actions/runs/45190469876), ambos com job check aprovado; revalidar o HEAD da PR após alterações adicionais.
- **Análise técnica:** [AUDITORIA-FLUXO-2026-11-23.md](../AUDITORIA-FLUXO-2026-11-23.md) lista arquitetura, 11 pontos de atenção priorizados, operação simplificada e critérios de aceite.
- **Status:** código em branch, CI aprovado nos commits de implementação testados; **não mesclado, não implantado no Pages e não validado no telefone**.
- **Próximos gates:** verificar CI do HEAD final; revisão de segurança e merge autorizado; conferir deploy Pages; testar Android Chrome login/download ZIP, geração Keytool real com secret da conta, recuperação local JKS/Base64 e assinatura AAB no projeto; depois verificar Play Console.
- **Rollback:** reverter os commits da PR; preservar qualquer JKS de upload já gerado e suas senhas de backup.

