# Auditoria técnica e UX progressiva — Universal Build (23/11/2026)

## 1. Escopo, fontes e evidências

- **Repositório:** sistemacodigolucrativo/Universal-Build.
- **Base auditada:** main @ ca7a7be9aa682bf398053017ef4eace31c782f1c.
- **Branch da implementação:** feat/progressive-stepper-ux-audit-20261123. Nenhuma alteração foi feita na main nesta entrega.
- [CI da main — sucesso](https://github.com/sistemacodigolucrativo/Universal-Build/actions/runs/45208374051).
- [Deploy GitHub Pages da main — sucesso](https://github.com/sistemacodigolucrativo/Universal-Build/actions/runs/45208373752).
- [PR #9 — ainda aberta no momento da inspeção](https://github.com/sistemacodigolucrativo/Universal-Build/pull/9). Verificar se já foi incorporada por outra PR antes de nova decisão.
- **Fontes de código inspecionadas:** dashboard/index.html, app.js, style.css, signing-setup.js, secret-crypto.js, android-repos.js, artifact-download.js, build-progress.js; scripts/build.sh, sign-aab.sh, extract_zip.py, keygen-encrypt.cjs; templates Android; workflows reutilizáveis de compilação, assinatura, geração e CI; testes e documentação AI-HANDOFF.

**Escopo de validação:** auditoria estática com evidência de Actions. Não foi realizado pentest, teste dinâmico autenticado no Chrome Android, Play Console, teste em todas as ROMs, geração de chave real nem publicação nesta tarefa. Não declarar essas verificações como concluídas.

## 2. Arquitetura / fronteiras de confiança

1. O dashboard é HTML/CSS/JS estático servido por GitHub Pages; não possui backend.
2. Um token pessoal GitHub conecta o painel; a implementação atual persiste o PAT no localStorage até meia-noite do dispositivo.
3. O repositório selecionado do aplicativo armazena fonte Android, configurações AdMob na branch escolhida e workflows na branch padrão.
4. GitHub Actions gera ZIP de APK/AAB. O processo de assinatura AAB é posterior, independente e usa Secrets do próprio repositório Android.
5. A API do GitHub revela somente nomes e metadados dos Secrets, não seus valores. Quatro Secrets cadastrados não comprovam senha, certificado ou JKS corretos.
6. Envio do AAB assinado à Google Play é manual e sujeito a políticas externas.

## 3. Matriz priorizada de achados

| ID | Prioridade | Achado com evidência no código | Tratamento |
|---|---|---|---|
| SEC-01 | P0 | app.js persiste PAT em localStorage, decisão histórica com risco de XSS, extensões e aparelhos compartilhados | Backlog: credenciais de menor privilégio e modelo de sessão mais seguro |
| SEC-02 | P0 | signing-setup.js identifica apenas nomes de Secrets, não valores | Corrigida mensagem e movido status para fora do gerador |
| SIG-01 | P0 | sign-aab.sh verifica jarsigner, target SDK e versionCode, mas não compara certificado ao cadastrado no Google Play Console | Gate manual; automatização de fingerprint como evolução |
| SIG-02 | P0 | Geração nova de JKS em app já publicado impediria futuras atualizações; backup de senha baixado em TXT não cifrado | Fluxo mantém consentimento explícito e recomenda guardar backup privado |
| SEC-03 | P1 | Criação sequencial dos quatro Secrets pode deixar estado parcial se a API falhar | Planejar retomada/reconciliação segura sem gerar JKS novamente |
| GIT-01 | P1 | Botão instalar/atualizar pode sobrescrever workflow YAML na branch padrão do app | Relegado a menu avançado; futura prévia de diff e alteração por PR |
| GIT-02 | P1 | Reusable workflows utilizam referências mutáveis @main | Versionar motor e fixar commit/tag imutável |
| UX-01 | P1 | Cinco seções apareciam ao mesmo tempo, com excesso de texto em mobile | Novo wizard de cinco telas implementado |
| UX-02 | P1 | AdMob não é requisito para compilar; abandonar formulário editado podia perder dados | Tela opcional, confirmação para sair sem salvar |
| UX-03 | P1 | É necessário assinar um AAB de uma execução anterior sem novo build | Navegação direta e evento de seleção implementados |
| UX-04 | P1 | Os Secrets só eram mostrados dentro do menu Gerar chave | Status sempre visível na tela Assinar |
| API-01 | P1 | loadRepos varre até 500 repositórios, com até 8 chamadas de árvore simultâneas | Cache/favoritos/paginação e cancelamento em backlog |
| API-02 | P2 | Progresso calcula etapas de Actions e não porcentagem interna do Gradle | Sem alteração; rótulo explicativo preservado |
| ART-01 | P1 | O download via github.com depende de sessão GitHub, e artifact é ZIP que pode expirar | Comportamento e avisos preservados |
| ZIP-01 | P2 | extract_zip.py bloqueia zip-slip, symlinks e expansão acima do limite | Controles positivos observados; manter testes de entradas adversariais |
| PLAY-01 | P1 | Limite de target SDK no script não substitui a regra vigente da Play Console | Conferência antes de cada lançamento; validar versionCode crescente |
| ADS-01 | P1 | Arquivo JSON AdMob no GitHub não instala SDK nem garante UMP/Data Safety | Manter transparência e permitir pular anúncios |
| A11Y-01 | P1 | Novo fluxo depende de foco/indicador de etapa e responsividade | aria-current, aria-live, foco nos títulos e controles de toque; testes manuais pendentes |

## 4. Fluxo progressivo proposto e implementado

| Etapa | Tela | Comportamento |
|---|---|---|
| 1 | Aplicativo | Escolher repositório e branch; opções de workflow em Avançado; sem seleção, seguir bloqueado |
| 2 | Anúncios | AdMob opcional, com confirmação de saída quando existem alterações não salvas |
| 3 | Compilar | Escolher APK/AAB; configurações técnicas em Avançado; iniciar build |
| 4 | Resultados | Abrir automaticamente após dispatch bem-sucedido; acompanhar execução atual e histórico |
| 5 | Assinar | Detectar existência dos 4 Secrets sem expor valores; reutilizar JKS; gerar primeira chave somente mediante ação explícita |

O usuário também pode abrir uma etapa diretamente após selecionar repositório. Isso permite usar a tela 5 para assinar AAB unsigned de build anterior. A navegação não cria builds, não troca secrets e não persiste senhas adicionais. Campos ocultos permanecem em memória DOM enquanto o painel está aberto; não se afirma que avançar conclui uma tarefa opcional.

**Implementação:** dashboard/wizard-flow.js, index.html, style.css, app.js, signing-setup.js; testes/wizard-flow.test.cjs; CI estendido.

## 5. Checklist e critérios de aceite

- [x] Cinco etapas com botões Anterior/Continuar, menu de navegação e indicador visível.
- [x] Bloqueio das etapas 2–5 antes de escolher repositório.
- [x] AdMob opcional e confirmação para alterações locais não salvas.
- [x] Apenas dispatch GitHub aceito muda de Compilar para Resultados.
- [x] Seleção de AAB unsigned anterior abre Assinar com Run ID e artifact já preenchidos.
- [x] Status de Secrets fora do menu de geração, com aviso de que valores não são observáveis.
- [x] Testes unitários e fluxo de DOM simulado adicionados ao CI.
- [x] [CI da branch concluído com sucesso — execução 45220977322](https://github.com/sistemacodigolucrativo/Universal-Build/actions/runs/45220977322); suíte Node, scripts shell, auditoria de IDs e workflows.
- [ ] Teste manual no Chrome Android (retrato/paisagem, rolagem, teclado e leitor de tela).
- [ ] Fluxo autenticado: AdMob, build, histórico, ZIP, AAB e Secrets reais.
- [ ] SHA-256 do certificado do AAB confrontado com Play Console quando o app já estiver publicado.
- [ ] Merge e implantação autorizados depois de revisão.

## 6. Padrões de referência

- [W3C — Multi-page Forms](https://www.w3.org/WAI/tutorials/forms/multi-page/) para progressão com contexto e estado.
- [W3C — aria-current](https://www.w3.org/TR/wai-aria/#aria-current) para identificar etapa atual.
- [GOV.UK — Task list](https://design-system.service.gov.uk/components/task-list/) para tarefas opcionais e retorno posterior.
- [GitHub — Actions Secrets](https://docs.github.com/en/rest/actions/secrets) sobre metadados/valores inacessíveis.
- [Android — App signing](https://developer.android.com/studio/publish/app-signing) sobre chave de upload e assinatura.

## 7. Riscos residuais, rollback e prioridades seguintes

Não alterar main, nem reemitir keystore, nem sobrescrever secrets durante a revisão. Reverter a branch/PR remove somente componentes do wizard, eventos, mensagem e testes. JKS e assinaturas anteriormente existentes não são tocados.

**P0/P1 seguintes:** reduzir risco do PAT; identificar certificado com fingerprint SHA-256; tratar Secrets parciais e recuperação idempotente; comparar YAML antes de substituição; fixar revisão do motor; performance de busca com cache; homologação no dispositivo e acessibilidade. Cada medida deve ter teste e evidência separados.
