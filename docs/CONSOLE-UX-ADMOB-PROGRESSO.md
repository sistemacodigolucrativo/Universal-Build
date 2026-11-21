# Universal Build — console: anúncios, toasts, progresso e downloads

## Escopo desta implementação

Esta atualização se apoia na branch `feat/admob-settings-console` (PR 5): os arquivos AdMob já existiam **na PR**, mas não no painel publicado em `main`. Esta etapa reorganiza a interface, conecta o seletor de branch aos dados do AdMob e ao `workflow_dispatch`, adiciona progresso consultado no GitHub Actions, toasts globais e downloads de artefatos no próprio painel.

**Estado:** as alterações permanecem em PR até revisão/merge/deploy. Não confundir branch com site publicado.

## Ordem dos cards no console

1. **Repositório + branch:** selecionar repo Android, escolher a branch para **configurações e builds**, atualizar lista e instalar workflows.
2. **Monetização · Google AdMob:** App ID, unidade banner/intersticial/recompensado, toggles separados, cooldown e modo off/test/live; salvar `config/universal-build-admob.json` na **branch selecionada**, mediante confirmação.
3. **Configurar e compilar:** tipo de build, flavor, ferramentas e ZIP opcional; `workflow_dispatch` usa a **branch selecionada**.
4. **Progresso, compilações e downloads:** etapas reais reportadas pelo GitHub Actions, status e acesso aos binários.
5. **Assinatura:** só após obter AAB unsigned; o botão de seleção do arquivo preenche Run ID e nome do artifact.

A ação **Instalar ou atualizar workflows** continua escrevendo na **branch padrão** do aplicativo. Isso é necessário para registrar os workflows e evitar a suposição de que instalar YAML somente em branch de feature registra automaticamente um `workflow_dispatch` na interface GitHub. A ação pede confirmação antes de escrever.

## Como usar no Android (fluxo de teste)

1. Selecione o repositório **QR-Studio** (ou outro app com módulo AdMob já integrado).
2. Selecione a branch que contém o código funcional, como `experiment/admob-test-banner`, e **não** a `main` se esta ainda contém o template.
3. No card AdMob escolha `mode=test`, ative apenas **Banner** e, se desejar, registre seu App ID e a unidade do banner. **O APK de desenvolvimento usa IDs de demonstração oficiais, mesmo se os IDs salvos forem reais.**
4. Salve a configuração na branch selecionada. Essa ação **não ativa anúncios no APK já instalado**.
5. Selecione build `APK de testes`, flavor `auto`, diretório `.`, módulo `app`, JDK 17; inicie.
6. O painel consulta o GitHub Actions automaticamente a cada **12 segundos** quando visível e autenticado. Mostra as **etapas de workflow concluídas** e a etapa atual; **não dispõe de percentual interno da compilação Gradle**.
7. Após concluir, o painel lista os artifacts com botão **Baixar arquivo**. Quando um ZIP do GitHub tem exatamente um APK/AAB, em navegador compatível usa `DecompressionStream('deflate-raw')` para entregar o arquivo diretamente. Quando o artifact contém vários arquivos ou o browser não suporta descompactação, baixa **ZIP**; no caso de bloqueio CORS/redirecionamento do GitHub, use **Ver logs no GitHub**.
8. Instale o APK de teste, valide consentimento, internet, rotação e banner. Registre SHA, link do run e resultado observado no dispositivo.

## Limites técnicos e garantias

### Progresso em tempo real

O GitHub Actions **não expõe porcentagem exata de compilação do Gradle** via API de jobs. O indicador representa a quantidade de passos do job marcados como concluídos pelo GitHub. Estados `queued` podem ter barra indeterminada. A barra **não é um percentual de bytes nem tempo restante**. Runs são consultados por **branch**; não se deve atribuir progresso de outro commit ao build recém-disparado.

### Downloads diretos

A API `GET /repos/{owner}/{repo}/actions/artifacts/{id}/zip` devolve **302** para um URL de arquivo temporário. O painel tenta `fetch` autenticado e download local; alguns navegadores ou hospedagens podem bloquear o redirecionamento por CORS. Não existe API do GitHub para baixar um APK individual de dentro do artifact: o painel faz a extração no navegador quando tecnicamente possível. ZIP contendo vários binários permanece ZIP. Arquivos expirados não têm botão de download. Não se promete download direto em 100% dos navegadores.

Arquivo APK de debug **não é** AAB publicável. AAB **sem assinatura** precisa do card de assinatura. Para publicar na Play Store, conferir políticas atuais e usar AAB **assinado**.

### Toasts

Avisos temporários e erros usam toasts flutuantes, com controle de fechar, auto-remoção, acessibilidade (`role=status/alert`) e limite de quatro visíveis. Estados persistentes de formulário (configuração, etapa de build) permanecem no próprio card; eles não são avisos temporários.

### AdMob e compatibilidade cross-repo

O painel salva só **JSON no repositório do app**, não instala SDK por conta própria. O módulo `:core:ads` é implementado na [PR 12 do Kotlin Master](https://github.com/sistemacodigolucrativo/Kotlin-Master-Boilerplate/pull/12) e usado no [QR-Studio PR 7](https://github.com/sistemacodigolucrativo/QR-Studio/pull/7). Em 21/11/2026, o QR Studio teve as PRs 6 (MVP) e 7 (AdMob) mescladas à `main`; a PR 12 do Kotlin Master ainda depende da promoção após gate final. A [PR 8](https://github.com/sistemacodigolucrativo/QR-Studio/pull/8) habilita banner de teste.

No código proposto, `dev/staging` usam os IDs demonstrativos e `prod` somente `mode=live` pode usar IDs reais. A seleção de formatos no painel **não cria automaticamente gatilhos de intersticial ou de vídeo recompensado**; pontos de exibição e consentimento devem ser implementados no app. Alterações no App ID exigem nova compilação. A produção requer aprovação do usuário, privacidade, Google UMP e exigências da conta/loja.

## Testes automatizados

- `tests/admob-settings.test.cjs`: validações JSON, IDs, modos e controles.
- `tests/console-live.test.cjs`: cálculo de etapas, ZIP APK único, ZIP com múltiplos binários, caminhos inseguros, associação de UI e branch.
- `tests/test-dashboard.py`: existência e unicidade de IDs usados pelo JS no HTML.
- `.github/workflows/ci.yml`: `node --check`, testes Node e Python e testes dos scripts preexistentes.

**Validações não cobertas por CI:** navegação real do painel autenticado via PAT, CORS de download em dispositivos específicos, anúncio real da conta, UI em todas as ROMs, publicação do Play e reprodutibilidade de builds futuros com `@main`.

## Links de referência

- [Contrato AdMob](ADMOB-CONFIGURACAO.md)
- [Manual do dashboard](../dashboard/README.md)
- [Assinatura e Play](ASSINATURA-E-PLAY-STORE.md)
- [API oficial de artifacts do GitHub](https://docs.github.com/en/rest/actions/artifacts)
- [DecompressionStream](https://developer.mozilla.org/en-US/docs/Web/API/DecompressionStream/DecompressionStream)
