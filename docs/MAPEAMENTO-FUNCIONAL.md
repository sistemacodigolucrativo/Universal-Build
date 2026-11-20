# Mapeamento funcional e auditoria — Universal Build (20/11/2026)

## Objetivo e regras aprovadas

Painel pessoal de compilação Android, acessível por celular, hospedado em GitHub Pages e integrado diretamente ao GitHub REST API. Sem servidor próprio nem banco de dados. O GitHub Actions executa os builds em projetos Android Gradle, Flutter e React Native. Artefatos de teste em **APK** e artefatos de publicação Play Store em **AAB**, com assinatura digital obrigatória antes do upload.

**AAB sem assinatura é um intermediário, NÃO é aceito para publicação na Google Play.** A assinatura pode ser feita depois do build pelo workflow próprio `universal-sign.yml` usando secrets do repositório de cada aplicativo.

## Inventário auditado

| Área | Função | Estado v2 |
|---|---|---|
| Acesso | Login usuário + token GitHub | Implementado; validação manual em navegador pendente |
| Acesso | Sessão armazenada até meia-noite, desconexão manual | Implementado; armazenamento local possui risco inerente |
| GitHub | Listagem/seleção de até 500 repositórios com push | Implementado; depende do token |
| GitHub | Criação de novos repositórios | Implementado; tipo de PAT pode limitar |
| Integração | Instalar e atualizar workflows de build e assinatura | Implementado; requer permissão para alterar workflows |
| Projeto | Escolher diretório, módulo Gradle, JDK, Node e Flutter | Implementado |
| Projeto | Importar ZIP de até 15 MiB e validar extração | Implementado; cópia incluída no Git |
| Projeto | Identificar Android Gradle, Flutter, React Native | Implementado; apenas Android nativo testado em execução real |
| Build | APK debug (instalável) | Teste real aprovado |
| Build | AAB release assinado no build | Teste real aprovado |
| Build | AAB unsigned e APK + AAB unsigned | Implementado; smoke test em andamento |
| Assinatura | Workflow de assinatura posterior ao build | Implementado; teste com chaves efêmeras em andamento |
| Play Store | Verificar assinatura, API 36 e versionCode | Implementado para AAB; não cobre todas as políticas |
| Histórico | Builds, status, logs via GitHub e artefatos | Implementado; teste da UI pendente |
| Histórico | Atualização do status a cada 30 s | Implementado |
| Histórico | Seleção do AAB unsigned para assinatura | Implementado |
| Publicação | GitHub Pages via GitHub Actions | Workflow implementado; ativação e URL ainda precisam ser verificadas |
| Documentação | Guia de uso, implantação, política da Play Store e segurança | Implementado |

## Lacunas e limitações conhecidas

1. **Publicação no GitHub Pages:** workflow já foi criado; confirmar se o repositório está com `Settings → Pages → Source: GitHub Actions` e se a implantação foi aceita.
2. **AAB pós-assinado:** verificar o processo completo em build real, sem tratar o AAB unsigned como publicável.
3. **Flutter/React Native:** os adaptadores foram implementados, mas seus testes de compilação reais precisam ser concluídos antes de declarar compatibilidade validada.
4. **Edição automática de identidade do app:** `applicationId`, `versionCode`, `versionName`, ícone, permissões e `targetSdk` dependem da configuração do código de cada app; a primeira versão não reescreve esses campos silenciosamente.
5. **Assinatura de APK release posterior ao build:** por enquanto o modo `release-apk` utiliza assinatura integrada à configuração Gradle. A assinatura posterior foi implementada para **AAB**, prioridade Play Store.
6. **Tamanho:** importação ZIP limitada a 15 MiB, vinculada a um repositório GitHub. Projetos maiores devem ser enviados via Git, IA ou outro pipeline apropriado.
7. **Chaves reais:** configurar os secrets `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD` no repositório de cada aplicativo, nunca neste repositório público.
8. **Distribuição:** publicar no Google Play Console é um processo separado; o sistema **não faz envio automático** nem garante aprovação das políticas.
9. **Segurança:** o token GitHub é armazenado em localStorage até meia-noite por decisão do proprietário. Não usar navegador compartilhado; rotação e expiração real do token são políticas do GitHub.
10. **Automações adicionais:** criação automática de ícones, telas da loja, alteração de `versionCode`, gestão de múltiplos sabores/flavors, NDK, builds incrementais completos e download direto do artefato no painel são melhorias futuras, não funcionalidades prontas.

## Fluxo recomendado para utilizar

1. Publicar o frontend (GitHub Pages), acessar por HTTPS e autenticar com PAT restrito.
2. Criar ou selecionar repositório do aplicativo com fonte Android compilável.
3. Instalar workflows.
4. Escolher `apk` para testes ou `aab-unsigned` para distribuição futura.
5. Acompanhar o resultado em builds/artefatos.
6. Após aprovação interna do app, configurar secrets de upload no repositório de origem.
7. Selecionar `Assinar este AAB` e acionar o workflow de assinatura, que usa a mesma fonte compilada sem reconstruir.
8. Baixar o `release-signed.aab` e publicar manualmente no Play Console.

## Fontes oficiais

- https://developer.android.com/build/build-for-release
- https://developer.android.com/studio/publish/app-signing
- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages

## Definição de pronto

Considerar **publicado** somente quando GitHub Pages tiver deploy bem-sucedido e a URL responder ao navegador. Considerar **testado** somente o que tiver evidência de compilação real. A aprovação da loja depende do Google Play Console.
