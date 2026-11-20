package br.com.androidmaster.engine

import android.app.DownloadManager
import android.content.Context
import android.content.res.Configuration
import android.content.Intent
import android.graphics.Color
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import android.net.Uri
import android.os.Bundle
import android.view.Gravity
import android.view.View
import android.view.ViewGroup
import android.webkit.CookieManager
import android.webkit.URLUtil
import android.webkit.ValueCallback
import android.webkit.WebChromeClient
import android.webkit.WebView
import android.widget.FrameLayout
import android.widget.HorizontalScrollView
import android.widget.LinearLayout
import android.widget.PopupMenu
import android.widget.ProgressBar
import android.widget.TextView
import android.widget.Toast
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.lifecycleScope
import kotlinx.coroutines.launch

/** Activity nativa genérica alimentada por uma configuração por aplicativo. */
class MainActivity : ComponentActivity() {
    private lateinit var config: AppConfig
    private lateinit var session: SessionStore
    private lateinit var browser: WebView
    private lateinit var indicator: ProgressBar
    private lateinit var errorPanel: TextView
    private lateinit var tabRow: LinearLayout
    private lateinit var bottomRow: LinearLayout
    private var activeTabId = ""
    private var chooserCallback: ValueCallback<Array<Uri>>? = null
    private val accent by lazy { Color.parseColor(config.primaryColor) }
    private val darkUi by lazy {
        when (config.themeMode) {
            "dark" -> true
            "light" -> false
            else -> resources.configuration.uiMode and Configuration.UI_MODE_NIGHT_MASK ==
                Configuration.UI_MODE_NIGHT_YES
        }
    }
    private val surface by lazy { if (darkUi) Color.rgb(15, 22, 33) else Color.WHITE }
    private val bodyText by lazy { if (darkUi) Color.LTGRAY else Color.DKGRAY }

    private val filePicker = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { result ->
        val uris = WebChromeClient.FileChooserParams.parseResult(result.resultCode, result.data)
        chooserCallback?.onReceiveValue(uris)
        chooserCallback = null
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        config = try { AppConfig.load(this) } catch (e: Exception) {
            setContentView(TextView(this).apply {
                text = "Configuração inválida: ${e.message}"
                setPadding(dp(24), dp(36), dp(24), dp(36))
            })
            return
        }
        session = SessionStore(applicationContext)
        enableEdgeToEdge()
        val root = LinearLayout(this).apply {
            orientation = LinearLayout.VERTICAL
            setBackgroundColor(surface)
        }
        ViewCompat.setOnApplyWindowInsetsListener(root) { view, insets ->
            val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars())
            view.setPadding(bars.left, bars.top, bars.right, bars.bottom)
            insets
        }
        if (config.navigation.topBar) root.addView(createTopBar())
        if (config.navigation.tabs.size > 1) {
            val scroller = HorizontalScrollView(this).apply {
                isHorizontalScrollBarEnabled = false
                addView(LinearLayout(this@MainActivity).also { tabRow = it })
            }
            root.addView(scroller, LinearLayout.LayoutParams(-1, dp(48)))
        } else tabRow = LinearLayout(this)

