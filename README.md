# Universal Build 🚀

**Infraestrutura universal para compilar aplicativos Android via GitHub Actions e controlar builds pelo navegador do celular.**

Projetos Android Gradle (Java, Kotlin e Jetpack Compose), Flutter e React Native — desde que possuam código-fonte Android válido — podem gerar:

| Modo | Saída | Uso |
|---|---|---|
| `apk` | APK debug | Testar diretamente no Android |
| `aab` | AAB release assinado | Publicar na Google Play |
| `both` | APK debug + AAB release | Testar e publicar |
| `aab-unsigned` | AAB sem assinatura | Assinar após o build |\n| `both-unsigned` | APK debug + AAB sem assinatura | Testar e assinar depois |\n| `release-apk` | APK release assinado | Distribuição fora da Play Store |

> **Google Play:** apps novos exigem AAB (não APK). Em novembro/2026, apps novos/atualizados para celulares devem direcionar a API 36+ (com exceções para outras plataformas). O Universal Build verifica assinatura, target SDK e versionCode no AAB gerado. Um build bem-sucedido não significa aprovação automática na loja.

## Primeiros passos

1. Em um repositório Android com código-fonte válido, instalar [o workflow de integração](templates/android-build.yml) no caminho `.github/workflows/universal-build.yml`.
2. Selecionar **Actions → Universal Build - Compilar Android → Run workflow** no repositório do aplicativo.
3. Escolher `apk`, `aab`, `both` ou `release-apk`.
4. Baixar os resultados em **Artifacts** na página da execução.
5. Para a release, preparar a chave de assinatura e os secrets conforme [Assinatura e Play Store](docs/ASSINATURA-E-PLAY-STORE.md).

## Painel Web no GitHub Pages

Endereço previsto após o deploy: https://sistemacodigolucrativo.github.io/Universal-Build/

O arquivo `.github/workflows/deploy-pages.yml` publica o diretório `dashboard/` automaticamente quando alterações chegam à `main`. O repositório deve ter **Settings → Pages → Source: GitHub Actions** habilitado uma vez. O endereço só deve ser considerado ativo depois da execução bem-sucedida de `Publicar Universal Build no GitHub Pages`.

[Mapeamento funcional do painel](docs/MAPEAMENTO-FUNCIONAL.md).

## Configurações AdMob por aplicativo

O console possui uma seção **Configurações · Monetização AdMob** para salvar, no repositório Android selecionado, os IDs do aplicativo e das unidades de anúncios, formatos habilitados, limites de frequência e modos `off` (padrão), `test` e `live`. Os dados ficam em `config/universal-build-admob.json`, versionados via GitHub; o salvamento exige confirmação do usuário.

**Atenção:** esta primeira etapa é a interface de configuração, não uma integração automática ao APK. É necessário implementar a leitura do arquivo e o SDK/consentimento no Kotlin Master e em cada app derivado. Alterações de App ID exigem nova compilação. Veja [Configurações AdMob](docs/ADMOB-CONFIGURACAO.md).

## Assinatura DEPOIS da compilação

- `aab-unsigned`: gera AAB sem assinatura, apropriado para uma etapa posterior de assinatura.
- `both-unsigned`: gera APK de teste + AAB sem assinatura.
- `aab` e `both`: opções legadas para assinar durante o build, com os secrets de assinatura já configurados.
- Para assinar depois: selecionar o artefato unsigned, clicar em **Assinar este AAB** no painel, configurar os secrets no repositório do aplicativo e iniciar o workflow de assinatura independente. O `.aab` resultante, após a assinatura, é o que pode ser enviado ao Google Play Console.

**AAB sem assinatura não pode ser enviado à Play Store.** A assinatura pós-build do APK release ainda não faz parte do processo independente; `release-apk` utiliza assinatura configurada no próprio Gradle.

## Painel web estático

O código da interface está em [dashboard/](dashboard/). Pode ser implantado na Vercel usando **Root Directory: dashboard**, sem backend e sem banco de dados. O login utiliza usuário GitHub e um token pessoal guardado neste navegador até a próxima meia-noite. Consulte [Instalação do painel](dashboard/README.md) e [Arquitetura](docs/ARQUITETURA.md).

## Componentes

- [Motor universal reutilizável](.github/workflows/android-reusable.yml)
- [Workflow que o painel instala em cada aplicativo](templates/android-build.yml)
- [Verificação automatizada](.github/workflows/ci.yml)
- [Compilação real de teste](.github/workflows/smoke-android.yml)
- [Exemplo Android nativo](samples/android-native/)
- [Regras de assinatura / publicação](docs/ASSINATURA-E-PLAY-STORE.md)

## Segurança e limitações

Nunca inclua tokens, senhas, keystores ou chaves de assinatura no repositório público. Guarde os segredos de assinatura no repositório do aplicativo, preferencialmente privado. O Universal Build compila **projetos Android válidos**; não transforma automaticamente qualquer site ou código genérico em aplicativo instalável e não garante aprovação pela Google Play.

**Estado do projeto:** integração Android Gradle e assinatura independente testadas em build real. Flutter e React Native exigem validação adicional; acesso ao GitHub Pages depende do deploy.
