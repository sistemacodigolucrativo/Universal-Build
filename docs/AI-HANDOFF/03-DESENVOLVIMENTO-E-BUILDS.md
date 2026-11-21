# 03 — Fluxo de desenvolvimento, operação do console e builds

## 1. Pré-condições

- Repositório **Android compilável**, com acesso GitHub e `.github/workflows/universal-build.yml`.
- `dashboard/` estático publicado via GitHub Pages/Vercel **somente se o deploy foi confirmado**; endereços não comprovam funcionamento.
- PAT de privilégio mínimo do GitHub, acesso de leitura/escrita ao **repositório de destino**, execução de Actions e edição de workflows conforme necessário. **Não compartilhar PAT.**
- Em repositórios privados, verificar permissão de acesso ao template e aos reusable workflows do GitHub.
- Android Gradle/Flutter/React Native detectáveis por `scripts/detect.sh`; compatibilidade real deve ser comprovada por build, não apenas pelo reconhecimento do tipo.

## 2. Operar pelo celular

1. Abrir [console](https://sistemacodigolucrativo.github.io/Universal-Build/) **após confirmar deployment** e conectar GitHub com PAT. Por decisão atual, a sessão fica no `localStorage` até a próxima meia-noite do dispositivo.
2. Selecionar repositório Android. O filtro `dashboard/android-repos.js` procura evidência de `settings.gradle[.kts]`, `build.gradle[.kts]` de módulo e `src/main/AndroidManifest.xml`. Repositórios recém-criados/vazios ou só web **não aparecem**.
3. Caso necessário, clicar **Instalar/atualizar workflows**. **Atenção:** essa ação cria/atualiza commits na **branch padrão do aplicativo**, potencialmente sobrescrevendo o YAML anterior; revisar diferenças e obter autorização antes.
4. Selecionar build, `project_dir=.`, `android_module=app`, `android_flavor=auto`, Java 17 (valores adequados ao Kotlin Master atual).
5. Acionar build. O painel despacha `workflow_dispatch` para o projeto; o workflow chama o motor reutilizável do Universal Build.
6. Acompanhar Actions, consultar logs e baixar ZIP de **Artifacts**. Artefatos têm `retention-days: 14` no motor atual; não confundir ZIP de artifact com APK diretamente.
   - O card de progresso e os botões de download referem-se à **mesma execução selecionada**. Os cards antigos continuam no histórico, mas seus artefatos não são listados como downloads da compilação atual.
   - Enquanto o GitHub ainda não retornar a nova execução, não reutilizar downloads de builds anteriores. Se já houver execução em andamento, exibir suas etapas em vez de declarar que todas estão indisponíveis.
   - Para consultar artefatos históricos, abrir os logs no GitHub da execução correspondente.
7. Extrair o ZIP no Android, instalar **APK debug**, testar e documentar resultados. Build aprovado não prova exibição correta, sensores, navegação nem políticas da loja.

**Histórico AdMob:** a [PR 5](https://github.com/sistemacodigolucrativo/Universal-Build/pull/5) foi incorporada à `main` em 21/11/2026. O código atual do painel contém a seção AdMob. A publicação e os testes manuais devem ser verificados separadamente.

## 3. Valores de inputs do workflow

Arquivo instalável: `templates/android-build.yml`; execução: `.github/workflows/android-reusable.yml`.

| Input | Padrão | Interpretação |
|---|---|---|
| `build_target` | `apk` | `apk`, `aab-unsigned`, `both-unsigned`, `aab`, `both`, `release-apk` |
| `project_dir` | `.` | Subpasta do projeto (se não for ZIP) |
| `upload_zip_path` | vazio | Caminho `uploads/<nome>.zip` salvo no repo do app |
| `android_module` | `app` | Nome simples de módulo Gradle; sem caminho arbitrário |
| `android_flavor` | `auto` | `auto`, `dev`, `staging`, `prod` |
| `java_version` | `17` | JDK compatível com o projeto |
| `node_version` | `20` | Para React Native |
| `flutter_version` | vazio | Flutter stable, quando aplicável |

**Importante:** `aab` e `both` exigem secrets de assinatura para produzir release assinada; `aab-unsigned` e `both-unsigned` não devem receber assinatura nesta etapa. O script aborta se os quatro secrets faltarem em release assinada.

## 4. Caminho de execução

```text
dashboard/app.js (GitHub REST)
  -> .github/workflows/universal-build.yml no APP
    -> Universal-Build/.github/workflows/android-reusable.yml@main
      -> checkout do aplicativo
      -> scripts/extract_zip.py (se houver ZIP)
      -> scripts/detect.sh -> android | flutter | react-native
      -> scripts/build.sh (variants e assinatura se aplicável)
      -> upload-artifact (APK/AAB)
```

Dentro de `scripts/build.sh`, a seleção de flavor é **por diretório de variante**. Kotlin Master `auto` → APK `assembleDevDebug`, bundle `bundleProdRelease`. Se o projeto não possui flavors, usa `assembleDebug`/`bundleRelease`. O motor copia os binários para `$RUNNER_TEMP/ub-artifacts`, renomeia `debug.apk`, `unsigned.aab`, `release.aab`, `release.apk` e verifica assinatura e atributos de bundle quando aplicável.

O motor está referenciado como `@main` no workflow do app e faz checkout do Universal Build `ref: main` para os scripts. **Implicação:** alteração futura no motor pode modificar builds subsequentes; para release reprodutível recomenda-se avaliar pin por SHA de commit testado, preservando os gatilhos do app.

## 5. ZIP/importações

O painel limita a **15 MiB por ZIP**; o arquivo é salvo em `uploads/` no próprio GitHub. O extrator limita a **15.000 entradas**, **500 MiB descompactados** e rejeita caminhos inseguros e symlinks. A importação pode tornar conteúdo público se o repositório for público. Para projetos maiores, preferir Git; nunca importar `node_modules`, credenciais ou `build/`.

## 6. Gates de desenvolvimento

No **Universal Build**: `bash -n`, testes do detector e flavors, testes Node do filtro, ZIP e check YAML conforme `.github/workflows/ci.yml`. Smoke nativo real tem workflow separado.

No **Kotlin Master**: `python3 -m unittest discover -s tests -p 'test_*.py' -v`, `./gradlew validateAppConfig`, `./gradlew ktlintCheck detekt`, `./gradlew :app:assembleDevDebug :app:bundleProdRelease :feature:home:testDebugUnitTest :app:lintDevDebug`, e instrumentação/compilação de testes conforme `.github/workflows/ci.yml`. Alterações em módulos adicionais exigem testes correspondentes.

## 7. Problemas recorrentes

| Sintoma | Verificação prioritária |
|---|---|
| Repositório não aparece no console | Conteúdo Android em sua branch padrão, estrutura Gradle e manifesto, permissões PAT, filtro de árvore truncada |
| Workflow indisponível | Caminho `.github/workflows/universal-build.yml`, presença na branch padrão, Actions habilitadas e permissões |
| APK não gerado | Tarefa/flavor e pasta de output corretos; examinar primeiro erro do Gradle |
| AAB unsigned falha | Projeto assina inadvertidamente `prodRelease`; remover signing da variante unsigned |
| AAB assinado falha | Quatro secrets, keystore, alias, variáveis exportadas, `jarsigner`, API destino e `versionCode` |
| Frontend desatualizado | Comparar `main/dashboard`, workflow `deploy-pages.yml`, último deploy e cache do navegador |
| Mudança em outra branch não aparece no painel | O painel/Pages normalmente serve `main` — PR ainda não mesclada não é produção |

**Nunca apresentar a última execução ou um artefato anterior como evidência do HEAD atual.** Vincule o SHA da execução a seus resultados.
