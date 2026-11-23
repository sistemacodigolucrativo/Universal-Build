# Painel web estático — Universal Build

Painel sem backend/banco de dados, para uso individual. Inclui:
- autenticação por usuário e Personal Access Token;
- sessão até a próxima meia-noite local (armazenada em `localStorage`);
- criação de repositórios quando o token permitir;
- listagem e seleção **apenas de projetos Android verificáveis**: a interface confere a árvore GitHub de cada repositório com permissão de escrita e exige `settings.gradle[.kts]` + `build.gradle[.kts]` + `src/main/AndroidManifest.xml` dentro do mesmo módulo;
- Android nativo, Flutter e React Native com subprojeto Android são aceitos; repositórios somente web, sem estrutura Android, ficam ocultos;
- repositórios inacessíveis ou com árvore truncada sem prova de Android não são exibidos, e o painel avisa sobre verificações incompletas;
- repositórios vazios recém-criados só aparecerão depois de receber código Android compatível;
- instalação/atualização do workflow de build;
- upload opcional de ZIP de até 15 MiB;
- envio de parâmetros, incluindo flavor Android automático ou dev/staging/prod, e acionamento do GitHub Actions;
- detecção automática do Kotlin-Master-Boilerplate (APK devDebug, release prodRelease), preservando builds sem flavors;
- compatibilidade com as variáveis de assinatura UNIVERSAL_* e ANDROID_KEYSTORE_* nos builds assinados;
- histórico e acesso aos APK/AAB por meio da página de execução no GitHub.

## GitHub Pages (hospedagem principal)

1. Acesse `Settings → Pages` no Universal-Build.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.
3. Confirme a execução do workflow **Publicar Universal Build no GitHub Pages**.
4. Após a implantação, abra https://sistemacodigolucrativo.github.io/Universal-Build/.
5. Se o site não abrir, confira `Actions → Publicar Universal Build no GitHub Pages`; não exponha tokens para solucionar erros.

O deploy publica **somente** a pasta `dashboard/`. O repositório e seus scripts ficam disponíveis no GitHub.

## Configurar AdMob por aplicativo

Selecione o aplicativo Android e abra **3 · Configurações · Monetização AdMob**. Você poderá configurar e versionar o App ID, as unidades de banner, intersticial e vídeo recompensado, o modo de teste/produção e o intervalo entre intersticiais. O console salva `config/universal-build-admob.json` no GitHub do aplicativo após sua confirmação. A configuração **não ativa anúncios no APK** sem integração Android específica e recompilação. Consulte [o contrato completo](../docs/ADMOB-CONFIGURACAO.md).

## Ordem do console, branches e downloads

O fluxo atual é: **1 Repositório e branch → 2 AdMob → 3 Configurar compilação → 4 Progresso e downloads → 5 Assinar AAB**.

A branch selecionada determina tanto onde `config/universal-build-admob.json` é salvo quanto o `ref` do build solicitado. A instalação/atualização de workflows permanece na **branch padrão** e precisa de confirmação; o workflow de dispatch deve existir na branch padrão do app.

Todas as notificações temporárias do painel usam **toasts**. O andamento é consultado automaticamente pelo GitHub Actions a cada 12 segundos quando o painel está visível. A barra indica **etapas do workflow**, e não progresso exato do compilador Gradle.

Os artefatos da **última execução e das compilações anteriores** são consultados por execução, sem misturá-los. Abra **Compilações anteriores** mesmo sem iniciar novo build: os cards exibem status, logs e ações de **Baixar ZIP no GitHub** ou **Assinar AAB** (somente AAB unsigned). A lista carrega 20 execuções por página, com botão **Carregar mais compilações** e alternativa **Ver histórico completo no GitHub**. Os arquivos antigos são consultados sob demanda ao abrir o histórico para evitar sobrecarga da API. Arquivos expirados não oferecem download/assinatura. O download usa a página autenticada do GitHub, evitando erros de CORS.

Leia [o guia completo de implementação e limites](../docs/CONSOLE-UX-ADMOB-PROGRESSO.md).

## Primeira assinatura sem preencher Secrets manualmente (automático)

Na opção **5 — Assinatura**, abra **Gerar chave e configurar assinatura automaticamente**. A interface lê o estado atual dos Secrets do repositório **do aplicativo**; o token do Universal Build deve permitir `GET` Secrets/listagem/chave pública e `PUT` Secrets (permissão **Secrets: leitura e escrita**).

1. **Preparar chave e senha automaticamente:** se não houver Secrets existentes, o painel cria uma senha forte **no navegador**. Copie/salve a senha e **confirme que a guardou**. O arquivo .txt baixado contém senha em **texto simples** e deve permanecer seguro.
2. **Confirmar e gerar chave criptografada:** o painel cifra `ANDROID_KEYSTORE_PASSWORD` com a chave pública de Secrets do GitHub, cadastra o Secret via API, instala o workflow de chave se necessário e aciona o gerador. Só o backup `.ubenc` cifrado e o certificado público são entregues pelo Actions.
3. **Recuperar JKS:** baixe o ZIP no GitHub Actions, extraia `upload-key.jks.ubenc`, importe no painel e desbloqueie com a senha guardada, **sem enviá-la para servidor**. Clique em **Baixar minha chave .jks**.
4. **Configurar quatro Secrets automaticamente:** confirme que salvou o JKS e a senha e clique no botão. O navegador cifra individualmente a chave Base64, a senha, o alias e a senha da chave com crypto_box_seal compatível com a API GitHub Actions Secrets. GitHub recebe apenas valores cifrados. O Secret `ANDROID_KEYSTORE_BASE64` é criado **por último** como marcador de configuração completa. O painel confirma via listagem a presença dos quatro nomes, sem poder ler seus valores.
5. **Assinar:** volte ao AAB selecionado e clique **Assinar AAB na nuvem**. O processo reutilizará a mesma chave para os próximos builds do mesmo aplicativo.

