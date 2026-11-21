# Configurações de AdMob por projeto no Universal Build

## Onde editar

No console Universal Build, conecte o GitHub, selecione um repositório Android e abra **3 · Configurações · Monetização AdMob**. O formulário lê e grava `config/universal-build-admob.json` **no repositório Android e na branch selecionados**. A gravação cria um commit nessa branch, com confirmação explícita do operador. A instalação dos workflows, diferentemente, atua na branch padrão e requer confirmação.

O console é uma aplicação web estática: **não possui backend de monetização, nem instala SDK Android por alterar esse JSON**. O módulo nativo `:core:ads` e a configuração Gradle foram implementados em projetos Android: as PRs 7 do QR Studio e 12 do Kotlin Master foram mescladas à `main` em 21/11/2026, após os respectivos gates de CI. Não se deve presumir que todos os aplicativos derivados receberam essas alterações automaticamente. **Sem integração Android no app/branch compilada, salvar JSON é apenas configuração persistida e versionada.**

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

## Contrato de integração Android e verificação por branch

1. O projeto Android deve interpretar e validar `config/universal-build-admob.json` **antes de compilar**; no código das PRs 12/7, `dev/staging` usam IDs demonstrativos, enquanto `prod` em `mode=test` permanece desligado. A verificação do console não substitui essa proteção do Gradle.
2. Para GMA Next-Gen SDK, o App ID precisa ser informado na inicialização; o Google UMP também exige App ID no `AndroidManifest.xml`. Modificar o App ID não atualiza automaticamente um APK já instalado.
3. Instanciar os formatos apenas quando houver SDK, consentimento e pontos de exibição explícitos. Evitar intersticiais em interações inesperadas. Aplicar o intervalo mínimo configurado.
4. Para vídeos recompensados, conceder moedas somente após o callback de recompensa validado; em sistema com saldo persistente, aplicar controles antifraude, idempotência e ledger no backend. **Este painel não concede recompensas**.
5. Atualizações das unidades de anúncios num app **já instalado** somente serão possíveis sem nova versão se houver um backend de configuração remota implementado e compatível; este painel salva exclusivamente no GitHub.

O modo `off` deve continuar funcional mesmo sem dependências SDK de anúncios no aplicativo. Para apps com SDK efetivamente habilitado, atualizar consentimento de usuário, política de privacidade, Play Data Safety e políticas de anúncios antes da publicação.

## Verificação

CI executa `node --test tests/admob-settings.test.cjs` (modo seguro, validação dos IDs, IDs de teste, controle de cooldown e presença dos campos do console). O fluxo completo no Android, aprovação de consentimento UMP e veiculação de anúncios **não são cobertos pelos testes desta etapa**.

Referências: [GMA Next-Gen](https://developers.google.com/admob/android/next-gen/quick-start), [anúncios de teste](https://developers.google.com/admob/android/next-gen/test-ads), [UMP](https://developers.google.com/admob/android/next-gen/privacy).


## Implementações e operação da interface

- [Painel — PR 5](https://github.com/sistemacodigolucrativo/Universal-Build/pull/5); [módulo Kotlin — PR 12](https://github.com/sistemacodigolucrativo/Kotlin-Master-Boilerplate/pull/12); [QR Studio — PR 7](https://github.com/sistemacodigolucrativo/QR-Studio/pull/7).
- [Novo console e sequência de uso](CONSOLE-UX-ADMOB-PROGRESSO.md). A seleção de branch no painel permite testar a PR do aplicativo sem gravar o JSON em sua `main`.
- Alterar IDs não atualiza aplicativos instalados; recompilar na branch que recebeu o JSON. Não publicar com dados de teste como se fossem anúncios monetizados.
