# Universal Build 🚀

> **Para agentes de IA e novos mantenedores:** antes de qualquer implementação, leia [AGENTS.md](AGENTS.md) e o [Manual de Continuidade Universal Build + Kotlin Master](docs/AI-HANDOFF/README.md). O manual descreve arquitetura, uso do template Kotlin, desenvolvimento, builds, assinatura, produção, AdMob, status das PRs e procedimentos de retomada. Seu estado é um retrato datado; verifique GitHub/CI atualizados antes de agir.


**Infraestrutura universal para compilar aplicativos Android via GitHub Actions e controlar builds pelo navegador do celular.**

Projetos Android Gradle (Java, Kotlin e Jetpack Compose), Flutter e React Native — desde que possuam código-fonte Android válido — podem gerar:

| Modo | Saída | Uso |
|---|---|---|
| `apk` | APK debug | Testar diretamente no Android |
| `aab` | AAB release assinado | Publicar na Google Play |
| `both` | APK debug + AAB release | Testar e publicar |
| `aab-unsigned` | AAB sem assinatura | Assinar após o build |
| `both-unsigned` | APK debug + AAB sem assinatura | Testar e assinar depois |
| `release-apk` | APK release assinado | Distribuição fora da Play Store |

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

## Console 2.0 — AdMob, toasts, progresso e downloads

A nova interface ordena as etapas como **Repositório/branch → Configuração AdMob → Compilação → Progresso e downloads → Assinatura**.

- Configurações AdMob são persistidas por **aplicativo e branch** em `config/universal-build-admob.json`, com modos `off/test/live` e formatos individuais.
- Avisos e erros temporários aparecem como toasts flutuantes.
- Progresso é atualizado pela API do **GitHub Actions**; representa etapas reportadas, **não** um percentual interno do Gradle.
- Na PR #10, o build atual aparece em destaque, o histórico é recolhido e o download abre o ZIP autenticado do GitHub, evitando CORS. Extraia o ZIP no Android.
- O console só fornece configurações: AdMob nativo requer módulo Android no app e nova compilação. O Kotlin Master e o QR Studio receberam o módulo em `main` em 21/11/2026; outros apps derivados **não recebem automaticamente** essa mudança.

[Manual completo da nova interface](docs/CONSOLE-UX-ADMOB-PROGRESSO.md).

## Configuração automática de assinatura (23/11/2026)
O painel da etapa 5 permite gerar uma senha forte no próprio navegador, cadastrar **automaticamente** o primeiro Secret de proteção no GitHub, disparar a geração do JKS e, depois de baixar o backup `.ubenc` e recuperar a chave localmente, cadastrar os quatro Secrets **criptografados no navegador**, usando a chave pública oficial do repositório e a API GitHub. Não há transferência de chave ou senha em texto claro na API. O processo exige o token do usuário com permissão de **Actions Secrets: leitura e escrita**, e confirmação de backup da senha e do JKS. O GitHub não revela valores de Secrets já cadastrados; aplicativos publicados devem reutilizar sua chave original. Também há opção de importar um keystore anterior sem enviar sua chave privada desprotegida.

Não é um processo de um único clique porque guardar a chave de upload e sua senha é indispensável para futuras atualizações. Nenhum Secret é salvo no `localStorage` do painel. Leia [Assinatura e Play Store](docs/ASSINATURA-E-PLAY-STORE.md).

## Criar a primeira chave de upload pelo console (fluxo manual anterior, avançado)

A etapa 5 inclui gerador de chave com GitHub Actions e recuperação de backup criptografado via WebCrypto. Configure primeiro uma senha forte em `ANDROID_KEYSTORE_PASSWORD` no GitHub Secrets do aplicativo; baixe o ZIP contendo `upload-key.jks.ubenc` e o certificado `.pem`, importe o arquivo criptografado no painel, informe a senha para desbloquear **localmente**, baixe o JKS e copie o Base64 para `ANDROID_KEYSTORE_BASE64`. O alias é `upload`; a senha da chave é igual à do keystore. Guarde backups independentes. Não use este gerador para substituir chave de um app já publicado.

[Auditoria completa do fluxo e roadmap](docs/AUDITORIA-FLUXO-2026-11-23.md).

## Assistente de etapas progressivas (proposta em PR)

O fluxo mobile-first foi organizado em cinco telas: **Aplicativo → Anúncios (opcional) → Compilar → Resultados → Assinar**. A navegação preserva os formulários já abertos, protege alterações AdMob não salvas e permite assinar AAB de uma execução anterior. O status dos Secrets aparece fora do menu de geração e não expõe valores. **Enquanto esta mudança estiver em branch/PR, não atribuí-la ao painel publicado.**

[Auditoria técnica e documentação de aceite do wizard](docs/AUDITORIA-WIZARD-2026-11-23.md).

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
