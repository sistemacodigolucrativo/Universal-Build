# Universal Build — Manual de continuidade para IAs e desenvolvedores

**Auditoria inicial: 21/11/2026.** Esta é a porta de entrada permanente do ecossistema Universal Build + Kotlin Master. Seu objetivo é permitir que uma nova IA identifique corretamente os repositórios, compile e teste projetos Android e opere releases sem depender do histórico de uma conversa.

**Importante:** este conjunto é versionado, mas não é atualizado automaticamente quando alguém faz commits em outros repositórios. Toda retomada deve verificar HEAD, PRs e runs atuais. Nenhuma documentação garante, por si só, a completude do histórico do projeto.

## Comece aqui — ordem de execução

| Arquivo | O que responde |
|---|---|
| [AGENTS.md na raiz](../../AGENTS.md) | Normas de segurança e checklist obrigatório para agentes |
| [01 — Ecossistema](01-ECOSSISTEMA.md) | Responsabilidades, relações, diretórios e fonte da verdade |
| [02 — Kotlin Template](02-KOTLIN-TEMPLATE.md) | Derivar app com `Use this template`, adaptar arquitetura e integrar features |
| [03 — Desenvolvimento e builds](03-DESENVOLVIMENTO-E-BUILDS.md) | Console, parâmetros, CI, Android Gradle, troubleshooting inicial |
| [04 — Produção e Play](04-PRODUCAO-E-PLAY.md) | Assinatura, release, segurança e publicação na loja |
| [05 — AdMob](05-ADMOB.md) | Contrato entre console e app, modos, formatos, consentimento e estágio atual |
| [06 — Estado e rastreabilidade](06-ESTADO-E-RASTREABILIDADE.md) | Retrato datado de branches, PRs, limites de evidência e registro de trabalho |
| [07 — Checklists e runbook](07-CHECKLISTS-E-RUNBOOK.md) | Gates, recuperação e atualização contínua da memória de projeto |

## Documentação original (manter como fonte complementar)

- [README geral](../../README.md), [arquitetura original](../ARQUITETURA.md), [mapeamento funcional](../MAPEAMENTO-FUNCIONAL.md), [assinatura e Play Store](../ASSINATURA-E-PLAY-STORE.md), [manual do console](../../dashboard/README.md).
- [README do Kotlin Master](https://github.com/sistemacodigolucrativo/Kotlin-Master-Boilerplate/blob/main/README.md), [arquitetura Kotlin](https://github.com/sistemacodigolucrativo/Kotlin-Master-Boilerplate/blob/main/docs/ARQUITETURA.md), [integração](https://github.com/sistemacodigolucrativo/Kotlin-Master-Boilerplate/blob/main/docs/INTEGRACAO-UNIVERSAL-BUILD.md), [compatibilidade](https://github.com/sistemacodigolucrativo/Kotlin-Master-Boilerplate/blob/main/docs/COMPATIBILIDADE-E-TESTES.md). O Kotlin Master é **privado**; o leitor precisa ter acesso autorizado.
- Código operacional: [workflows](../../.github/workflows/), [templates](../../templates/), [scripts](../../scripts/), [testes](../../tests/), [dashboard](../../dashboard/).

## Definições obrigatórias

- **Implementado**: código existe em branch/commit nomeado. Não equivale a pronto para o usuário.
- **CI aprovado**: checks relacionados àquele commit concluíram com sucesso; não prova experiência real em aparelho.
- **Implantado**: funcionalidade está na branch/artefato/ambiente acessado pelo usuário, com evidência de deploy.
- **Pronto para publicação**: AAB assinado, configuração do app e políticas conferidas; avaliação Google Play continua externa.
- **Source of truth do aplicativo**: repositório derivado e seu `app-config.properties`; não o Universal Build.
- **Histórico persistente**: Git commits, PRs, docs e Actions; conversas de IA podem acrescentar contexto, não substituem evidências Git.

## Atualização desta memória

Sempre que mudar código ou política: atualizar o manual afetado, o registro no arquivo 06 com data/PR/commit/run e, se houver mudança de contrato, atualizar também a documentação do repositório Kotlin/derivado. Os comandos registrados são exemplos verificados contra o código de 21/11/2026; alterações futuras exigem revalidação.

### Lacunas que não devem ser escondidas

Não há um banco central de requisitos/ADRs sincronizado automaticamente entre repositórios. Não há prova automática de publicação Play, testes em todas as ROMs Android, UI de navegador autenticado ou produção AdMob, sem as evidências correspondentes. Consultar os status atuais antes de garantir qualquer capacidade.
