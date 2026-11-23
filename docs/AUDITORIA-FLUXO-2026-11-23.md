# Auditoria do fluxo Universal Build — 23/11/2026

**Repositório:** sistemacodigolucrativo/Universal-Build. **Base verificada:** main no commit cf786f60ebe38c2d01e31827aa9cbe1990977fe6, incluindo a correção progressiva da PR #9. **Implementação:** branch feat/current-build-downloads-keygen-ux-20261123, PR #10. **Status:** documentação de alterações em PR, sem merge nem confirmação de uso no Android.

## 1. Visão ponta a ponta

O console é uma interface web estática que utiliza um token GitHub na sessão do navegador, grava configuração AdMob na branch escolhida do aplicativo e solicita builds nos GitHub Actions. O motor de build e o workflow de assinatura são reutilizáveis. Não existe backend do painel nem emissão de certificados/chaves por um serviço privado. Nenhuma chave deve ser armazenada em Git, em logs ou no localStorage.

| Etapa | Entrada / operação | Saída | Evidência e risco observado |
|---|---|---|---|
| Acesso | usuário e PAT com permissões de repositório | sessão no browser até meia-noite | PAT no localStorage; exige cautela em dispositivo compartilhado |
| Projeto | listar, identificar Android, escolher repo/branch | alvo da configuração e build | inspeção de árvores de muitos repos pode ser lenta ou ficar limitada por API |
| Workflows | instalar/atualizar build, assinatura e gerador | commits na branch padrão do app | confirmação explícita obrigatória; substitui YAML existente |
| AdMob | ativar apenas banner ou modos extras; salvar | JSON versionado na branch do app | configurações só entram em novo APK/AAB e apps com módulo nativo |
| Build | selecionar APK debug, AAB unsigned ou release; advanced opcional | workflow_dispatch do Android | Flavor auto é adequado ao QR Studio; checks reais dependem do app |
| Progresso | consultar jobs e passos GitHub Actions | card da execução atual e histórico recolhido | porcentagem de etapas não representa porcentagem do Gradle |
| Download | clicar artefato da execução atual | ZIP do GitHub, extraível no Android | fetch com token atravessava 302/CORS; agora navegação autenticada do GitHub |
| Chave | secret forte para proteção; workflow keygen | JKS PKCS#12 protegido, certificado PEM e artifact criptografado | a chave privada NÃO pode ser publicada em arquivo em claro |
| Recuperação | importar .ubenc e senha no navegador HTTPS | baixar JKS e copiar Base64 para Secret | WebCrypto local, sem envio de senha ou chave ao painel |
| Assinatura | Run ID + artifact unsigned + 4 GitHub Secrets | release-signed.aab via job de assinatura | JKS/alias/senhas obrigatórios; AAB unsigned não vai à loja |
| Play Store | usar bundle assinado, dados do aplicativo e política de privacidade | lançamento sujeito à revisão do Google | CI não prova conformidade nem veiculação real de anúncios |

## 2. Itens corrigidos na PR #10

### UB-UX-001 — Progresso e execução correta

- A seleção da execução atual considera o workflow de build, a branch, o disparo recente e os IDs conhecidos, evitando mostrar a execução anterior como a nova compilação.
- Mesmo que exista um build anterior ainda ativo, o card em destaque acompanha o build **mais recente** da branch.
- Durante um novo disparo sem Run ID disponível, aparece mensagem de identificação pendente, sem botões de artefato de outra execução.
- O histórico fica no dropdown **Compilações anteriores**; cada card conserva status, Run ID, data e acesso aos logs.
- A exibição inicial cobre até 12 execuções; para históricos completos, consultar a página do workflow no GitHub. Não se deve interpretar isso como uma listagem exaustiva.

### UB-UX-002 — Download sem erro de fetch

