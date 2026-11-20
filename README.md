# Universal Build 🚀

**Infraestrutura universal para compilar aplicativos Android via GitHub Actions e controlar builds pelo navegador do celular.**

Projetos Android Gradle (Java, Kotlin e Jetpack Compose), Flutter e React Native — desde que possuam código-fonte Android válido — podem gerar:

| Modo | Saída | Uso |
|---|---|---|
| `apk` | APK debug | Testar diretamente no Android |
| `aab` | AAB release assinado | Publicar na Google Play |
| `both` | APK debug + AAB release | Testar e publicar |
| `release-apk` | APK release assinado | Distribuição fora da Play Store |

> **Google Play:** apps novos exigem AAB (não APK). Em novembro/2026, apps novos/atualizados para celulares devem direcionar a API 36+ (com exceções para outras plataformas). O Universal Build verifica assinatura, target SDK e versionCode no AAB gerado. Um build bem-sucedido não significa aprovação automática na loja.

## Primeiros passos

1. Em um repositório Android com código-fonte válido, instalar [o workflow de integração](templates/android-build.yml) no caminho `.github/workflows/universal-build.yml`.
2. Selecionar **Actions → Universal Build - Compilar Android → Run workflow** no repositório do aplicativo.
3. Escolher `apk`, `aab`, `both` ou `release-apk`.
4. Baixar os resultados em **Artifacts** na página da execução.
5. Para a release, preparar a chave de assinatura e os secrets conforme [Assinatura e Play Store](docs/ASSINATURA-E-PLAY-STORE.md).

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

**Estado do projeto:** infraestrutura e interface iniciais implementadas em branch de desenvolvimento; validação de compilação e integração a confirmar antes de produção.
