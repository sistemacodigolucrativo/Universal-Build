# 02 — Playbook: criar aplicativos nativos usando Kotlin-Master-Boilerplate

**Objetivo:** outra IA deve partir do template existente e implementar um **novo produto** sem alterar o projeto mestre involuntariamente.

## 1. Escolha correta de base

- Se a solicitação é um app Android **nativo**, use o [Kotlin-Master-Boilerplate](https://github.com/sistemacodigolucrativo/Kotlin-Master-Boilerplate), que já tem `is_template=true`. O acesso a esse repositório privado deve estar autorizado.
- Não crie uma nova arquitetura/boilerplate por aplicativo. Use **GitHub → Use this template → Create a new repository**, configure nome, owner e visibilidade conforme decisão do usuário.
- Se a solicitação é uma WebView/Capacitor, **não** substitua automaticamente o template Kotlin por outro projeto: é outra decisão de arquitetura, com justificativa e repositório distinto.
- Depois de derivar, mantenha o Kotlin Master intacto; todas as mudanças específicas (nome, QR, e-books, loja etc.) ficam no repositório do novo aplicativo.

## 2. Inspecione antes de editar

No repositório **derivado**, verifique `main`, arquivo `app-config.properties`, `settings.gradle.kts`, `app/build.gradle.kts`, `app/src/main/AndroidManifest.xml`, módulos `core/` e `feature/`, workflows e possíveis alterações prévias. Não suponha que mudanças futuras da base mestre tenham sido herdadas automaticamente.

Se o repo foi criado do template, ele contém um exemplo `feature/home` (contador), **não** a lógica do novo produto. Quando substituir o exemplo, remova usos e testes obsoletos e mantenha o contrato MVVM/Koin.

## 3. Identidade e configuração

Arquivo canônico: `app-config.properties` no app derivado. Chaves realmente aceitas pelo editor `tools/configure_app.py`:

| Campo | Regra operacional |
|---|---|
| `appName` | Nome exibido na UI |
| `applicationId` | Package do app na loja; **não trocar após publicar** sem avaliar impacto |
| `versionCode` | Número inteiro positivo, **crescente** a cada upload no Play Console |
| `versionName` | SemVer `X.Y.Z` no editor atual |
| `baseApiUrl` | HTTPS obrigatório no editor |
| `iconName` | Nome de recurso Android existente, não inventar |
| `brandColor` | `#RRGGBB` |
| `minSdk`, `targetSdk`, `compileSdk` | Inteiros validados com política atual do Android/Play |

Edite diretamente no GitHub ou execute o editor (se houver ambiente Python):

```bash
python3 tools/configure_app.py --appName "Nome do App" --applicationId "br.com.exemplo.meuapp" --versionCode 1 --versionName 0.1.0
./gradlew validateAppConfig
```

**Nota:** o editor registrado aceita argumentos nomeados convertidos com `key.replace("_","-")`, portanto use os nomes camelCase acima, não a convenção `--app-name`. Antes de automatizar, confirme `python3 tools/configure_app.py --help`.

Não renomeie os pacotes Kotlin simplesmente para alterar a identidade publicada: `applicationId` é independente do `namespace` do motor. Atualize ícones reais nas pastas `mipmap*`, cores e textos em `res/values` e `res/values-pt-rBR` antes de publicar.

## 4. Onde implementar funcionalidades

1. Identificar requisitos, telas, regras de negócio, estados, persistência, permissões e riscos; separar MVP de backlog.
2. Criar/editar `feature/<nome>/{ui,domain,data}` com ViewModel/`StateFlow` e componentes Compose. Não colocar lógica persistente/complexa em Composables.
3. Utilizar `core:database` (Room) com **migrações** quando alterar schema; não destruir dados silenciosamente. `core:network` para HTTP com HTTPS; avaliar privacidade/consentimento/permissões.
4. Adicionar `include(":feature:<nome>")` em `settings.gradle.kts`, dependência no `app/build.gradle.kts`, Koin em `MasterApplication.kt`, rotas em `MasterNavigation.kt`.
5. Atualizar recursos em PT-BR e inglês, acessibilidade (48dp, TalkBack, fontes grandes), layouts compactos, tablets e edge-to-edge.
6. Adicionar testes unitários e, quando aplicável, instrumentados; excluir classes/recursos de demonstração que não pertencem ao produto.
7. Verificar features nativas (câmera, armazenamento, notificações) e permissões do manifesto; não incluí-las desnecessariamente.
8. Atualizar `README.md`, `CHANGELOG.md`, decisões, limitações, evidências e checklist de teste.

## 5. Flavors e tarefas reais do Kotlin Master

| Ambiente | `applicationId` | Build de referência | Uso |
|---|---|---|---|
| `dev` | `applicationId + ".dev"` | `:app:assembleDevDebug` | APK de testes |
| `staging` | `applicationId + ".staging"` | `:app:assembleStagingDebug` | Homologação |
| `prod` | `applicationId` | `:app:bundleProdRelease` | AAB de release |

Com `android_flavor=auto`, o motor Universal Build reconhece `app-config.properties` + `create("dev")` e `create("prod")` no Gradle: escolhe `devDebug` para APK e `prodRelease` para bundle. Essa seleção é **heurística do script**, não um contrato universal de todo projeto Android.

## 6. Branching e promoção

Crie branch `feat/<recurso>` ou `implementation/<fase>` a partir da fonte correta; commite mudanças pequenas; abra PR para revisão e CI. Não trate o template ou a branch inicial do app como release pronta. Só proponha merge quando CI passar, evidências estiverem vinculadas e o usuário autorizar. O app derivado não recebe automaticamente commits posteriores do Kotlin Master: compare versões e integre conscientemente.

## 7. Exemplo real e alerta

O [QR-Studio](https://github.com/sistemacodigolucrativo/QR-Studio) deriva desse template. Em 21/11/2026, seu produto funcional estava na [PR 6](https://github.com/sistemacodigolucrativo/QR-Studio/pull/6), a infraestrutura AdMob na [PR 7](https://github.com/sistemacodigolucrativo/QR-Studio/pull/7), e um experimento de banner na [PR 8](https://github.com/sistemacodigolucrativo/QR-Studio/pull/8). **A `main` ainda continha o template**, não a versão de QR com as alterações. A próxima IA deve verificar o estado atualizado, nunca presumir que a instalação no celular corresponde à `main`.

Referência de estrutura: [README Kotlin Master](https://github.com/sistemacodigolucrativo/Kotlin-Master-Boilerplate/blob/main/README.md).
