package br.com.androidmaster.engine

import android.annotation.SuppressLint
import android.content.ActivityNotFoundException
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.net.http.SslError
import android.os.Build
import android.webkit.CookieManager
import android.webkit.SslErrorHandler
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebSettings
import android.webkit.WebView
import android.webkit.WebViewClient
import android.content.Context

class SecureBrowser(
    private val context: Context,
    private val config: AppConfig,
    private val onLoading: (Boolean) -> Unit,
    private val onNavigated: (String) -> Unit,
    private val onFailure: (String) -> Unit
) : WebViewClient() {

    @SuppressLint("SetJavaScriptEnabled")
    fun configure(webView: WebView) {
        val settings: WebSettings = webView.settings
        settings.javaScriptEnabled = config.security.allowJavaScript
        settings.domStorageEnabled = true
        settings.allowFileAccess = false
        settings.allowContentAccess = config.features.fileUpload
        settings.javaScriptCanOpenWindowsAutomatically = false
        settings.setSupportMultipleWindows(false)
        settings.mixedContentMode = WebSettings.MIXED_CONTENT_NEVER_ALLOW
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            settings.safeBrowsingEnabled = true
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(
            webView, config.security.allowThirdPartyCookies
        )
        webView.webViewClient = this
    }

    override fun shouldOverrideUrlLoading(view: WebView, request: WebResourceRequest): Boolean {
        val uri = request.url
        val raw = uri.toString()
        if (config.isAllowedUrl(raw)) return false
        if (uri.scheme == "tel" || uri.scheme == "mailto") {
            openExternal(uri)
        } else if (uri.scheme.equals("https", ignoreCase = true) &&
                   config.security.allowExternalLinks && request.isForMainFrame) {
            openExternal(uri)
        } else {
            onFailure("Navegação bloqueada: endereço não autorizado.")
        }
        return true
    }

    private fun openExternal(uri: Uri) {
        try {
            context.startActivity(Intent(Intent.ACTION_VIEW, uri))
        } catch (_: ActivityNotFoundException) {
            onFailure("Nenhum aplicativo disponível para abrir esse link.")
        } catch (_: SecurityException) {
            onFailure("O sistema bloqueou a abertura desse link.")
        }
    }

    override fun onPageStarted(view: WebView, url: String?, favicon: Bitmap?) {
        onLoading(true)
    }

    override fun onPageFinished(view: WebView, url: String?) {
        onLoading(false)
        val current = url ?: return
        if (config.isAllowedUrl(current)) onNavigated(current)
        CookieManager.getInstance().flush()
    }

    override fun onReceivedError(view: WebView, request: WebResourceRequest, error: WebResourceError) {
        if (request.isForMainFrame) {
            onLoading(false)
            onFailure("Não foi possível carregar a página. Verifique a conexão e tente novamente.")
        }
    }

    override fun onReceivedSslError(view: WebView, handler: SslErrorHandler, error: SslError) {
        handler.cancel()
        onLoading(false)
        onFailure("Certificado de segurança inválido. A conexão foi interrompida.")
    }
}
