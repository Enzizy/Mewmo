package expo.modules.armeasure

import android.content.Context
import android.opengl.GLES20
import android.opengl.GLSurfaceView
import android.view.Surface
import android.view.WindowManager
import com.google.ar.core.Anchor
import com.google.ar.core.Camera
import com.google.ar.core.DepthPoint
import com.google.ar.core.Frame
import com.google.ar.core.HitResult
import com.google.ar.core.Plane
import com.google.ar.core.Point
import com.google.ar.core.Pose
import com.google.ar.core.Session
import com.google.ar.core.TrackingFailureReason
import com.google.ar.core.TrackingState
import com.google.ar.core.exceptions.CameraNotAvailableException
import java.util.Locale
import javax.microedition.khronos.egl.EGLConfig
import javax.microedition.khronos.opengles.GL10
import kotlin.math.abs
import kotlin.math.sqrt

internal class ArMeasureRenderer(
  private val context: Context,
  private val dispatch: (Map<String, Any?>) -> Unit
) : GLSurfaceView.Renderer {
  private val cameraBackground = CameraBackgroundRenderer()
  private val overlay = AnchorOverlayRenderer()
  @Volatile private var session: Session? = null
  @Volatile private var shouldResume = false
  private var resumed = false
  private var width = 1
  private var height = 1
  private var anchorA: Anchor? = null
  private var endpointBInAnchorSpace: Pose? = null
  private var lockedDistanceMeters: Float? = null
  private var firstHitKind: HitKind? = null
  private var firstPlane: Plane? = null
  private var firstSurfaceNormal: FloatArray? = null
  private var currentHit: HitResult? = null
  private var currentHitKind: HitKind? = null
  private var candidatePose: Pose? = null
  private var candidateEndpointInAnchorSpace: Pose? = null
  private var candidatePlane: Plane? = null
  private var stableFrameCount = 0
  private var trackingMessage: String? = null
  private var incompatibleSurfaceFound = false
  private var lastEventSignature = ""
  private var fatalError = false

  fun setSession(value: Session) {
    session = value
    fatalError = false
  }

  fun requestResume() {
    shouldResume = true
  }

  fun requestPause(surfaceView: GLSurfaceView) {
    shouldResume = false
    surfaceView.queueEvent { pauseSession() }
  }

  fun placePoint(surfaceView: GLSurfaceView) {
    surfaceView.queueEvent {
      val hit = currentHit ?: return@queueEvent
      val hitKind = currentHitKind ?: return@queueEvent
      if (!isCandidateStable() || endpointBInAnchorSpace != null) return@queueEvent
      try {
        val firstAnchor = anchorA
        if (firstAnchor == null) {
          anchorA = hit.createAnchor()
          firstHitKind = hitKind
          firstPlane = (hit.trackable as? Plane)?.let(::canonicalPlane)
          firstSurfaceNormal = hit.hitPose.getYAxis()
        } else {
          if (firstAnchor.trackingState != TrackingState.TRACKING) {
            emit("firstPoint", "Point A is not tracking yet. Hold still and aim at it again.", false)
            return@queueEvent
          }
          val relativeEndpoint = candidateEndpointInAnchorSpace ?: return@queueEvent
          val distance = distanceFromOrigin(relativeEndpoint)
          if (distance < MIN_MEASUREMENT_METERS) {
            emit("firstPoint", "Move the marker farther from point A before setting point B.", false)
            return@queueEvent
          }
          endpointBInAnchorSpace = relativeEndpoint
          lockedDistanceMeters = distance
        }
        clearCandidate()
        emitCurrentState(force = true)
      } catch (_: Exception) {
        emit("error", "That point could not be locked. Aim at a detected surface and try again.", false)
      }
    }
  }

  fun reset(surfaceView: GLSurfaceView) {
    surfaceView.queueEvent {
      anchorA?.detach()
      anchorA = null
      endpointBInAnchorSpace = null
      lockedDistanceMeters = null
      firstHitKind = null
      firstPlane = null
      firstSurfaceNormal = null
      clearCandidate()
      emitCurrentState(force = true)
    }
  }

  fun destroy(surfaceView: GLSurfaceView) {
    shouldResume = false
    surfaceView.queueEvent {
      anchorA?.detach()
      anchorA = null
      endpointBInAnchorSpace = null
      pauseSession()
      session?.close()
      session = null
    }
  }

  override fun onSurfaceCreated(gl: GL10?, config: EGLConfig?) {
    GLES20.glClearColor(0f, 0f, 0f, 1f)
    cameraBackground.createOnGlThread()
    overlay.createOnGlThread()
  }

  override fun onSurfaceChanged(gl: GL10?, width: Int, height: Int) {
    this.width = width.coerceAtLeast(1)
    this.height = height.coerceAtLeast(1)
    GLES20.glViewport(0, 0, this.width, this.height)
  }

  override fun onDrawFrame(gl: GL10?) {
    GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT or GLES20.GL_DEPTH_BUFFER_BIT)
    val activeSession = session ?: return
    if (fatalError) return

    if (shouldResume && !resumed) {
      try {
        activeSession.resume()
        activeSession.setCameraTextureName(cameraBackground.textureId)
        resumed = true
      } catch (_: CameraNotAvailableException) {
        fatalError = true
        emit("error", "The camera is unavailable. Close other camera apps and reopen this tool.", false)
        return
      }
    }
    if (!resumed) return

    try {
      activeSession.setDisplayGeometry(displayRotation(), width, height)
      val frame = activeSession.update()
      cameraBackground.draw(frame)
      updateTrackingState(frame.camera)
      updateHit(frame)
      drawAnchors(frame.camera)
      emitCurrentState()
    } catch (_: CameraNotAvailableException) {
      fatalError = true
      emit("error", "The camera stopped responding. Reopen the measurement tool and try again.", false)
    } catch (error: Exception) {
      fatalError = true
      emit("error", error.message ?: "AR tracking stopped unexpectedly.", false)
    }
  }

  fun pauseSession() {
    if (!resumed) return
    session?.pause()
    resumed = false
  }

  private fun updateHit(frame: Frame) {
    if (endpointBInAnchorSpace != null || frame.camera.trackingState != TrackingState.TRACKING || anchorA?.trackingState == TrackingState.STOPPED || anchorA?.trackingState == TrackingState.PAUSED) {
      clearCandidate()
      return
    }

    val hits = frame.hitTest(width / 2f, height / 2f)
    val foundIncompatibleSurface = anchorA != null && hits.any(::isGeometricallyUsableHit) && hits.none(::isCompatibleHit)
    val hit = selectBestHit(hits)
    updateStableCandidate(hit, frame.camera.pose)
    incompatibleSurfaceFound = foundIncompatibleSurface
  }

  private fun selectBestHit(hits: List<HitResult>): HitResult? {
    val compatible = hits.filter(::isCompatibleHit)
    val requiredKind = firstHitKind
    if (requiredKind != null) return compatible.firstOrNull { hitKind(it) == requiredKind }
    return compatible.firstOrNull { hitKind(it) == HitKind.PLANE }
      ?: compatible.firstOrNull { hitKind(it) == HitKind.DEPTH }
      ?: compatible.firstOrNull { hitKind(it) == HitKind.FEATURE }
  }

  private fun isCompatibleHit(hit: HitResult): Boolean {
    if (!isGeometricallyUsableHit(hit)) return false
    val kind = hitKind(hit) ?: return false
    val expectedKind = firstHitKind
    if (expectedKind != null && kind != expectedKind) return false

    val expectedPlane = firstPlane
    if (expectedPlane != null) {
      val hitPlane = hit.trackable as? Plane ?: return false
      return canonicalPlane(hitPlane) == canonicalPlane(expectedPlane)
    }

    val expectedNormal = firstSurfaceNormal
    return expectedNormal == null || surfaceNormalsAlign(expectedNormal, hit.hitPose.getYAxis())
  }

  private fun isGeometricallyUsableHit(hit: HitResult): Boolean {
    val trackable = hit.trackable
    if (trackable.trackingState != TrackingState.TRACKING) return false
    return when (trackable) {
      is Plane -> hit.distance in MIN_PLANE_DISTANCE_METERS..MAX_HIT_DISTANCE_METERS && trackable.isPoseInPolygon(hit.hitPose)
      is DepthPoint -> hit.distance in MIN_DEPTH_DISTANCE_METERS..MAX_HIT_DISTANCE_METERS
      is Point -> hit.distance in MIN_FEATURE_DISTANCE_METERS..MAX_FEATURE_DISTANCE_METERS && trackable.orientationMode == Point.OrientationMode.ESTIMATED_SURFACE_NORMAL
      else -> false
    }
  }

  private fun hitKind(hit: HitResult): HitKind? = when (hit.trackable) {
    is Plane -> HitKind.PLANE
    is DepthPoint -> HitKind.DEPTH
    is Point -> HitKind.FEATURE
    else -> null
  }

  private fun updateStableCandidate(hit: HitResult?, cameraPose: Pose) {
    if (hit == null) {
      clearCandidate()
      return
    }

    val kind = hitKind(hit) ?: run {
      clearCandidate()
      return
    }
    val worldPose = hit.hitPose
    val relativeEndpoint = anchorA?.takeIf { it.trackingState == TrackingState.TRACKING }?.pose?.inverse()?.compose(worldPose)
    val stabilityPose = relativeEndpoint ?: cameraPose.inverse().compose(worldPose)
    val plane = (hit.trackable as? Plane)?.let(::canonicalPlane)
    val previousPose = candidatePose
    val sameSurface = currentHitKind == kind && (kind != HitKind.PLANE || candidatePlane == plane)
    val threshold = when (kind) {
      HitKind.PLANE -> MAX_PLANE_JITTER_METERS
      HitKind.DEPTH -> MAX_DEPTH_JITTER_METERS
      HitKind.FEATURE -> MAX_FEATURE_JITTER_METERS
    }

    stableFrameCount = if (previousPose != null && sameSurface && distanceBetween(previousPose, stabilityPose) <= threshold) {
      (stableFrameCount + 1).coerceAtMost(REQUIRED_STABLE_FRAMES)
    } else {
      1
    }
    candidatePose = stabilityPose
    candidateEndpointInAnchorSpace = relativeEndpoint
    candidatePlane = plane
    currentHit = hit
    currentHitKind = kind
  }

  private fun clearCandidate() {
    currentHit = null
    currentHitKind = null
    candidatePose = null
    candidateEndpointInAnchorSpace = null
    candidatePlane = null
    stableFrameCount = 0
    incompatibleSurfaceFound = false
  }

  private fun isCandidateStable(): Boolean = currentHit != null && stableFrameCount >= REQUIRED_STABLE_FRAMES

  private fun canonicalPlane(plane: Plane): Plane {
    var result = plane
    while (result.subsumedBy != null) result = result.subsumedBy!!
    return result
  }

  private fun drawAnchors(camera: Camera) {
    if (camera.trackingState != TrackingState.TRACKING) return
    val firstAnchor = anchorA ?: return
    if (firstAnchor.trackingState != TrackingState.TRACKING) return
    val poses = mutableListOf(firstAnchor.pose)
    val endpoint = endpointBInAnchorSpace
    if (endpoint != null) {
      poses += firstAnchor.pose.compose(endpoint)
    } else if (isCandidateStable()) {
      currentHit?.hitPose?.let(poses::add)
    }
    overlay.draw(camera, poses)
  }

  private fun emitCurrentState(force: Boolean = false) {
    val pointCount = when {
      endpointBInAnchorSpace != null -> 2
      anchorA != null -> 1
      else -> 0
    }
    val distance = lockedDistanceMeters
    val canPlace = isCandidateStable() && pointCount < 2
    val status: String
    val message: String
    when {
      pointCount == 2 && distance != null -> {
        status = "complete"
        message = "Measurement locked to one stable surface"
      }
      trackingMessage != null -> {
        status = if (pointCount == 1) "firstPoint" else "searching"
        message = trackingMessage!!
      }
      anchorA?.trackingState == TrackingState.STOPPED -> {
        status = "firstPoint"
        message = "Point A was lost. Reset and scan the surface again."
      }
      anchorA?.trackingState == TrackingState.PAUSED -> {
        status = "firstPoint"
        message = "Hold still while point A reconnects to the surface."
      }
      pointCount == 1 && incompatibleSurfaceFound -> {
        status = "firstPoint"
        message = "Keep point B on the same surface as point A."
      }
      stableFrameCount in 1 until REQUIRED_STABLE_FRAMES -> {
        status = if (pointCount == 1) "firstPoint" else "searching"
        message = "Hold still while the surface locks…"
      }
      pointCount == 1 && canPlace -> {
        status = "firstPoint"
        message = "Point A is fixed. The end point is stable and ready."
      }
      pointCount == 1 -> {
        status = "firstPoint"
        message = "Point A is fixed. Move slowly to the end on the same surface."
      }
      canPlace -> {
        status = "ready"
        message = "Stable surface found. Set point A."
      }
      else -> {
        status = "searching"
        message = "Scan slowly at an angle. On plain surfaces, aim near an edge or add a marker."
      }
    }
    val signature = "$status|$message|$canPlace|$pointCount|${distance?.let { String.format(Locale.US, "%.5f", it) }}"
    if (!force && signature == lastEventSignature) return
    lastEventSignature = signature
    dispatch(buildMap {
      put("status", status)
      put("message", message)
      put("canPlace", canPlace)
      put("pointCount", pointCount)
      if (distance != null) put("distanceMeters", distance.toDouble())
    })
  }

  private fun emit(status: String, message: String, canPlace: Boolean) {
    lastEventSignature = ""
    val pointCount = if (anchorA == null) 0 else if (endpointBInAnchorSpace == null) 1 else 2
    dispatch(mapOf("status" to status, "message" to message, "canPlace" to canPlace, "pointCount" to pointCount))
  }

  private fun updateTrackingState(camera: Camera) {
    trackingMessage = if (camera.trackingState == TrackingState.TRACKING) null else when (camera.trackingFailureReason) {
      TrackingFailureReason.INSUFFICIENT_LIGHT -> "Tracking needs more light. Brighten the surface and try again."
      TrackingFailureReason.EXCESSIVE_MOTION -> "Move the phone more slowly, then hold still."
      TrackingFailureReason.INSUFFICIENT_FEATURES -> "Aim near an edge or add a small piece of tape to this plain surface."
      TrackingFailureReason.CAMERA_UNAVAILABLE -> "The camera is temporarily unavailable."
      else -> "Hold still while camera tracking recovers."
    }
  }

  private fun surfaceNormalsAlign(first: FloatArray, second: FloatArray): Boolean {
    val dot = first[0] * second[0] + first[1] * second[1] + first[2] * second[2]
    return abs(dot) >= MIN_SURFACE_NORMAL_DOT
  }

  private fun distanceBetween(a: Pose, b: Pose): Float {
    val dx = a.tx() - b.tx()
    val dy = a.ty() - b.ty()
    val dz = a.tz() - b.tz()
    return sqrt(dx * dx + dy * dy + dz * dz)
  }

  private fun distanceFromOrigin(pose: Pose): Float = sqrt(pose.tx() * pose.tx() + pose.ty() * pose.ty() + pose.tz() * pose.tz())

  @Suppress("DEPRECATION")
  private fun displayRotation(): Int {
    val manager = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
    return manager.defaultDisplay?.rotation ?: Surface.ROTATION_0
  }

  private enum class HitKind { PLANE, DEPTH, FEATURE }

  private companion object {
    const val REQUIRED_STABLE_FRAMES = 12
    const val MIN_MEASUREMENT_METERS = 0.01f
    const val MIN_PLANE_DISTANCE_METERS = 0.15f
    const val MIN_DEPTH_DISTANCE_METERS = 0.5f
    const val MIN_FEATURE_DISTANCE_METERS = 0.2f
    const val MAX_FEATURE_DISTANCE_METERS = 3f
    const val MAX_HIT_DISTANCE_METERS = 5f
    const val MAX_PLANE_JITTER_METERS = 0.006f
    const val MAX_DEPTH_JITTER_METERS = 0.012f
    const val MAX_FEATURE_JITTER_METERS = 0.008f
    const val MIN_SURFACE_NORMAL_DOT = 0.9f
  }
}
