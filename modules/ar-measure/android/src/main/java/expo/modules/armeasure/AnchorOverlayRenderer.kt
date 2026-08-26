package expo.modules.armeasure

import android.opengl.GLES20
import android.opengl.Matrix
import com.google.ar.core.Camera
import com.google.ar.core.Pose

internal class AnchorOverlayRenderer {
  private var program = 0
  private var positionAttribute = 0
  private var viewProjectionUniform = 0
  private var colorUniform = 0

  fun createOnGlThread() {
    program = createProgram(VERTEX_SHADER, FRAGMENT_SHADER)
    positionAttribute = GLES20.glGetAttribLocation(program, "aPosition")
    viewProjectionUniform = GLES20.glGetUniformLocation(program, "uViewProjection")
    colorUniform = GLES20.glGetUniformLocation(program, "uColor")
  }

  fun draw(camera: Camera, poses: List<Pose>) {
    if (poses.isEmpty()) return
    val projection = FloatArray(16)
    val view = FloatArray(16)
    val viewProjection = FloatArray(16)
    camera.getProjectionMatrix(projection, 0, 0.05f, 100f)
    camera.getViewMatrix(view, 0)
    Matrix.multiplyMM(viewProjection, 0, projection, 0, view, 0)

    val vertices = FloatArray(poses.size * 3)
    poses.forEachIndexed { index, pose ->
      vertices[index * 3] = pose.tx()
      vertices[index * 3 + 1] = pose.ty()
      vertices[index * 3 + 2] = pose.tz()
    }
    val buffer = floatBufferOf(*vertices)

    GLES20.glDisable(GLES20.GL_DEPTH_TEST)
    GLES20.glUseProgram(program)
    GLES20.glUniformMatrix4fv(viewProjectionUniform, 1, false, viewProjection, 0)
    GLES20.glVertexAttribPointer(positionAttribute, 3, GLES20.GL_FLOAT, false, 0, buffer)
    GLES20.glEnableVertexAttribArray(positionAttribute)

    if (poses.size >= 2) {
      GLES20.glUniform4f(colorUniform, 0.15f, 0.39f, 0.92f, 1f)
      GLES20.glLineWidth(4f)
      GLES20.glDrawArrays(GLES20.GL_LINES, 0, 2)
    }
    GLES20.glUniform4f(colorUniform, 1f, 1f, 1f, 1f)
    GLES20.glDrawArrays(GLES20.GL_POINTS, 0, poses.size)
    GLES20.glDisableVertexAttribArray(positionAttribute)
  }

  private companion object {
    const val VERTEX_SHADER = """
      uniform mat4 uViewProjection;
      attribute vec3 aPosition;
      void main() {
        gl_Position = uViewProjection * vec4(aPosition, 1.0);
        gl_PointSize = 18.0;
      }
    """
    const val FRAGMENT_SHADER = """
      precision mediump float;
      uniform vec4 uColor;
      void main() {
        gl_FragColor = uColor;
      }
    """
  }
}
