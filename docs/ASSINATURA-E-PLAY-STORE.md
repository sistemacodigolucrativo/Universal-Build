# Publicação na Google Play Store — AAB assinado

## Regra de formato
- Para **novos aplicativos**, o Google Play exige **Android App Bundle (`.aab`)** desde agosto de 2021.
- O **APK debug** serve para instalar e testar diretamente no celular.
- O AAB de release deve ser assinado com uma **chave de upload**. Google Play App Signing gerencia a assinatura de distribuição.
- Em novembro de 2026, apps de smartphones/tablets novos e atualizados devem ter **targetSdk >= 36 (Android 16)**, salvo exceções de plataforma e regras vigentes. **Um AAB compilado não garante aprovação no Google Play**: políticas, permissões, formulários, dependências, versão incremental e testes também importam.

Fontes oficiais:
- https://developer.android.com/guide/app-bundle
- https://developer.android.com/studio/publish/preparing
- https://support.google.com/googleplay/android-developer/answer/11926878?hl=pt-BR

## Assinatura posterior — fluxo recomendado

1. Compilar em modo `aab-unsigned` ou `both-unsigned`. Não há necessidade de disponibilizar a chave de upload durante a compilação.
2. Na interface, localizar o build bem-sucedido, selecionar o artefato `unsigned.aab`.
3. O painel aciona `.github/workflows/universal-sign.yml` no repositório do aplicativo; esse workflow chama o assinador reutilizável do Universal-Build.
4. O assinador baixa o artefato original, aplica `jarsigner` em um job separado e valida assinatura, `targetSdk` e `versionCode`.
5. O resultado `release-signed.aab` pode ser enviado ao Play Console quando os demais requisitos forem atendidos.

O `AAB` unsigned NÃO é aceito pela Play Store. O APK debug já vem assinado com chave de testes (não é o formato para novas publicações).

## Assistente automático de Secrets (novo)

No Universal Build, opção 5, abra **Gerar chave e configurar assinatura automaticamente**. Requer permissão de **Secrets: leitura e escrita** no token e acesso administrativo ao repositório Android selecionado. Cada aplicativo tem sua própria keystore; os nomes dos quatro Secrets são padronizados. **Nunca copie a chave de um aplicativo para outro sem motivo e decisão explícita.**

1. Clique **Preparar chave e senha automaticamente** (apenas para um app que ainda não foi publicado e sem Secrets de assinatura existentes). O navegador usa o gerador criptográfico seguro para produzir uma senha forte de 48 caracteres. **Salve a senha em local seguro** e confirme. Um arquivo opcional de recuperação é salvo em texto claro, não criptografado.
2. Clique **Confirmar e gerar chave criptografada**. O navegador cifra a senha com a **chave pública de Secrets fornecida pela API do próprio GitHub** antes do PUT no repositório do aplicativo e então dispara o workflow de geração. O ZIP do workflow contém `upload-key.jks.ubenc` e certificado público, não o JKS em texto claro.
3. Extraia `upload-key.jks.ubenc` e desbloqueie-o **localmente** com sua senha. Baixe o `.jks` original e mantenha cópias independentes. Não recarregue a página até baixar os arquivos. Se recarregar, reimporte o `.ubenc` e use a senha que salvou.
4. Confirme o backup e clique **Configurar quatro Secrets automaticamente**. O navegador usa **TweetNaCl + BLAKE2b-192** (código local auditável e licenças no repositório) para criptografar no padrão `crypto_box_seal`; chama a API GitHub Actions Secrets com `encrypted_value` e `key_id`. A chave privada não é enviada em texto claro. Primeiro cadastra senha, alias e senha da chave; **por último** o JKS Base64. Confirma apenas os quatro **nomes**, não os valores.
5. Assine o AAB sem assinatura. O botão de assinatura da opção 5 continua habilitado por Run ID/nome válidos; o workflow efetivo depende dos quatro Secrets corretos. Assinar depois não reconstrói o aplicativo.

**App já publicado:** nunca gere outra chave; use seu JKS/keystore original em **Já tenho um arquivo .jks/.keystore usado em outro sistema** e informe alias e senhas originais. Se já há JKS em Secrets, o assistente não o substitui. O sistema não consegue verificar a identidade do certificado original apenas porque um JKS foi selecionado; compare a impressão digital do certificado com a registrada no Play Console.

**Falhas e recuperação:** se o gerador falhar após criar `ANDROID_KEYSTORE_PASSWORD`, confira o histórico Actions antes de executar novamente. O modo manual permite continuar com a senha original. Se a configuração dos quatro Secrets parar no meio, verifique o estado no GitHub; a chave Base64 é gravada por último, e a página pode ser recarregada para reimportar o backup .ubenc e repetir a configuração, sem gerar outra chave. Nunca cole valores de Secrets em código, commits ou mensagens.

