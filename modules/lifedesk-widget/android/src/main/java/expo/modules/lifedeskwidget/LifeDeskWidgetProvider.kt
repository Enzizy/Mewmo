package expo.modules.lifedeskwidget

import android.app.PendingIntent
import android.appwidget.AppWidgetManager
import android.appwidget.AppWidgetProvider
import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.net.Uri
import android.view.View
import android.widget.RemoteViews

class LifeDeskWidgetProvider : AppWidgetProvider() {
  override fun onUpdate(context: Context, manager: AppWidgetManager, appWidgetIds: IntArray) {
    appWidgetIds.forEach { manager.updateAppWidget(it, views(context)) }
  }

  companion object {
    fun updateAll(context: Context) {
      val manager = AppWidgetManager.getInstance(context)
      val component = ComponentName(context, LifeDeskWidgetProvider::class.java)
      manager.getAppWidgetIds(component).forEach { manager.updateAppWidget(it, views(context)) }
    }

    private fun views(context: Context): RemoteViews {
      val snapshot = LifeDeskWidgetStore.load(context)
      return RemoteViews(context.packageName, R.layout.lifedesk_widget).apply {
        setTextViewText(R.id.widget_next_title, snapshot.nextTitle.ifBlank { "Open LifeDesk to sync" })
        setTextViewText(R.id.widget_next_meta, snapshot.nextMeta.ifBlank { "Your next reminder will appear here" })
        setTextViewText(R.id.widget_urgent, if (snapshot.urgentCount > 0) "${snapshot.urgentCount} need attention" else "All clear")
        setTextViewText(R.id.widget_weather, snapshot.weather.ifBlank { "Weather not set" })
        setTextViewText(R.id.widget_wallet, if (snapshot.showWallet) snapshot.wallet.ifBlank { "Wallet unavailable" } else "Balance hidden")
        setViewVisibility(R.id.widget_wallet, View.VISIBLE)

        setOnClickPendingIntent(R.id.widget_root, deepLink(context, 0, "/"))
        setOnClickPendingIntent(R.id.action_capture, deepLink(context, 1, "/record"))
        setOnClickPendingIntent(R.id.action_expense, deepLink(context, 2, "/wallet/activity?action=add&type=expense"))
        setOnClickPendingIntent(R.id.action_task, deepLink(context, 3, "/tasks?action=add"))
        setOnClickPendingIntent(R.id.action_reminder, deepLink(context, 4, "/tasks/calendar?action=add"))
      }
    }

    private fun deepLink(context: Context, requestCode: Int, path: String): PendingIntent {
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse("lifedesk://$path")).apply {
        setPackage(context.packageName)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
      }
      return PendingIntent.getActivity(context, requestCode, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
    }
  }
}

data class StoredWidgetSnapshot(
  val nextTitle: String,
  val nextMeta: String,
  val urgentCount: Int,
  val weather: String,
  val wallet: String,
  val showWallet: Boolean,
)

object LifeDeskWidgetStore {
  private const val PREFS = "lifedesk_widget"

  fun save(context: Context, snapshot: WidgetSnapshot) {
    context.getSharedPreferences(PREFS, Context.MODE_PRIVATE).edit()
      .putString("nextTitle", snapshot.nextTitle.take(120))
      .putString("nextMeta", snapshot.nextMeta.take(160))
      .putInt("urgentCount", snapshot.urgentCount.coerceAtLeast(0))
      .putString("weather", snapshot.weather.take(80))
      .putString("wallet", snapshot.wallet.take(80))
      .putBoolean("showWallet", snapshot.showWallet)
      .apply()
  }

  fun load(context: Context): StoredWidgetSnapshot {
    val prefs = context.getSharedPreferences(PREFS, Context.MODE_PRIVATE)
    return StoredWidgetSnapshot(
      nextTitle = prefs.getString("nextTitle", "") ?: "",
      nextMeta = prefs.getString("nextMeta", "") ?: "",
      urgentCount = prefs.getInt("urgentCount", 0),
      weather = prefs.getString("weather", "") ?: "",
      wallet = prefs.getString("wallet", "") ?: "",
      showWallet = prefs.getBoolean("showWallet", false),
    )
  }
}
