package br.com.androidmaster.engine

import android.content.Context
import android.net.Uri
import org.json.JSONObject
import java.util.Locale

data class AppTab(val id: String, val title: String, val url: String)

data class AppNavigation(
    val topBar: Boolean,
    val bottomBar: Boolean,
    val drawer: Boolean,
    val tabs: List<AppTab>
)

data class AppFeatures(
    val downloads: Boolean,
    val favorites: Boolean,
    val sharing: Boolean,
    val fileUpload: Boolean,
    val notifications: Boolean,
    val ads: Boolean,
    val billing: Boolean
)

data class AppSecurity(
    val allowJavaScript: Boolean,
    val allowThirdPartyCookies: Boolean,
    val allowExternalLinks: Boolean
)

data class AppConfig(
    val appId: String,
    val displayName: String,
    val startUrl: String,
    val allowedHosts: Set<String>,
    val primaryColor: String,
    val themeMode: String,
    val navigation: AppNavigation,
    val features: AppFeatures,
    val security: AppSecurity
) {
    fun isAllowedUrl(rawUrl: String): Boolean {
        val parsed = try { Uri.parse(rawUrl) } catch (_: Exception) { return false }
        val host = parsed.host?.lowercase(Locale.US) ?: return false
        return parsed.scheme.equals("https", ignoreCase = true) &&
            parsed.userInfo == null &&
            allowedHosts.contains(host)
    }

    companion object {
        fun load(context: Context): AppConfig {
            val contents = context.assets.open("app-config.json").bufferedReader().use { it.readText() }
            val json = JSONObject(contents)
            require(json.getInt("schemaVersion") == 1) { "Versão de configuração desconhecida" }
            val hosts = json.getJSONArray("allowedHosts")
            val allowedHosts = (0 until hosts.length()).map {
                hosts.getString(it).lowercase(Locale.US)
            }.toSet()
            require(allowedHosts.isNotEmpty()) { "Lista de domínios vazia" }
            val theme = json.getJSONObject("theme")
            val navigation = json.getJSONObject("navigation")
            val features = json.getJSONObject("features")
            val security = json.getJSONObject("security")
            val tabsJson = navigation.getJSONArray("tabs")
            val tabs = (0 until tabsJson.length()).map {
                val tab = tabsJson.getJSONObject(it)
                AppTab(tab.getString("id"), tab.getString("title"), tab.getString("url"))
            }
            require(tabs.isNotEmpty() && tabs.size <= 12) { "Quantidade de abas inválida" }
            val config = AppConfig(
                appId = json.getString("appId"),
                displayName = json.getString("displayName"),
                startUrl = json.getString("startUrl"),
                allowedHosts = allowedHosts,
                primaryColor = theme.getString("primaryColor"),
                themeMode = theme.getString("mode"),
                navigation = AppNavigation(
                    navigation.getBoolean("topBar"),
                    navigation.getBoolean("bottomBar"),
                    navigation.getBoolean("drawer"),
                    tabs
                ),
                features = AppFeatures(
                    features.getBoolean("downloads"),
                    features.getBoolean("favorites"),
                    features.getBoolean("sharing"),
                    features.getBoolean("fileUpload"),
                    features.getBoolean("notifications"),
                    features.getBoolean("ads"),
                    features.getBoolean("billing")
                ),
                security = AppSecurity(
                    security.getBoolean("allowJavaScript"),
                    security.getBoolean("allowThirdPartyCookies"),
                    security.getBoolean("allowExternalLinks")
                )
            )
            require(config.themeMode in listOf("system", "dark", "light")) { "Modo de tema inválido" }
            require(Regex("^#[0-9a-fA-F]{6}$").matches(config.primaryColor)) { "Cor de tema inválida" }
            require(config.isAllowedUrl(config.startUrl)) { "URL inicial não permitida" }
            require(tabs.all { config.isAllowedUrl(it.url) }) { "URL de aba não permitida" }
            // Integrações de anúncios, compras e push dependem de provedores e não são ativadas no MVP.
            require(!config.features.ads && !config.features.billing && !config.features.notifications) {
                "Módulos remotos precisam ser implementados e configurados antes de habilitar"
            }
            return config
        }
    }
}