## Gerar a primeira chave pelo Universal Build (método manual anterior)

Na PR #10, a seção 5 permite gerar chave sem instalar Termux/Android Studio. Configure no repositório do **aplicativo** o Secret `ANDROID_KEYSTORE_PASSWORD` com senha exclusiva de **20 ou mais caracteres**. Clique em **Gerar chave criptografada no GitHub** e aguarde.

O workflow produz um keystore PKCS#12 com extensão `.jks` (compatível com o JDK de assinatura), alias `upload`, senha da chave igual à senha do keystore e certificado público PEM. A chave é **criptografada antes do upload**. O Artifact contém `upload-key.jks.ubenc`, certificado `upload-certificate.pem` e instruções, nunca a chave privada sem criptografia.

Baixe e extraia o ZIP, importe o `.ubenc` no painel HTTPS, informe a senha (desbloqueio local pelo WebCrypto), baixe o JKS e use **Copiar Base64 para Secret** para preencher `ANDROID_KEYSTORE_BASE64`. Configure `ANDROID_KEY_ALIAS` como `upload` e `ANDROID_KEY_PASSWORD` igual a `ANDROID_KEYSTORE_PASSWORD`.

Para atualizar um app já publicado, reutilize a chave original. O workflow bloqueia nova geração se `ANDROID_KEYSTORE_BASE64` existir; isso não elimina a necessidade de guardar cópia independente. O artifact criptografado expira em 7 dias. Nenhum secret ou chave deve ser compartilhado por chat.

## Como provisionar assinatura com segurança

Em cada repositório do **aplicativo** (não no repositório público Universal-Build):

`Settings → Secrets and variables → Actions → New repository secret`

Crie os quatro secrets:

- `ANDROID_KEYSTORE_BASE64`: conteúdo inteiro do JKS codificado em Base64
- `ANDROID_KEYSTORE_PASSWORD`: senha do JKS
- `ANDROID_KEY_ALIAS`: alias da chave de upload
- `ANDROID_KEY_PASSWORD`: senha da chave

**Não envie estes valores no chat, README, comentários de issue, commits ou repositório público.** Salve o JKS original e as senhas em backup seguro: sem a chave de upload, a manutenção do aplicativo pode ficar mais difícil.

O Universal Build decodifica o JKS em arquivo temporário na máquina efêmera do GitHub Actions. O código do aplicativo precisa **utilizar a configuração de assinatura de release**. O motor exporta:

- `UNIVERSAL_STORE_FILE`: caminho absoluto do JKS temporário
- `UNIVERSAL_STORE_PASSWORD`
- `UNIVERSAL_KEY_ALIAS`
- `UNIVERSAL_KEY_PASSWORD`

Se o aplicativo for Flutter, o motor cria `android/key.properties` temporário com `storeFile`, `storePassword`, `keyAlias`, `keyPassword`. Ainda é necessário que o Gradle do aplicativo use esses valores ao configurar `signingConfigs.release`.

### Exemplo para Kotlin DSL do módulo app

```kotlin
android {
    signingConfigs {
        create("universalRelease") {
            val filePath = System.getenv("UNIVERSAL_STORE_FILE")
            if (!filePath.isNullOrBlank()) {
                storeFile = file(filePath)
                storePassword = System.getenv("UNIVERSAL_STORE_PASSWORD")
                keyAlias = System.getenv("UNIVERSAL_KEY_ALIAS")
                keyPassword = System.getenv("UNIVERSAL_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        getByName("release") {
            signingConfig = signingConfigs.getByName("universalRelease")
        }
    }
}
```

Este trecho deve ser integrado ao código Gradle existente — pode ser necessário **ajustar** uma configuração de assinatura já existente, em vez de criar outra. Para projetos Groovy ou Flutter com propriedades de assinatura, configurar o equivalente. Nunca commitar um `key.properties` contendo senhas.

## Critérios antes de enviar o AAB ao Play Console
1. Build de `aab` ou `both` concluído.
2. JKS de upload presente e `jarsigner` validado.
3. Target SDK do bundle verificado como **API 36 ou superior** (onde aplicável).
4. `applicationId` correto e `versionCode` maior do que o anteriormente publicado.
5. Ícone, nome, recursos, permissões e declaração de coleta de dados revisados.
6. Teste no Redmi 10C (usando APK de teste) e, de preferência, teste interno no Play Console.
7. Arquivo `.aab` publicado manualmente via Play Console nesta primeira versão (publicação automática não está implementada).

## Limitações
Os secrets são repassados ao workflow apenas no projeto de origem autorizado. Não são expostos no navegador nem nos artefatos. Contudo, **todo código compilado no runner tem acesso às variáveis disponibilizadas no job**. Execute builds release somente de código que você confia. Para proteção adicional, separe build de código e etapa de assinatura em jobs isolados.
