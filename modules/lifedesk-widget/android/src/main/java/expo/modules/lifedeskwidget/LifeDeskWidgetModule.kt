package expo.modules.lifedeskwidget

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record

class WidgetSnapshot : Record {
  @Field var nextTitle: String = ""
  @Field var nextMeta: String = ""
  @Field var urgentCount: Int = 0
  @Field var weather: String = ""
  @Field var wallet: String = ""
  @Field var showWallet: Boolean = false
}

class LifeDeskWidgetModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("LifeDeskWidget")

    AsyncFunction("sync") { snapshot: WidgetSnapshot ->
      val context = requireNotNull(appContext.reactContext) {
        "LifeDeskWidget requires an active Android context"
      }
      LifeDeskWidgetStore.save(context, snapshot)
      LifeDeskWidgetProvider.updateAll(context)
      LifeDeskShortcuts.sync(context)
    }
  }
}
