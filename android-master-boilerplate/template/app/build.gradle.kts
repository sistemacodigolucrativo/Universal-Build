plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

android {
    namespace = "br.com.androidmaster.engine"
    compileSdk = 36

    defaultConfig {
        applicationId = providers.gradleProperty("appId").get()
        minSdk = 23
        targetSdk = 36
        versionCode = providers.gradleProperty("appVersionCode").get().toInt()
        versionName = providers.gradleProperty("appVersionName").get()
    }

    signingConfigs {
        create("uploadKey") {
            val location = System.getenv("UNIVERSAL_STORE_FILE")
            if (!location.isNullOrBlank()) {
                storeFile = file(location)
                storePassword = System.getenv("UNIVERSAL_STORE_PASSWORD")
                keyAlias = System.getenv("UNIVERSAL_KEY_ALIAS")
                keyPassword = System.getenv("UNIVERSAL_KEY_PASSWORD")
            }
        }
    }
    buildTypes {
        getByName("release") {
            isMinifyEnabled = false
            if (!System.getenv("UNIVERSAL_STORE_FILE").isNullOrBlank()) {
                signingConfig = signingConfigs.getByName("uploadKey")
            }
        }
    }
    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
    buildFeatures {
        viewBinding = false
    }
    lint {
        abortOnError = true
        checkReleaseBuilds = true
    }
}

dependencies {
    implementation("androidx.activity:activity-ktx:1.11.0")
    implementation("androidx.core:core-ktx:1.17.0")
    implementation("androidx.datastore:datastore-preferences:1.1.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.10.2")
}
