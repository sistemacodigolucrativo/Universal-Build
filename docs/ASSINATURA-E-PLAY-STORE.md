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
