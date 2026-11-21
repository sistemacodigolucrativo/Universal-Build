# Configurações de AdMob por projeto no Universal Build

## Onde editar

No console Universal Build, conecte o GitHub, selecione um repositório Android e abra **3 · Configurações · Monetização AdMob**. O formulário lê e grava `config/universal-build-admob.json` **no repositório Android selecionado**. A gravação cria um commit na branch padrão do projeto, com confirmação explícita do operador.

O console é uma aplicação web estática: **não possui backend de monetização, nem instala SDK Android por alterar esse JSON**. O Kotlin Master (e cada aplicativo já derivado) precisa de um adaptador próprio para consumir o contrato durante a compilação, alimentar a configuração de SDK e expor os espaços publicitários adequados. Até essa integração, salvar o arquivo é apenas configuração persistida e versionada.

## Formato do arquivo

```json
{
  "version": 1,
  "mode": "off",
  "appId": "",
  "units": {
    "banner": "",
    "interstitial": "",
    "rewarded": ""
  },
  "enabled": {
    "banner": false,
    "interstitial": false,
    "rewarded": false
  },
  "interstitialCooldownSeconds": 120
}
```

- **off**: padrão seguro, não devem ocorrer solicitações de anúncios.
- **test**: integração Android deve utilizar apenas o App ID de teste do Google (`ca-app-pub-3940256099942544~3347511713`) e as unidades oficiais de teste; IDs próprios cadastrados permanecem persistidos, mas não devem ser empregados em requisições de anúncios nesse modo.
- **live**: exige um App ID válido, diferente do ID de demonstração, pelo menos um formato habilitado e unidade real para cada formato ativo. O painel bloqueia IDs demonstrativos nos formatos habilitados.

Os códigos de aplicação e de unidade de anúncio são identificadores públicos do AdMob, não segredos de autenticação. Não coloque tokens, senhas de conta, chaves de assinatura nem credenciais no arquivo.

## Etapa de integração Android pendente

1. O projeto Android deve interpretar e validar `config/universal-build-admob.json` **antes de compilar**; o build de produção deve falhar em caso de modo `test` que acidentalmente produza anúncios demonstrativos. A verificação do console não é um substituto para essa barreira.
2. Para GMA Next-Gen SDK, o App ID precisa ser informado na inicialização; o Google UMP também exige App ID no `AndroidManifest.xml`. Modificar o App ID não atualiza automaticamente um APK já instalado.
3. Instanciar os formatos apenas quando houver SDK, consentimento e pontos de exibição explícitos. Evitar intersticiais em interações inesperadas. Aplicar o intervalo mínimo configurado.
4. Para vídeos recompensados, conceder moedas somente após o callback de recompensa validado; em sistema com saldo persistente, aplicar controles antifraude, idempotência e ledger no backend. **Este painel não concede recompensas**.
5. Atualizações das unidades de anúncios num app **já instalado** somente serão possíveis sem nova versão se houver um backend de configuração remota implementado e compatível; este painel salva exclusivamente no GitHub.

O modo `off` deve continuar funcional mesmo sem dependências SDK de anúncios no aplicativo. Para apps com SDK efetivamente habilitado, atualizar consentimento de usuário, política de privacidade, Play Data Safety e políticas de anúncios antes da publicação.

## Verificação

CI executa `node --test tests/admob-settings.test.cjs` (modo seguro, validação dos IDs, IDs de teste, controle de cooldown e presença dos campos do console). O fluxo completo no Android, aprovação de consentimento UMP e veiculação de anúncios **não são cobertos pelos testes desta etapa**.

Referências: [GMA Next-Gen](https://developers.google.com/admob/android/next-gen/quick-start), [anúncios de teste](https://developers.google.com/admob/android/next-gen/test-ads), [UMP](https://developers.google.com/admob/android/next-gen/privacy).
