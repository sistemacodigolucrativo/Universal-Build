# Painel web estático — Universal Build

Painel sem backend/banco de dados, para uso individual. Inclui:
- autenticação por usuário e Personal Access Token;
- sessão até a próxima meia-noite local (armazenada em `localStorage`);
- criação de repositórios quando o token permitir;
- listagem e seleção de projetos;
- instalação/atualização do workflow de build;
- upload opcional de ZIP de até 15 MiB;
- envio de parâmetros e acionamento do GitHub Actions;
- histórico e acesso aos APK/AAB por meio da página de execução no GitHub.

## GitHub Pages (hospedagem principal)

1. Acesse `Settings → Pages` no Universal-Build.
2. Em **Build and deployment → Source**, escolha **GitHub Actions**.
3. Confirme a execução do workflow **Publicar Universal Build no GitHub Pages**.
4. Após a implantação, abra https://sistemacodigolucrativo.github.io/Universal-Build/.
5. Se o site não abrir, confira `Actions → Publicar Universal Build no GitHub Pages`; não exponha tokens para solucionar erros.

O deploy publica **somente** a pasta `dashboard/`. O repositório e seus scripts ficam disponíveis no GitHub.

## Como assinar AAB depois de compilar

1. No painel, selecione `AAB sem assinatura` (`aab-unsigned`) e inicie o build.
2. Aguarde a execução concluir; o artefato será listado.
3. Cadastre no repositório do **aplicativo** os 4 secrets de assinatura documentados em `docs/ASSINATURA-E-PLAY-STORE.md`.
4. Clique em **Assinar este AAB** no artefato ou digite o Run ID e nome do artefato.
5. Inicie **Assinar AAB na nuvem**. Um novo workflow gera o AAB assinado para upload à Play Store.

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
