# Universal Build — arquitetura v1

## Escopo aprovado
- Projeto **independente** do repositório CobraFlux.
- Infraestrutura de workflows reutilizáveis do GitHub Actions.
- Adaptadores iniciais: Android Gradle (Java / Kotlin / Compose), Flutter, React Native (Android).
- Resultados: APK de teste, AAB de release, APK release ou ambos.
- Frontend estático em \`dashboard/\`, sem banco de dados e sem backend próprio.
- A autenticação do painel ocorre com usuário + token pessoal do GitHub; a sessão local termina à meia-noite no horário do dispositivo.
- Não é garantido transformar um web site genérico em aplicativo Android sem um projeto Android correspondente. Um projeto web pode ser empacotado em WebView/Capacitor por uma ferramenta de desenvolvimento **antes** do processo de build.

## Organização
- \`.github/workflows/android-reusable.yml\`: motor de build central.
- \`.github/workflows/ci.yml\`: testes estáticos do Universal-Build.
- \`templates/android-build.yml\`: arquivo que será instalado em cada projeto.
- \`scripts/detect.sh\`: identifica o projeto.
- \`scripts/build.sh\`: instala dependências e compila.
- \`scripts/extract_zip.py\`: extração ZIP com validações.
- \`dashboard/\`: painel que usa diretamente o GitHub REST API.
- \`tests/\`: testes de detecção, ZIP e sintaxe YAML.
- \`docs/\`: configuração, limitações, integração e publicação.

## Modelo operacional
1. Criar/selecionar repositório de um app.
2. Inserir código-fonte Android válido (por IA ou importação ZIP).
3. Instalar \`templates/android-build.yml\` no repositório do app.
4. Executar \`workflow_dispatch\` no repositório do app.
5. O workflow chama \`sistemacodigolucrativo/Universal-Build/.github/workflows/android-reusable.yml@main\`.
6. Motor identifica tecnologia, instala as ferramentas, faz build, verifica artefatos e publica o resultado.
7. O painel lista runs e abre a página do GitHub para logs e downloads.

O modelo não é uma plataforma de compilação arbitrária de códigos ou de apps iOS. Inclui frameworks e formatos suportados, extensível por adaptadores.

## Configurações mínimas de GitHub
- \`Actions → General → Allow all actions and reusable workflows\` ou política mais restrita compatível com as Actions usadas.
- \`Workflow permissions\`: **Read repository contents permission** (mínima).
- Mantenha o projeto público de infraestrutura sem qualquer segredo.
- \`workflow_dispatch\` dos projetos requer workflow na branch padrão do app.
- Cada projeto de aplicativo deve estar configurado para aceitar workflows reutilizáveis de \`sistemacodigolucrativo/Universal-Build\`.

## Sessão e segurança
O frontend, por escolha expressa de uso pessoal, guarda o token GitHub em \`localStorage\` até meia-noite e remove após expirar. Esta opção **não protege** contra XSS, extensões comprometidas ou uso de perfil desbloqueado. A expiração local **não revoga o token no GitHub**. Use token de privilégio mínimo, com expiração gerenciada no GitHub, e abra o painel somente em dispositivo confiável. A interface nunca transmite token a servidores do Universal Build: o token vai diretamente a \`api.github.com\`.

## Limites reais da v1
- Upload ZIP pelo navegador: **máximo 15 MiB** por tentativa; projetos grandes devem ser enviados por Git/IA ao repositório. Não carregar \`node_modules\` ou \`build/\` no ZIP.
- O upload grava o ZIP no repositório — se for público, o conteúdo pode ser acessado por terceiros; preferir repositórios privados por aplicativo.
- Processar ZIP pode consumir recursos de memória do celular. O motor impõe limite de 500 MiB após extração e 15.000 entradas.
- Builds possuem limite operacional de 55 minutos por job.
- O catálogo de repositórios lista até 500 repositórios editáveis na conta.
- Se o app tiver módulos não padrão, build flavors, versões incompatíveis, NDK ou dependências nativas, o adaptador pode exigir configuração adicional.
- O painel não assina artefatos pelo navegador, não cria keystore e não publica automaticamente no Play Console.
- Quando a versão do Flutter estiver vazia, será usada a versão \`stable\` disponível no momento do build; fixar versão é recomendado em projetos reprodutíveis.

## Repositório referência
CobraFlux foi auditado somente para obter a abordagem de GitHub Actions. Nenhuma alteração foi aplicada nele.

## Fontes
- https://docs.github.com/en/actions/sharing-automations/reusing-workflows
- https://docs.github.com/en/rest/actions/workflows#create-a-workflow-dispatch-event
- https://docs.github.com/en/rest/repos/contents
- https://developer.android.com/guide/app-bundle