- A interface abre um link nativo para o artifact do GitHub, em vez de tentar baixar seu ZIP via fetch no domínio api.github.com após redirecionamento 302.
- O download resultante é um ZIP do GitHub (mesmo que contenha um único APK ou AAB); no Android, extrair antes de instalar ou enviar ao Play Console.
- Essa solução evita CORS no código do painel; ainda requer que o usuário esteja autenticado no domínio github.com, e o artefato não pode estar expirado.
- A interface nunca afirma ter baixado um arquivo sem confirmação do navegador; download direto de APK extraído não é prometido.

### UB-KEY-001 — Geração e recuperação segura de chave

- Novo workflow de **primeira geração** via keytool no GitHub Actions, usando secret ANDROID_KEYSTORE_PASSWORD com 20 ou mais caracteres. Não aceita segredos no payload do workflow_dispatch.
- Cria uma chave RSA 3072 bits com certificado SHA256withRSA, 100 anos de validade, alias upload, armazenada em keystore formato PKCS#12 com extensão .jks. O JDK utilizado nos builds reconhece PKCS#12. O certificado público é exportado como PEM.
- Um script Node cifra o arquivo completo com AES-256-GCM, chave derivada por PBKDF2-HMAC-SHA256 com 310.000 iterações, salt e IV aleatórios; somente upload-key.jks.ubenc e o certificado público são publicados no Artifact.
- Recuperação local no browser através de WebCrypto. A senha e a chave são mantidas em memória transitória, não enviadas por HTTP, nem persistidas no localStorage.
- O fluxo impede emitir uma nova chave quando já existir ANDROID_KEYSTORE_BASE64 nos Secrets do aplicativo; essa proteção não substitui guardar backup externo e não cobre mudanças manuais nos secrets.
- Após recuperar: guardar o arquivo .jks fora do GitHub, copiar Base64 para ANDROID_KEYSTORE_BASE64, definir ANDROID_KEY_ALIAS=upload, ANDROID_KEY_PASSWORD igual à senha de proteção; conservar ANDROID_KEYSTORE_PASSWORD original.
- O Artifact criptografado expira em sete dias; recuperar e fazer backup imediatamente. O certificado PEM é público e não substitui o JKS nem contém a chave privada.
- **Limite de segurança:** mesmo criptografado, um arquivo com chave privada exige senha longa e exclusiva. Jamais compartilhe o Artifact, senha, JKS ou seu Base64. Um repositório público pode expor o backup criptografado, mas sem a senha ele não deve revelar o conteúdo.

### UB-UX-003 — Menos campos obrigatórios visíveis

- No painel de compilação, somente o tipo de build e o botão principal ficam evidentes; pasta, módulo, flavor, Java, Node, Flutter e ZIP estão em **Configurações avançadas**, preservando valores antigos.
- No AdMob, banner permanece em destaque; intersticial e recompensado são opcionais e ficam recolhidos.
- A seção 5 explica primeiro como obter uma chave para a primeira publicação, sem obrigar instalação de Termux ou Android Studio.
- A sugestão antiga de dropdown de outras compilações na etapa de assinatura foi descartada e não foi adicionada.

## 3. Diagnóstico dos pontos ainda frágeis

