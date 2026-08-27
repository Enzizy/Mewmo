package expo.modules.lifedeskwidget

import android.content.Context
import android.content.Intent
import android.content.pm.ShortcutInfo
import android.content.pm.ShortcutManager
import android.graphics.drawable.Icon
import android.net.Uri
import android.os.Build

object LifeDeskShortcuts {
  fun sync(context: Context) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.N_MR1) return
    val manager = context.getSystemService(ShortcutManager::class.java) ?: return
    manager.dynamicShortcuts = listOf(
      shortcut(context, "capture", "Voice capture", "/record", R.drawable.lifedesk_ic_mic_dark),
      shortcut(context, "expense", "Add expense", "/wallet/activity?action=add&type=expense", R.drawable.lifedesk_ic_expense),
      shortcut(context, "task", "Add task", "/tasks?action=add", R.drawable.lifedesk_ic_task),
      shortcut(context, "reminder", "Add reminder", "/tasks/calendar?action=add", R.drawable.lifedesk_ic_calendar),
    )
  }

  private fun shortcut(context: Context, id: String, label: String, path: String, icon: Int): ShortcutInfo {
    val intent = Intent(Intent.ACTION_VIEW, Uri.parse("lifedesk://$path")).apply {
      setPackage(context.packageName)
      addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TOP)
    }
    return ShortcutInfo.Builder(context, id)
      .setShortLabel(label)
      .setLongLabel(label)
      .setIcon(Icon.createWithResource(context, icon))
      .setIntent(intent)
      .build()
  }
}
