# Arquitetura técnica — Android Master Boilerplate

## Separação entre núcleo e aplicativos derivados

- **template/**: único código Kotlin/Gradle do motor Android, sem marca ou site de um cliente. Possui WebView segura, navegação nativa, cookies, sessão persistente DataStore, favoritos, seletor de arquivos, downloads, compartilhamento, controles de erros, rede, temas básicos, status bar/insets, ciclo de vida e feedback.
- **apps/**: configurações versionadas de cada aplicativo. Um app real tem package ID único, versão, cores, URLs HTTPS e módulos habilitados. Nenhuma senha nem token é mantido nesses arquivos.
- **tools/**: validadores e gerador isolados do Android. `generate_app.py` produz uma cópia compilável do template.
- **tests/**: verificações funcionais do contrato JSON, da geração de dois projetos e dos controles de segurança.
- **GitHub Actions**: compilação real em Linux com Android SDK 36, Gradle e Java 17; APK e AAB gerados sem Android Studio local. A assinatura AAB posterior ocorre usando `scripts/sign-aab.sh` do Universal Build.

## Interface configurável

Os flags `topBar`, `bottomBar` e `drawer` controlam a apresentação nativa. A opção `swipeBetweenTabs` está reservada e propositalmente rejeita `true` enquanto não houver tratamento confiável de gestos em páginas com rolagem horizontal. Os itens em `tabs[]` definem abas, seus rótulos e URLs HTTPS permitidas.

`features`: downloads, favorites, sharing e fileUpload já têm caminhos implementados. Notificações push, ads e billing não são módulos operacionais; por segurança o validador rejeita ativá-los até haver SDK, consentimento e integrações reais.

## Sessões

A navegação e os favoritos são persistidos via DataStore. Os cookies de sessão são mantidos pelo mecanismo oficial de cookies do WebView e sincronizados por `CookieManager.flush()`. O logout efetivo depende do backend do site: a opção de limpar dados locais não deve ser descrita como encerramento remoto da sessão.

## Propagação de alterações

O núcleo reutilizável é a fonte `template/`. Novos apps são gerados deste código. Para atualizar um app derivado, **regerá-lo a partir da base e do mesmo JSON**, revisando diferenças de código próprio antes de substituir o app. Não existe sincronização automática para apps modificados manualmente; isso precisará de um futuro sistema de versões de módulos e migrações.

## Limitações atuais

- O produto inclui um primeiro *demo* com domínio `example.org` (substituível); nenhum website privado foi fornecido para integração real.
- Os layouts são nativos com Views e componentes de sistema, não Jetpack Compose. Esta é uma escolha de compatibilidade e simplicidade inicial.
- Não está implementado upload de fotos diretamente da câmera, scanner de documentos, autenticação biométrica, tratamento de PDF embutido ou Firebase.
- O projeto precisa de teste de UX e regressão em aparelhos reais antes de ser chamado de totalmente aprovado.
