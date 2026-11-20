# Matriz de compatibilidade e validação — Android Master Boilerplate

| Ambiente | Implementação | Teste físico |
|---|---|---|
| Android API 23–36 | minSdk 23, target/compile SDK 36, APIs oficiais com verificações de versão | Pendente matriz física |
| Android 13 / Xiaomi Redmi 10C | WebView de sistema, janela responsiva, sem serviços em segundo plano | Pendente instalação manual |
| MIUI / HyperOS | Sem uso de serviços de inicialização automática; tratamento de erros e foco em Activity | Pendente aparelho Xiaomi |
| One UI, Samsung | Views e insets AndroidX; sem APIs específicas da Samsung | Pendente aparelho Samsung |
| ColorOS, Realme UI, Funtouch/OriginOS, OxygenOS | Apenas APIs Android; nenhum comportamento proprietário presumido | Pendente aparelhos |
| EMUI, MagicOS, Harmony variantes | Dependência de Android System WebView disponível e atualizado; sem exigir Play Services na base | Pendente aparelhos |
| AOSP / aparelhos sem Google Play | Funcionalidade base sem Google Play Services; o WebView deve estar instalado | Pendente testes |
| Tablet e rotação | Layouts flexíveis e barras de sistema via WindowInsetsCompat | Pendente emulador/tablet |
| Navegação por gestos e botões | OnBackPressedDispatcher, edge-to-edge e WindowInsetsCompat | Pendente teste manual |
| Conexão ruim/perda de sinal | Tratamento de erro do WebView, tentativa de nova carga, retorno ao último URL | Pendente cenário real |
| Upload de mídia | WebChromeClient + seletor de documentos Android | Pendente teste câmera/galeria |
| Download | DownloadManager, domínio restrito e notificações do sistema | Pendente tipos MIME e versões |
| AAB Android 16 | targetSdk 36 + versionCode + assinatura de upload antes de Play Console | Verificado em CI quando job aprovar |

**Cobertura de fabricantes não equivale a teste físico.** O sistema não contém hacks específicos por ROM: o objetivo é minimizar divergências com APIs oficiais. O uso de WebView depende da implementação atualizada instalada em cada aparelho.

## Plano de testes físicos

1. Instalar APK debug em um dispositivo Android 13 Redmi 10C e realizar login real em site autorizado.
2. Confirmar botões físicos/gestuais de voltar e rotação, teclado, áudio/vídeo, orientação e links externos.
3. Reabrir app após fechamento forçado e confirmar cookie de sessão, último URL e aba.
4. Testar perda de rede, timeout HTTPS, upload pela galeria, download e compartilhamento.
5. Testar modo escuro e contraste; testar com TalkBack e fontes ampliadas.
6. Executar pelo menos uma rodada em Samsung One UI e em versão Android 15/16.
7. Fazer Play Console internal testing do bundle assinado com chave real própria do aplicativo.