**Já existe chave?** Use **Já tenho um arquivo .jks/.keystore usado em outro sistema** e informe alias e senhas originais. Não crie nova chave se o aplicativo já está publicado. O console bloqueia substituição automática se `ANDROID_KEYSTORE_BASE64` já existir; para alterações intencionais extraordinárias, gerencie os Secrets fora do assistente e confira a identidade da chave. Em caso de falha parcial, verifique os nomes dos Secrets no GitHub antes de repetir.

**Limites de validação:** CI pode validar criptografia, UI e workflow, mas não substitui o teste com seu PAT no Android nem uma assinatura real com credenciais privadas. Não publique nem envie sua senha/JKS no chat.

## Como assinar AAB depois de compilar

1. No painel, selecione `AAB sem assinatura` (`aab-unsigned`) e inicie o build.
2. Aguarde a execução concluir; o artefato será listado.
3. Cadastre no repositório do **aplicativo** os 4 secrets de assinatura documentados em `docs/ASSINATURA-E-PLAY-STORE.md`.
4. No card mais recente ou no dropdown **Compilações anteriores**, clique **Assinar AAB**; o painel levará à opção 5 com Run ID e nome preenchidos. Alternativamente, digite os dois valores manualmente. O botão habilita com formatos válidos e um repositório selecionado.
5. Clique em **Assinar AAB na nuvem**. Antes do dispatch, o painel confirma no GitHub a existência do artefato não expirado. A configuração correta dos quatro secrets continua obrigatória; a habilitação do botão não garante assinatura bem-sucedida.
6. O arquivo **.ubenc** é o backup criptografado da chave de upload, utilizado no fluxo separado de geração/recuperação. Não é um APK/AAB e não é necessário para escolher um build para assinatura.

O modo de assinatura posterior não recompila o código-fonte. APK de debug não precisa dessa etapa.

## Vercel (hospedagem alternativa)
1. Importar o repositório `sistemacodigolucrativo/Universal-Build`.
2. **Root Directory**: `dashboard`.
3. **Framework Preset**: `Other`.
4. **Build Command**: deixar vazio (sem build de framework).
5. **Output Directory**: `.`.
6. Publicar o projeto e abrir a URL.
7. Não criar nenhuma variável pública do tipo `VITE_GITHUB_TOKEN`. O token somente é informado no login.

## Permissões no GitHub do token
Preferência: **Fine-grained PAT**, com acesso aos repositórios desejados:
- Metadata: leitura;
- Contents: leitura e escrita;
- Actions: leitura e escrita;
- Workflows: escrita (quando a edição de arquivos YAML for permitida pelo token).
- Criação de repositórios privados/públicos pela API pode exigir autenticação **classic PAT** com `public_repo`/`repo` ou outro método autorizado. Se um fine-grained PAT não permitir a operação, crie o repositório no GitHub e depois selecione-o no painel.

## Segurança do armazenamento local
O token pessoal é salvo em `localStorage` até meia-noite. Essa decisão privilegia praticidade e foi explicitamente solicitada, mas é menos segura que autenticação OAuth com backend. A sessão não substitui prazo de validade nem revogação do PAT no GitHub. Não usar em aparelhos compartilhados.

## Como testar sem Vercel
Hospedar os arquivos de `dashboard/` em qualquer servidor estático (por exemplo, GitHub Pages ou Vercel), sempre em HTTPS. Não abrir `index.html` como `file://`.

## Notas de formato
- APK debug é instalável no celular.
- AAB release é para Google Play.
- Um AAB exige uma chave de upload válida e `targetSdk` compatível com as políticas atuais.
- Para ZIPs maiores, será necessário usar repositório preenchido por Git ou implementar upload robusto com Git Data API.

## Kotlin-Master-Boilerplate — integração de ponta a ponta

1. Verifique que o projeto Kotlin está na lista Android: ele contém `settings.gradle.kts`, `app/build.gradle.kts`, `app/src/main/AndroidManifest.xml`.
2. Selecione `Kotlin-Master-Boilerplate`. Instale/atualize os workflows universais no próprio repositório do aplicativo; eles **não** alteram o código Kotlin.
3. Escolha `Automático`, raiz `.`, módulo `app`, Java 17 e **APK de testes**. O console chama `assembleDevDebug` e coleta apenas o artefato da variante `dev`.
4. Para **AAB sem assinatura**, o console chama `bundleProdRelease` e coleta apenas o artefato `prod`. Para `APK + AAB unsigned`, executa ambos.
5. O modo assinado requer os quatro `ANDROID_KEYSTORE_*` como GitHub Secrets no repositório do aplicativo. O runner adapta o contrato ao script Gradle Kotlin, sem publicar chaves.
6. Confira os logs e artefatos da execução do workflow `Universal Build - Compilar Android` no histórico do console.
7. Se o projeto tiver alterações específicas nos flavors, escolha `dev`, `staging` ou `prod` explicitamente; em aplicativos sem flavors, mantenha `Automático`.

**Limite de evidência:** testes automatizados do script e execução do workflow reutilizável provam o pipeline; um clique autenticado no painel hospedado depende da sessão PAT do proprietário e deve ser validado no navegador Android. Sem assinatura real não é possível afirmar que AAB release assinado foi testado com a chave de upload do proprietário.
