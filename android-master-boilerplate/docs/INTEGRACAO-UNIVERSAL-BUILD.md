# Uso pelo celular / integração ao Universal Build

## Criar e editar o aplicativo

1. Crie ou edite um JSON dentro de `apps/`, usando o contrato de `apps/portal-demo.json`.
2. Defina um `applicationId` definitivo que nunca tenha sido usado na Play Store.
3. Mantenha `versionCode` crescente, URLs HTTPS e hosts declarados.
4. Gere a estrutura compilável com `python3 tools/generate_app.py --config apps/portal-demo.json --output generated/portal-demo`.

No Termux só é necessário Python 3 para gerar o código. A compilação Android ocorre no GitHub Actions.

## No Universal Build

O painel de compilação em https://sistemacodigolucrativo.github.io/Universal-Build/ aceita um repositório com código Gradle ou um ZIP de fonte Android (limite 15 MiB). Use o projeto **gerado** como origem, e não só o arquivo JSON. O painel instala os workflows de build e assinatura no repositório do aplicativo.

- **APK**: instalável para testes.
- **AAB unsigned**: intermediário que será assinado posteriormente.
- **AAB signed**: pacote para upload à Google Play Store, sujeito às políticas atuais.
- **AAB pós-assinatura**: o Universal Build pode assinar o AAB pronto em um job separado com secrets protegidos.

O arquivo `.aab` sem assinatura **não pode ser publicado no Google Play**. A chave de teste efêmera dos workflows de laboratório não serve para releases reais.

## Como usar a base em um novo repositório

Um aplicativo derivado pode ficar em seu próprio repositório, totalmente independente, incluindo uma cópia gerada do código Gradle. A base mestre permanece separada. Para atualizá-lo, compare a versão de base, regenere em uma branch e revise as alterações antes do merge. Não é necessário fazer build Android no aparelho.

## Assinatura real

No repositório do aplicativo, configurar `ANDROID_KEYSTORE_BASE64`, `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS` e `ANDROID_KEY_PASSWORD` somente em **Settings → Secrets and variables → Actions**. Armazene backups da chave JKS e senhas fora do Git. A assinatura acontece depois do build caso escolha modo AAB unsigned.
