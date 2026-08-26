package expo.modules.armeasure

import android.opengl.GLES20

internal fun createProgram(vertexSource: String, fragmentSource: String): Int {
  val vertexShader = compileShader(GLES20.GL_VERTEX_SHADER, vertexSource)
  val fragmentShader = compileShader(GLES20.GL_FRAGMENT_SHADER, fragmentSource)
  val program = GLES20.glCreateProgram()
  GLES20.glAttachShader(program, vertexShader)
  GLES20.glAttachShader(program, fragmentShader)
  GLES20.glLinkProgram(program)
  val status = IntArray(1)
  GLES20.glGetProgramiv(program, GLES20.GL_LINK_STATUS, status, 0)
  if (status[0] == 0) {
    val message = GLES20.glGetProgramInfoLog(program)
    GLES20.glDeleteProgram(program)
    throw IllegalStateException("Could not link AR renderer: $message")
  }
  GLES20.glDeleteShader(vertexShader)
  GLES20.glDeleteShader(fragmentShader)
  return program
}

private fun compileShader(type: Int, source: String): Int {
  val shader = GLES20.glCreateShader(type)
  GLES20.glShaderSource(shader, source)
  GLES20.glCompileShader(shader)
  val status = IntArray(1)
  GLES20.glGetShaderiv(shader, GLES20.GL_COMPILE_STATUS, status, 0)
  if (status[0] == 0) {
    val message = GLES20.glGetShaderInfoLog(shader)
    GLES20.glDeleteShader(shader)
    throw IllegalStateException("Could not compile AR renderer: $message")
  }
  return shader
}