| Prioridade | Achado | Efeito / tratamento recomendado |
|---|---|---|
| P0 | Usuário pode confundir AAB unsigned com arquivo pronto para Play | Manter mensagens e verificar assinatura/target SDK/versionCode antes do envio |
| P0 | Perda de senha ou da chave de upload dificulta atualizações | Exigir backup de JKS e senhas em local independente; jamais regenerar silenciosamente |
| P0 | PAT em localStorage até meia-noite | Não usar computadores compartilhados; no futuro avaliar autenticação OAuth com backend/escopos menores |
| P1 | Download depende de autenticação GitHub no navegador, diferente do token do painel | Explicar sessão no github.com e exibir link de logs quando necessário |
| P1 | Workflow de geração exige configuração prévia de secret e vários passos manuais | Futuro wizard para secrets com checklist seguro, sem armazenar senhas no painel |
| P1 | Histórico mostra somente janela das execuções recentes | Incluir paginação sob demanda e link de histórico completo para não esgotar API |
| P1 | Filtragem de repositórios por consulta sequencial de árvores | Cache por repo/branch, lista de favoritos, barra de avanço e cancelamento |
| P1 | 'Instalar/atualizar workflows' pode sobrescrever YAML personalizado | Exibir comparação/diff e oferecer atualização por PR em vez de sobrescrita |
| P1 | Avisos de AdMob e UMP dependem de implementação nativa | Validação pré-publicação de consentimento, Data Safety, declaração de anúncios e política de privacidade |
| P2 | Percentual atual reflete etapas do Actions, não a compilação em tempo real | Manter explicação visível e fornecer último passo/tempo decorrido, sem números inventados |
| P2 | Um novo build pode ser disparado durante outro | Exibir link para cancelar run, impedir duplo clique e permitir voltar a acompanhar após atualizar a página |
| P2 | Mudanças em workflows referenciados por @main impactam builds futuros | Fixar revisões testadas por SHA no futuro e registrar versão do motor por build |
| P2 | Exibição responsiva nunca foi testada aqui em todas as ROMs | Validar Chrome Android, Redmi/MIUI, Samsung/One UI e tablet, em retrato e paisagem |

## 4. Roteiro operacional simplificado para QR Studio

1. Selecionar QR Studio e branch desejada. Instalar workflows somente se estiverem ausentes/desatualizados.
2. Ajustar AdMob se necessário e salvar na mesma branch de compilação. Para produção, usar IDs reais em flavor prod.
3. Selecionar tipo de build. Para primeira assinatura sem Secrets, usar APK de teste + AAB sem assinatura (assinar depois).
4. Iniciar e acompanhar a compilação atual no card 4; abrir Compilações anteriores somente quando necessário.
5. Baixar ZIP pelo link do GitHub e extrair o arquivo unsigned.aab.
6. Na primeira publicação, configurar ANDROID_KEYSTORE_PASSWORD forte no GitHub Secrets. Gerar chave, baixar o artifact criptografado, importar .ubenc no painel e recuperar JKS com sua senha.
7. Guardar backup, cadastrar os demais Secrets e preencher Run ID e artifact unsigned; assinar AAB na nuvem.
8. Baixar o release-signed.aab do workflow de assinatura, verificar arquivo, target SDK, versão e enviar manualmente ao Play Console após revisar requisitos da loja.

## 5. Testes e critérios de aceite

- **Automatizados:** Node (seleção de build, HTML, URLs, WebCrypto vs Node AES-GCM, password errado, bytes adulterados), shell/keytool (PKCS12/PEM reais), YAML, Python/IDs; CI associado à PR.
- **Manuais pendentes:** GitHub Pages no Android, autenticação GitHub na aba de download, ZIP extraído, recuperação do arquivo cifrado no Chrome Android, copiar Base64 e assinar um AAB verdadeiro no repositório do usuário.
- **Não executado nesta tarefa:** emissão de segredo real, alteração de QR Studio, deploy Pages, aprovação Play Store, clique em anúncios ou publicação de release.

## 6. Rastreabilidade e rollback

- Fonte: dashboard/, templates/android-keygen.yml, .github/workflows/keygen-reusable.yml, scripts/keygen-encrypt.cjs e testes/CI.
- PR principal: https://github.com/sistemacodigolucrativo/Universal-Build/pull/10
- PR anterior incorporada: https://github.com/sistemacodigolucrativo/Universal-Build/pull/9 (não mesclar independentemente caso a #10 seja incorporada).
- Reversão: reverter a PR/commit do painel e scripts; manter backups JKS já emitidos fora do GitHub. Nunca invalidar chaves usadas em versões da loja.

**Decisão:** priorizar um fluxo transparente e seguro, não prometer automação impossível (a Play Store exige informações e revisões externas, e o GitHub protege downloads por autenticação).
