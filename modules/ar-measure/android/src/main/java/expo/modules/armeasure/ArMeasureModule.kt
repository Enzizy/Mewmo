package expo.modules.armeasure

import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

class ArMeasureModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ArMeasure")

    View(ArMeasureView::class) {
      Events("onMeasurementStateChange")

      AsyncFunction("placePoint") { view: ArMeasureView ->
        view.placePoint()
      }

      AsyncFunction("reset") { view: ArMeasureView ->
        view.resetMeasurement()
      }

      OnViewDestroys { view: ArMeasureView ->
        view.destroy()
      }
    }
  }
}
