package br.com.androidmaster.engine

import android.content.Context
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.core.stringSetPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import kotlinx.coroutines.flow.first

private val Context.appDataStore by preferencesDataStore("android_master_preferences")

class SessionStore(private val context: Context) {
    companion object {
        private val LAST_URL = stringPreferencesKey("last_url")
        private val LAST_TAB = stringPreferencesKey("last_tab")
        private val FAVORITES = stringSetPreferencesKey("favorites")
    }

    suspend fun getLastUrl(): String? = context.appDataStore.data.first()[LAST_URL]
    suspend fun getLastTab(): String? = context.appDataStore.data.first()[LAST_TAB]

    suspend fun saveNavigation(url: String, tabId: String) {
        context.appDataStore.edit {
            it[LAST_URL] = url
            it[LAST_TAB] = tabId
        }
    }

    suspend fun addFavorite(url: String) {
        context.appDataStore.edit {
            val current = it[FAVORITES].orEmpty()
            it[FAVORITES] = (current + url).take(40).toSet()
        }
    }

    suspend fun getFavorites(): List<String> =
        context.appDataStore.data.first()[FAVORITES].orEmpty().sorted()

    suspend fun clearLocalHistory() {
        context.appDataStore.edit {
            it.remove(LAST_URL)
            it.remove(LAST_TAB)
            it.remove(FAVORITES)
        }
    }
}
