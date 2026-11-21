# 05 — AdMob: configuração centralizada, módulo nativo e operação segura

> **Estado mais recente (21/11/2026):** Universal Build #5/#7 **mescladas e GitHub Pages implantado** (run [44926916377](https://github.com/sistemacodigolucrativo/Universal-Build/actions/runs/44926916377)). QR Studio MVP #6 e AdMob #7 **mescladas à main**, com gates Android aprovados na branch de integração. Kotlin Master AdMob #12: **aguardando gate final para merge**. PR 8 no QR Studio é somente experimento de banner de teste, não publicada em main. Valores e deploys devem ser verificados novamente em cada retomada.


> **Atualização operacional em 21/11/2026:** as PRs [Universal Build #5](https://github.com/sistemacodigolucrativo/Universal-Build/pull/5) e [#7](https://github.com/sistemacodigolucrativo/Universal-Build/pull/7) foram **mescladas à `main`**. A interface de AdMob permite escolher a branch para gravar configurações e despachar builds; também oferece toasts, progresso de etapas e downloads. Conferir [manual novo](../CONSOLE-UX-ADMOB-PROGRESSO.md) e o último run do GitHub Pages antes de afirmar que está publicado. As integrações Android no Kotlin Master e QR Studio continuam sujeitas a PRs e seus testes.

**Retrato verificado em 21/11/2026.** A interface AdMob do Universal Build e a integração Android estão em **PRs separadas**, ainda não em `main`. Revalidar estado no GitHub antes de executar ou anunciar a função ao usuário.

## O que pertence a cada repositório

| Local | Função | Evidência atual |
|---|---|---|
| Universal Build | UI, validação e persistência dos IDs e formatos por app, no GitHub do projeto selecionado | [PR 5](https://github.com/sistemacodigolucrativo/Universal-Build/pull/5), branch `feat/admob-settings-console` |
| Kotlin Master | Módulo nativo reutilizável `:core:ads` (SDK Google Mobile Ads Next-Gen, UMP, banner, APIs de intersticial e recompensado), configuração Gradle | [PR 12](https://github.com/sistemacodigolucrativo/Kotlin-Master-Boilerplate/pull/12), branch `feature/universal-admob-native` |
| QR Studio | Adaptação do módulo genérico ao app derivado | [PR 7](https://github.com/sistemacodigolucrativo/QR-Studio/pull/7), branch `feature/universal-admob-native` |
| QR Studio experimental | Banner demonstrativo habilitado em `mode=test` | [PR 8](https://github.com/sistemacodigolucrativo/QR-Studio/pull/8), branch `experiment/admob-test-banner` |

**Não fazer merge automático de PRs por estarem abertas.** A PR de experimento tem base `feature/universal-admob-native`, não `main`. O app funcional está em [PR 6](https://github.com/sistemacodigolucrativo/QR-Studio/pull/6), também não necessariamente presente na `main`.

## Contrato de configuração

O console escreve `config/universal-build-admob.json` **no repositório do app selecionado**. Exemplo seguro (sem IDs reais):

```json
{
  "version": 1,
  "mode": "off",
  "appId": "",
  "units": {"banner": "", "interstitial": "", "rewarded": ""},
  "enabled": {"banner": false, "interstitial": false, "rewarded": false},
  "interstitialCooldownSeconds": 120
}
```

Validação de formato: App ID `ca-app-pub-<16 dígitos>~<10 dígitos>`; unidades `ca-app-pub-<16 dígitos>/<10 dígitos>`. Os IDs não autenticam a conta e não são secrets, mas **não cole IDs de terceiros indiscriminadamente em documentação pública**. Não inclua tokens/segredos.

## Regras do código Android em análise

- Sem arquivo ou com `mode=off`: `ADS_MODE=off`; nenhum anúncio solicitado.
- Em `dev/staging`, se configurado para teste/produção, a lógica Gradle da PR utiliza **IDs de demonstração do Google** e modo `test`. Isso permite manter IDs reais *cadastrados* sem usá-los para impressões no APK de desenvolvimento.
- Em `prod`, somente `mode=live` + App ID e IDs reais válidos permitem solicitar anúncios. `mode=test` vira `off` em produção.
- Banner: `AdMobFooter()` foi preparado para ocupar o rodapé Compose após inicialização/consentimento, sem sobrepor o conteúdo.
- Intersticial: `showInterstitialAtNaturalBreak(activity)` tem cooldown; requer **transição natural** da experiência, não deve ser disparado ao iniciar o app, criar QR ou tocar arbitrariamente.
- Recompensado: `showRewardedAfterOptIn(activity,...)` exige consentimento e ação explícita. O callback de recompensa **não equivale a crédito seguro de moedas**. Para moedas/saldo persistente, usar backend com Server-Side Verification, idempotência e ledger antes de implementar recompensa monetária.
- Google UMP atualiza consentimento antes de inicializar/requisitar anúncios; opções de privacidade quando exigidas. Falha da solicitação de consentimento impede ads no fluxo documentado.

## Sequência correta de implantação

1. Conferir PRs e CI; revisar o contrato e a compatibilidade de versões do SDK/UMP com docs oficiais atuais.
2. Após autorização e merge das alterações genéricas, publicar o console via GitHub Pages e **confirmar a UI nova no navegador**.
3. Incorporar o módulo ao aplicativo correto (em app já derivado, não acontece automaticamente).
4. Pelo painel, configurar `mode=test`, IDs conforme aplicação, habilitar somente formatos com layout/ponto de exibição realmente implementados.
5. Recompilar **APK devDebug**, instalar e validar consentimento, carregamento, orientação, offline, acessibilidade e ausência de erro/crash em dispositivo.
6. Para produção, revisar conta/admissibilidade do app, Play Data Safety, política de privacidade, UMP, app-ads.txt quando aplicável, IDs e políticas Google; só então `mode=live` e AAB de release assinado.
7. Documentar evidência do run, resultado observado no aparelho e eventuais restrições. Nunca inferir receita a partir de compilação aprovada.

## Limites importantes

- O painel salva **configuração em Git**; **não altera apps já instalados em tempo real**. App ID exige rebuild e publicação de nova versão. Controle remoto exigiria backend/ferramenta própria, **não implementada**.
- No QR Studio, APIs de intersticial e recompensado não significam exibição automática: a tela de geração não contém gatilhos apropriados de tela cheia, nem sistema de moedas validado.
- O teste visual anterior relatado pelo usuário e o status de novos runs são fontes distintas. Confirmar qual APK/commit foi instalado antes de atribuir um resultado ao código atual.
- O `README.md` em `main` do Kotlin Master afirma corretamente que **a base mínima não contém AdMob**. Não mudar essa afirmação para "em produção" enquanto a PR estiver aberta.

### Fontes

- [Manual de configuração AdMob na PR 5](https://github.com/sistemacodigolucrativo/Universal-Build/blob/feat/admob-settings-console/docs/ADMOB-CONFIGURACAO.md)
- [Manual de implementação Android na PR 12](https://github.com/sistemacodigolucrativo/Kotlin-Master-Boilerplate/blob/feature/universal-admob-native/docs/ADMOB-NATIVO.md)
- [Google Mobile Ads Next-Gen](https://developers.google.com/admob/android/next-gen/quick-start), [test ads](https://developers.google.com/admob/android/next-gen/test-ads), [privacy/UMP](https://developers.google.com/admob/android/next-gen/privacy)
