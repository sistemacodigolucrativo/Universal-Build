# 01 — Ecossistema, arquitetura e responsabilidades

## Repositórios e fronteiras

| Projeto | Repositório | Responsabilidade | Condição observada em 21/11/2026 |
|---|---|---|---|
| **Universal Build** | [sistemacodigolucrativo/Universal-Build](https://github.com/sistemacodigolucrativo/Universal-Build) | Painel de operação no celular, GitHub Actions reutilizável, scripts de detecção/compilação/assinatura e documentação | Público; branch padrão `main` |
| **Kotlin Master Boilerplate** | [sistemacodigolucrativo/Kotlin-Master-Boilerplate](https://github.com/sistemacodigolucrativo/Kotlin-Master-Boilerplate) | Template mestre de **código Android nativo** Kotlin/Jetpack Compose | Privado; GitHub `is_template=true`; `main` com estrutura-base |
| **QR Studio** | [sistemacodigolucrativo/QR-Studio](https://github.com/sistemacodigolucrativo/QR-Studio) | Aplicativo derivado para geração de QR; prova de uso do template | Público; MVP e AdMob em branches/PRs, não assumir que `main` os contém |

A expressão **boilerplate** não indica que devemos recriar a base para cada app. Use o recurso nativo `Use this template` do Kotlin Master e mantenha o mestre independente. Alterações posteriores no template **não sincronizam automaticamente** com repositórios derivados.

**Não confundir** o Kotlin Master nativo com o projeto distinto Android-Master-Boilerplate orientado a WebView. O Universal Build é o motor de **compilação**, não um gerador automático de código nativo nem uma ferramenta para publicar apps sozinha.

## Arquitetura do Universal Build

```text
Navegador Android (dashboard/ — GitHub Pages, frontend estático)
   |  HTTPS + GitHub REST API (PAT do próprio usuário)
   v
GitHub do repositório do APLICATIVO
   |  .github/workflows/universal-build.yml / universal-sign.yml
   v
Universal Build — reusable workflows (@main atualmente)
   |  checkout fonte do app + motor Universal-Build
   |  scripts/detect.sh -> scripts/build.sh -> artifacts
   |  assinatura posterior: scripts/sign-aab.sh
   v
GitHub Actions → Artifacts APK/AAB → download manual
   v
Testes no dispositivo / publicação manual via Play Console
```

**Fronteira de segurança:** o console é estático e usa o GitHub API; **não hospeda chaves de assinatura** e não é um servidor de monetização. O token do painel permanece no `localStorage` local até meia-noite do dispositivo e é enviado à API GitHub; o risco de XSS/uso em dispositivo compartilhado é conhecido. Os segredos de assinatura pertencem ao repositório do aplicativo e aos runners efêmeros.

## Arquivos do Universal Build

| Caminho | Responsabilidade real |
|---|---|
| `dashboard/index.html`, `app.js`, `style.css` | Interface, autenticação PAT, seleção, disparo de workflows, histórico |
| `dashboard/android-repos.js` | Filtra repositórios com evidência de projeto Android na árvore Git |
| `templates/android-build.yml`, `android-sign.yml` | Workflows **instaláveis** no app |
| `.github/workflows/android-reusable.yml` | Pipeline reutilizável de build Android, Flutter e React Native |
| `.github/workflows/sign-reusable.yml` | Assinatura posterior de AAB |
| `.github/workflows/deploy-pages.yml` | Deploy da pasta `dashboard/` por push em `main` ou dispatch |
| `.github/workflows/ci.yml`, `smoke-android.yml`, `integration-android.yml` | Verificações, smoke e integração do motor |
| `scripts/detect.sh` | Identifica `android`, `flutter` ou `react-native` |
| `scripts/build.sh` | Compila variantes, coleta APK/AAB, checa assinaturas e bundle |
| `scripts/sign-aab.sh` | Assina AAB unsigned sem reexecutar fonte do aplicativo |
| `scripts/extract_zip.py` | Extração ZIP limitada, com proteção de caminhos/links |
| `samples/android-native/`, `tests/` | Exemplo e testes automatizados |

## Arquivos do Kotlin Master

```text
app-config.properties           identidade, versões, API, SDKs e cor
gradle/libs.versions.toml       catálogo de dependências
app/                           Android Application, flavors, navegação, Koin
core/common                    estados/contratos básicos
core/designsystem              tokens, tema, tipografia, dimensões
core/ui                        componentes reutilizáveis
core/network                   Retrofit/OkHttp
core/database                  Room, schema, migrações
feature/home                   exemplo de UI/domain/data
tools/configure_app.py          edição validada do app-config.properties
.github/workflows/ci.yml       testes e builds do template
.github/workflows/release.yml  release assinada com environment release
.github/workflows/universal-*  ponte de integração com Universal Build
```

**Regra de módulos:** `:app` integra módulos `:feature:*` e `:core:*`; features dependem de core, **não de outras features**. Regras de negócio ficam em `domain/data`, não em Composables. O `namespace` Kotlin pode permanecer estável enquanto o `applicationId` do app derivado muda por configuração.

## Contrato de consistência entre repositórios

- Mudanças em `scripts/build.sh` ou YAML reutilizável exigem testes no Universal Build e smoke cross-repo no Kotlin Master.
- Mudanças no contrato `config/universal-build-admob.json` exigem revisão em **ambos**: console (validação e persistência) e módulo nativo/Gradle (leitura e política de variantes).
- Mudanças genéricas na base são propostas no Kotlin Master e incorporadas **explicitamente** aos apps já derivados, com testes de regressão próprios.
- O `main` do Universal Build referencia o motor por `@main`: mudanças no motor podem atingir builds futuros de outros repositórios. Propor fixação por SHA ao exigir reprodutibilidade/controle estrito.
