package expo.modules.armeasure

import android.Manifest
import android.content.Context
import android.content.pm.PackageManager
import android.opengl.GLSurfaceView
import android.view.View
import android.widget.FrameLayout
import com.google.ar.core.ArCoreApk
import com.google.ar.core.Config
import com.google.ar.core.Session
import com.google.ar.core.exceptions.UnavailableException
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView

class ArMeasureView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onMeasurementStateChange by EventDispatcher<Map<String, Any?>>()
  private val surfaceView = GLSurfaceView(context)
  private val renderer = ArMeasureRenderer(context) { state ->
    post { onMeasurementStateChange(state) }
  }
  private var session: Session? = null
  private var installRequested = false
  private var destroyed = false

  init {
    surfaceView.setEGLContextClientVersion(2)
    surfaceView.preserveEGLContextOnPause = true
    surfaceView.setRenderer(renderer)
    surfaceView.renderMode = GLSurfaceView.RENDERMODE_CONTINUOUSLY
    addView(surfaceView, FrameLayout.LayoutParams(LayoutParams.MATCH_PARENT, LayoutParams.MATCH_PARENT))
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    if (!destroyed) initializeSession()
  }

  override fun onWindowVisibilityChanged(visibility: Int) {
    super.onWindowVisibilityChanged(visibility)
    if (destroyed) return
    if (visibility == View.VISIBLE) {
      surfaceView.onResume()
      initializeSession()
      renderer.requestResume()
    } else {
      renderer.requestPause(surfaceView)
      surfaceView.onPause()
    }
  }

  fun placePoint() {
    if (!destroyed) renderer.placePoint(surfaceView)
  }

  fun resetMeasurement() {
    if (!destroyed) renderer.reset(surfaceView)
  }

  fun destroy() {
    if (destroyed) return
    destroyed = true
    renderer.destroy(surfaceView)
    surfaceView.onPause()
    session = null
  }

  private fun initializeSession() {
    if (destroyed || session != null || !isAttachedToWindow) return
    if (context.checkSelfPermission(Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      emit("error", "Camera permission is required to measure with AR.")
      return
    }

    val availability = ArCoreApk.getInstance().checkAvailability(context)
    if (availability.isTransient) {
      emit("initializing", "Checking AR support on this phone…")
      postDelayed({ initializeSession() }, 250)
      return
    }
    if (!availability.isSupported) {
      emit("unsupported", "This phone does not support Google ARCore measurement.")
      return
    }

    val activity = appContext.currentActivity
    if (activity == null) {
      emit("error", "LifeDesk could not access the current Android screen.")
      return
    }

    try {
      when (ArCoreApk.getInstance().requestInstall(activity, !installRequested)) {
        ArCoreApk.InstallStatus.INSTALL_REQUESTED -> {
          installRequested = true
          emit("installing", "Finish installing Google Play Services for AR, then return to LifeDesk.")
          return
        }
        ArCoreApk.InstallStatus.INSTALLED -> Unit
      }

      val newSession = Session(context)
      val configuration = Config(newSession).apply {
        planeFindingMode = Config.PlaneFindingMode.HORIZONTAL_AND_VERTICAL
        focusMode = Config.FocusMode.AUTO
        if (newSession.isDepthModeSupported(Config.DepthMode.AUTOMATIC)) {
          depthMode = Config.DepthMode.AUTOMATIC
        }
      }
      newSession.configure(configuration)
      session = newSession
      renderer.setSession(newSession)
      surfaceView.onResume()
      renderer.requestResume()
      emit("initializing", "Starting the camera and looking for a surface…")
    } catch (_: UnavailableException) {
      emit("error", "AR could not start. Update Google Play Services for AR and try again.")
    } catch (error: Exception) {
      emit("error", error.message ?: "AR measurement could not start on this phone.")
    }
  }

  private fun emit(status: String, message: String) {
    onMeasurementStateChange(mapOf("status" to status, "message" to message, "canPlace" to false, "pointCount" to 0))
  }
}
