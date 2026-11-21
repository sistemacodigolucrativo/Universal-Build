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
