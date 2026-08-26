package expo.modules.armeasure

import android.opengl.GLES11Ext
import android.opengl.GLES20
import com.google.ar.core.Coordinates2d
import com.google.ar.core.Frame
import java.nio.ByteBuffer
import java.nio.ByteOrder
import java.nio.FloatBuffer

internal class CameraBackgroundRenderer {
  var textureId: Int = -1
    private set
  private var program = 0
  private var positionAttribute = 0
  private var textureAttribute = 0
  private var textureUniform = 0

  private val quadCoordinates = floatBufferOf(
    -1f, -1f,
    1f, -1f,
    -1f, 1f,
    1f, 1f
  )
  private val cameraTextureCoordinates = floatBufferOf(
    0f, 0f,
    1f, 0f,
    0f, 1f,
    1f, 1f
  )

  fun createOnGlThread() {
    val textures = IntArray(1)
    GLES20.glGenTextures(1, textures, 0)
    textureId = textures[0]
    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
    GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR)
    GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE)
    GLES20.glTexParameteri(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE)

    program = createProgram(VERTEX_SHADER, FRAGMENT_SHADER)
    positionAttribute = GLES20.glGetAttribLocation(program, "aPosition")
    textureAttribute = GLES20.glGetAttribLocation(program, "aTexCoord")
    textureUniform = GLES20.glGetUniformLocation(program, "uTexture")
  }

  fun draw(frame: Frame) {
    if (frame.hasDisplayGeometryChanged()) {
      quadCoordinates.position(0)
      cameraTextureCoordinates.position(0)
      frame.transformCoordinates2d(
        Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES,
        quadCoordinates,
        Coordinates2d.TEXTURE_NORMALIZED,
        cameraTextureCoordinates
      )
    }
    if (frame.timestamp == 0L) return

    GLES20.glDisable(GLES20.GL_DEPTH_TEST)
    GLES20.glDepthMask(false)
    GLES20.glUseProgram(program)
    GLES20.glActiveTexture(GLES20.GL_TEXTURE0)
    GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId)
    GLES20.glUniform1i(textureUniform, 0)

    quadCoordinates.position(0)
    GLES20.glVertexAttribPointer(positionAttribute, 2, GLES20.GL_FLOAT, false, 0, quadCoordinates)
    GLES20.glEnableVertexAttribArray(positionAttribute)
    cameraTextureCoordinates.position(0)
    GLES20.glVertexAttribPointer(textureAttribute, 2, GLES20.GL_FLOAT, false, 0, cameraTextureCoordinates)
    GLES20.glEnableVertexAttribArray(textureAttribute)
    GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4)
    GLES20.glDisableVertexAttribArray(positionAttribute)
    GLES20.glDisableVertexAttribArray(textureAttribute)
    GLES20.glDepthMask(true)
  }

  private companion object {
    const val VERTEX_SHADER = """
      attribute vec2 aPosition;
      attribute vec2 aTexCoord;
      varying vec2 vTexCoord;
      void main() {
        gl_Position = vec4(aPosition, 0.0, 1.0);
        vTexCoord = aTexCoord;
      }
    """
    const val FRAGMENT_SHADER = """
      #extension GL_OES_EGL_image_external : require
      precision mediump float;
      uniform samplerExternalOES uTexture;
      varying vec2 vTexCoord;
      void main() {
        gl_FragColor = texture2D(uTexture, vTexCoord);
      }
    """
  }
}

internal fun floatBufferOf(vararg values: Float): FloatBuffer =
  ByteBuffer.allocateDirect(values.size * 4).order(ByteOrder.nativeOrder()).asFloatBuffer().apply {
    put(values)
    position(0)
  }