        val viewport = FrameLayout(this)
        browser = WebView(this)
        SecureBrowser(
            context = this, config = config,
            onLoading = { indicator.visibility = if (it) View.VISIBLE else View.GONE },
            onNavigated = { url ->
                errorPanel.visibility = View.GONE
                lifecycleScope.launch { session.saveNavigation(url, activeTabId) }
            },
            onFailure = {
                errorPanel.text = "$it\nToque aqui para tentar novamente."
                errorPanel.visibility = View.VISIBLE
            }
        ).configure(browser)
        browser.webChromeClient = object : WebChromeClient() {
            override fun onProgressChanged(view: WebView, progress: Int) {
                indicator.progress = progress
            }
            override fun onShowFileChooser(
                webView: WebView,
                filePathCallback: ValueCallback<Array<Uri>>,
                fileChooserParams: FileChooserParams
            ): Boolean {
                if (!config.features.fileUpload) return false
                chooserCallback?.onReceiveValue(null)
                chooserCallback = filePathCallback
                return try {
                    filePicker.launch(fileChooserParams.createIntent())
                    true
                } catch (_: Exception) {
                    chooserCallback?.onReceiveValue(null)
                    chooserCallback = null
                    false
                }
            }
        }
        browser.setDownloadListener { url, agent, disposition, mime, _ ->
            handleDownload(url, agent, disposition, mime)
        }
        viewport.addView(browser, FrameLayout.LayoutParams(-1, -1))
        indicator = ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal).apply {
            max = 100
            visibility = View.GONE
            progressTintList = android.content.res.ColorStateList.valueOf(accent)
        }
        viewport.addView(indicator, FrameLayout.LayoutParams(-1, dp(3), Gravity.TOP))
        errorPanel = TextView(this).apply {
            gravity = Gravity.CENTER
            textSize = 16f
            setTextColor(bodyText)
            setBackgroundColor(Color.WHITE)
            setPadding(dp(24), dp(24), dp(24), dp(24))
            visibility = View.GONE
            setOnClickListener {
                visibility = View.GONE
                if (isOnline()) browser.reload() else toast("Sem acesso à internet.")
            }
        }
        viewport.addView(errorPanel, FrameLayout.LayoutParams(-1, -1))
        root.addView(viewport, LinearLayout.LayoutParams(-1, 0, 1f))
        bottomRow = LinearLayout(this).apply {
            gravity = Gravity.CENTER
            setBackgroundColor(if (darkUi) Color.rgb(24, 32, 44) else Color.rgb(245, 247, 250))
        }
        if (config.navigation.bottomBar) root.addView(bottomRow, LinearLayout.LayoutParams(-1, dp(54)))
        setContentView(root)
        WindowInsetsControllerCompat(window, root).apply {
            isAppearanceLightStatusBars = !darkUi
            isAppearanceLightNavigationBars = !darkUi
        }
        renderNavigation()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                if (browser.canGoBack()) browser.goBack()
                else {
                    isEnabled = false
                    onBackPressedDispatcher.onBackPressed()
                }
            }
        })
        val restored = savedInstanceState?.let { browser.restoreState(it) } != null
        lifecycleScope.launch {
            activeTabId = session.getLastTab()
                ?.takeIf { id -> config.navigation.tabs.any { it.id == id } }
                ?: config.navigation.tabs.first().id
            renderNavigation()
            if (!restored) {
                val savedUrl = session.getLastUrl()
                load(savedUrl?.takeIf { config.isAllowedUrl(it) } ?: config.startUrl)
            }
        }
    }

    private fun createTopBar(): View {
        val bar = LinearLayout(this).apply {
            orientation = LinearLayout.HORIZONTAL
            gravity = Gravity.CENTER_VERTICAL
            setBackgroundColor(accent)
        }
        if (config.navigation.drawer) bar.addView(button("☰", bar = true) { showMenu(it) })
        bar.addView(TextView(this).apply {
            text = config.displayName
            textSize = 17f
            setTextColor(Color.WHITE)
            gravity = Gravity.CENTER_VERTICAL
            setPadding(dp(12), 0, dp(8), 0)
        }, LinearLayout.LayoutParams(0, dp(52), 1f))
        bar.addView(button("⟳", bar = true) { browser.reload() })
        if (config.features.sharing) bar.addView(button("↗", bar = true) { shareCurrent() })
        return bar
    }

    private fun renderNavigation() {
        tabRow.removeAllViews()
        bottomRow.removeAllViews()
        for (tab in config.navigation.tabs) {
            val selected = tab.id == activeTabId
            tabRow.addView(button(tab.title, selected = selected) { openTab(tab) },
                LinearLayout.LayoutParams(dp(124), dp(48)))
            if (config.navigation.bottomBar) {
                bottomRow.addView(button(tab.title, selected = selected) { openTab(tab) },
                    LinearLayout.LayoutParams(0, dp(54), 1f))
            }
        }
    }

    private fun button(label: String, bar: Boolean = false, selected: Boolean = false,
                       action: (View) -> Unit): TextView = TextView(this).apply {
        text = label
        gravity = Gravity.CENTER
        textSize = if (bar) 23f else 14f
        setTextColor(if (bar) Color.WHITE else if (selected) accent else bodyText)
        if (selected && !bar) setBackgroundColor(if (darkUi) Color.rgb(37, 51, 75) else Color.rgb(231, 238, 250))
        minWidth = dp(48)
        minHeight = dp(48)
        contentDescription = label
        setOnClickListener { action(this) }
    }

    private fun openTab(tab: AppTab) {
        activeTabId = tab.id
        renderNavigation()
        load(tab.url)
    }

    private fun load(url: String) {
        if (config.isAllowedUrl(url)) {
            errorPanel.visibility = View.GONE
            browser.loadUrl(url)
        } else toast("Endereço bloqueado pela configuração.")
    }

    private fun showMenu(anchor: View) {
        val popup = PopupMenu(this, anchor)
        for (item in listOf("Página inicial", "Voltar", "Avançar", "Atualizar")) popup.menu.add(item)
        if (config.features.favorites) {
            popup.menu.add("Salvar favorito")
            popup.menu.add("Abrir favorito")
        }
        if (config.features.sharing) popup.menu.add("Compartilhar")
        popup.menu.add("Limpar dados locais")
        popup.setOnMenuItemClickListener {
            when (it.title.toString()) {
                "Página inicial" -> load(config.startUrl)
                "Voltar" -> if (browser.canGoBack()) browser.goBack()
                "Avançar" -> if (browser.canGoForward()) browser.goForward()
                "Atualizar" -> browser.reload()
                "Salvar favorito" -> {
                    val url = browser.url
                    if (url != null && config.isAllowedUrl(url)) lifecycleScope.launch {
                        session.addFavorite(url)
                        toast("Favorito salvo.")
                    }
                }
                "Abrir favorito" -> lifecycleScope.launch {
                    val urls = session.getFavorites().filter { config.isAllowedUrl(it) }
                    if (urls.isEmpty()) toast("Nenhum favorito salvo.")
                    else android.app.AlertDialog.Builder(this@MainActivity)
                        .setTitle("Favoritos")
                        .setItems(urls.toTypedArray()) { _, index -> load(urls[index]) }
                        .show()
                }
                "Compartilhar" -> shareCurrent()
                "Limpar dados locais" -> clearLocalData()
            }
            true
        }
        popup.show()
    }

    private fun shareCurrent() {
        val current = browser.url ?: config.startUrl
        if (!config.isAllowedUrl(current)) return
        val intent = Intent(Intent.ACTION_SEND).apply {
            type = "text/plain"
            putExtra(Intent.EXTRA_TEXT, current)
        }
        startActivity(Intent.createChooser(intent, "Compartilhar link"))
    }

    private fun handleDownload(url: String, agent: String, disposition: String, mime: String) {
        if (!config.features.downloads || !config.isAllowedUrl(url)) {
            toast("Download desabilitado ou domínio bloqueado.")
            return
        }
        try {
            val request = DownloadManager.Request(Uri.parse(url))
                .setTitle(URLUtil.guessFileName(url, disposition, mime))
                .setMimeType(mime)
                .setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED)
                .addRequestHeader("User-Agent", agent)
            (getSystemService(Context.DOWNLOAD_SERVICE) as DownloadManager).enqueue(request)
            toast("Download iniciado.")
        } catch (_: Exception) { toast("Não foi possível iniciar o download.") }
    }

    private fun clearLocalData() {
        android.app.AlertDialog.Builder(this)
            .setTitle("Limpar dados locais?")
            .setMessage("Apaga favoritos, última página e cookies locais. Não efetua logout no servidor do site.")
            .setNegativeButton("Cancelar", null)
            .setPositiveButton("Limpar") { _, _ ->
                lifecycleScope.launch {
                    session.clearLocalHistory()
                    CookieManager.getInstance().removeAllCookies {
                        CookieManager.getInstance().flush()
                    }
                    browser.clearHistory()
                    browser.clearCache(true)
                    activeTabId = config.navigation.tabs.first().id
                    renderNavigation()
                    load(config.startUrl)
                }
            }.show()
    }

    private fun isOnline(): Boolean {
        val cm = getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
        return cm.getNetworkCapabilities(cm.activeNetwork ?: return false)
            ?.hasCapability(NetworkCapabilities.NET_CAPABILITY_INTERNET) == true
    }

    private fun toast(text: String) = Toast.makeText(this, text, Toast.LENGTH_SHORT).show()
    private fun dp(n: Int) = (n * resources.displayMetrics.density).toInt()

    override fun onSaveInstanceState(outState: Bundle) {
        if (::browser.isInitialized) browser.saveState(outState)
        super.onSaveInstanceState(outState)
    }
    override fun onResume() {
        super.onResume()
        if (::browser.isInitialized && !isOnline()) toast("Sem conexão. Conteúdo em cache pode estar disponível.")
    }
    override fun onPause() {
        if (::browser.isInitialized) CookieManager.getInstance().flush()
        super.onPause()
    }
    override fun onDestroy() {
        chooserCallback?.onReceiveValue(null)
        chooserCallback = null
        if (::browser.isInitialized) {
            (browser.parent as? ViewGroup)?.removeView(browser)
            browser.destroy()
        }
        super.onDestroy()
    }
}
