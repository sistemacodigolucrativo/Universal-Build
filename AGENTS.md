# Instruções de entrada para agentes de IA — Universal Build

> **Leia este arquivo antes de planejar ou modificar o repositório.**
> É um protocolo operacional, não uma autorização para efetuar commits, merges, deploys, publicar apps ou usar credenciais.

## Sequência de leitura obrigatória

1. [Índice de transferência de conhecimento](docs/AI-HANDOFF/README.md).
2. [Papéis, arquitetura e fronteiras dos repositórios](docs/AI-HANDOFF/01-ECOSSISTEMA.md).
3. [Como criar um aplicativo usando o Kotlin Master](docs/AI-HANDOFF/02-KOTLIN-TEMPLATE.md).
4. [Operação do painel e motor de build](docs/AI-HANDOFF/03-DESENVOLVIMENTO-E-BUILDS.md).
5. [Releases, assinatura e publicação](docs/AI-HANDOFF/04-PRODUCAO-E-PLAY.md).
6. [Monetização e AdMob](docs/AI-HANDOFF/05-ADMOB.md).
7. [Estado, evidências e pendências](docs/AI-HANDOFF/06-ESTADO-E-RASTREABILIDADE.md).
8. [Procedimentos de validação, recuperação e atualização](docs/AI-HANDOFF/07-CHECKLISTS-E-RUNBOOK.md).

## Primeiras verificações em toda retomada

- Confirme no GitHub o **repositório, visibilidade, branch, commit HEAD, PRs, CI, regras de branch e status de deploy**. Documentos com data são retratos históricos, não o estado em tempo real.
- Leia os arquivos **reais** antes de prescrever comandos: `dashboard/app.js`, `dashboard/android-repos.js`, `templates/`, `.github/workflows/`, `scripts/`, e o código do aplicativo selecionado.
- Confirme o acesso ao repositório Kotlin Master (privado) e ao aplicativo derivado. **Não presuma** acesso a repositórios privados.
- Verifique se a funcionalidade está em `main`, em outra branch, ou só em PR; **não confunda implementação com implantação em produção**.
- Identifique a tarefa do usuário e marque o estado de cada requisito como `proposto`, `implementado em branch`, `validado por CI`, `mesclado`, `implantado` ou `testado em dispositivo`. Não salte estados.
- Registre evidência em URL de arquivo/commit/PR/run, data e limitações; em caso de falta de prova use `não verificado`.

## Invariantes e limites

- Universal Build é **orquestrador de builds Android**, não é o código do app. **Kotlin-Master-Boilerplate** é o **template nativo Kotlin/Compose**; **QR-Studio** é aplicativo derivado. Não confundir com Android-Master-Boilerplate/WebView nem usar este repositório como template de produto.
- Preservar o template mestre: características específicas de um aplicativo pertencem ao seu repositório derivado. Mudanças comuns e genéricas na base só após validação, isolamento e decisão explícita.
- Nunca modificar `main`, executar merge, implantar, assinar release real, publicar no Play Console ou ativar anúncios reais sem autorização específica. Padrão: branch dedicada + PR + verificações.
- Não incluir PAT, senha, JKS, Base64 de chave, dados pessoais ou secrets em Git, documentação, issues ou resposta. IDs públicos AdMob não são credenciais, mas não devem ser copiados desnecessariamente.
- Não substituir recursos nativos por uma WebView sem requisito e decisão explícitos.
- APK `devDebug` é para teste; AAB unsigned não é publicável; release exige assinatura adequada e verificação no Play Console.
- O painel GitHub Pages tem sessão com PAT em `localStorage` até meia-noite: trate isso como risco de segurança conhecido, não como autenticação de padrão corporativo.

## Saída mínima esperada de uma IA ao assumir

Descreva: (a) projeto e fonte examinada; (b) branch/commit exatos; (c) última entrega **com evidência**; (d) pendências e impedimentos; (e) plano de execução com critérios de aceite; (f) alterações propostas; (g) como reverter. Se o usuário solicitar apenas análise, **não implemente**.

## Fonte de verdade e precedência

1. Código + workflows + configuração observados na branch/commit da tarefa.
2. Evidência GitHub Actions, PR, merge e deployment.
3. Documentação contemporânea do repositório e seus links.
4. Registros históricos de decisões.
5. Hipóteses da IA, sempre identificadas como hipóteses.

Documentação em conflito com código deve gerar um item de correção rastreável, não uma conclusão inventada.
