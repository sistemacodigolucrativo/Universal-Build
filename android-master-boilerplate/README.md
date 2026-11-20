# Android Master Boilerplate 🚀

**Base Android modular em Kotlin, integrada ao Universal Build.** Desenvolvida para uso pelo celular, sem Android Studio local.

## Arquitetura

- `template/`: aplicativo Android nativo reutilizável, com motor de WebView e navegação configurável.
- `apps/*.json`: definições independentes de aplicativos.
- `tools/configuration.py`: validação de configurações, segurança HTTPS e parâmetros.
- `tools/generate_app.py`: gera projeto Android Gradle real a partir de um JSON.
- `tests/`: testes automatizados de geração e validação.
- `docs/`: funcionalidades, compatibilidade, riscos e critérios de aceite.

## Uso pelo celular

1. Edite ou crie um JSON em `apps/`.
2. Pelo GitHub Actions, execute a ação de geração e build; por Termux, use:
   `python3 tools/generate_app.py --config apps/portal-demo.json --output /tmp/android-portal-demo`.
3. Para APK: `gradle :app:assembleDebug` dentro do projeto gerado (na nuvem).
4. Para AAB: use o Universal Build com `aab-unsigned`, depois aplique a assinatura em etapa separada na nuvem.
5. Cada aplicativo derivado usa `applicationId`, nome, versão e identidade próprios.

A cópia inicial tem somente apps demonstrativos HTTPS, sem API privada, anúncios ou Firebase configurados.

## Status real

O código é submetido a CI antes de ser chamado de validado. As funções opcionais que requerem fornecedor externo (push, anúncios, compras) permanecem **não implementadas/sem credenciais**, não são expostas como recursos ativos.

**Importante:** o primeiro app de demonstração usa `example.org` intencionalmente. A URL real deve ser informada para configurar um produto público. Requisitos e política Play Store são independentes do sucesso do build.
