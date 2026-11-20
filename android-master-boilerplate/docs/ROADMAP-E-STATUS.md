# Execução e critérios de aceite — 20/11/2026

| Fase | Estado | Evidência |
|---|---|---|
| 01 Auditoria | Parcial | O arquivo recebido é um plano; projeto web/código original não foi fornecido |
| 02 Fundação | Implementado em branch de preparação | Kotlin + Gradle, template, JSON, gerador, testes |
| 03 Motor Android | Em validação | WebView HTTPS, navegação, favoritos, DataStore, downloads, uploads, compartilhamento |
| 04 Compatibilidade | Planejado/teste manual pendente | API 23+, SDK36, insets, navegação de volta, tratamento de rede |
| 05 Automação | Implementado, CI executando | GitHub Actions: testes, 2 APK, AAB unsigned e assinatura em fase separada |
| 06 Primeiro aplicativo | Implementado como demo | Portal Demo em https://example.org com configuração própria |
| 07 Validação | Em andamento | Python/Gradle, logs dos builds; testes físicos pendentes |
| 08 Entrega em repo independente | **Bloqueada** | A conexão GitHub atual não possui comando de criação de repositório novo |

## Funcionalidades presentes

- Configuração por app, identidade, domínio HTTPS, pacote, versão e tema de cores.
- Menu superior, abas, menu inferior e menu de ações.
- Histórico de navegação do WebView e reabertura da última URL.
- Cookies de sessão e favoritos persistidos por DataStore.
- Seletor nativo de arquivos, download por DownloadManager e compartilhamento.
- Erros de carregamento, bloqueio SSL, bloqueio de links não permitidos e verificação de conexão.
- API de retorno AndroidX, tratamento de insets e interface sem permissões excessivas.

## Não implementado / pendências verificáveis

1. Habilitação de notificações push via FCM (depende de Firebase e credenciais do aplicativo).
2. Anúncios recompensados, consentimento, AdMob e confirmação de recompensas no backend.
3. Google Play Billing e serviços pagos.
4. Personalização avançada dos layouts e prévias visuais no painel.
5. Múltiplas páginas WebView isoladas por aba, suporte offline real e autenticação de sessão no backend.
6. Testes físicos em Xiaomi, Samsung e outras ROMs; o projeto usa APIs padrão, mas não há garantia de compatibilidade absoluta.
7. Aplicativo específico do usuário: falta receber o código do projeto web ou a URL definitiva.
8. Criação do repositório dedicado `Android-Master-Boilerplate`: exige ação de criação na conta GitHub. O código permanece em uma branch isolada de preparação até o novo repositório existir.

**Não classificar builds como aprovados enquanto os jobs do GitHub Actions não terminarem com sucesso.**
