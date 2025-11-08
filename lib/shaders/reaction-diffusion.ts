// Vertex shader for full-screen quad rendering
export const fullScreenQuadVertex = `#version 300 es

in vec2 a_position;
in vec2 a_texcoord;

out vec2 v_texcoord;

void main() {
  gl_Position = vec4(a_position, 0.0, 1.0);
  v_texcoord = a_texcoord;
}
`

// Fragment shader for Gray-Scott reaction-diffusion
export const reactionDiffusionFragment = `#version 300 es
precision highp float;

uniform sampler2D u_texture;
uniform vec2 u_resolution;
uniform float u_dt;
uniform float u_du;  // Diffusion rate for u
uniform float u_dv;  // Diffusion rate for v
uniform float u_f;   // Feed rate
uniform float u_k;   // Kill rate

in vec2 v_texcoord;
out vec4 fragColor;

// Laplacian computation using 9-point stencil
vec2 laplacian(sampler2D tex, vec2 coord) {
  vec2 dx = vec2(1.0 / u_resolution.x, 0.0);
  vec2 dy = vec2(0.0, 1.0 / u_resolution.y);
  
  vec2 center = texture(tex, coord).rg;
  vec2 north = texture(tex, coord + dy).rg;
  vec2 south = texture(tex, coord - dy).rg;
  vec2 east = texture(tex, coord + dx).rg;
  vec2 west = texture(tex, coord - dx).rg;
  vec2 ne = texture(tex, coord + dx + dy).rg;
  vec2 nw = texture(tex, coord - dx + dy).rg;
  vec2 se = texture(tex, coord + dx - dy).rg;
  vec2 sw = texture(tex, coord - dx - dy).rg;
  
  // 9-point stencil
  vec2 laplacian = 
    (north + south + east + west) * 0.2 +
    (ne + nw + se + sw) * 0.05 -
    center * 1.0;
  
  return laplacian;
}

void main() {
  vec2 uv = v_texcoord;
  vec2 state = texture(u_texture, uv).rg;
  
  float u = state.r;
  float v = state.g;
  
  // Compute Laplacian
  vec2 lap = laplacian(u_texture, uv);
  
  // Gray-Scott reaction-diffusion equations
  float reaction = u * v * v;
  float du = u_du * lap.r - reaction + u_f * (1.0 - u);
  float dv = u_dv * lap.g + reaction - (u_f + u_k) * v;
  
  // Euler integration
  u += du * u_dt;
  v += dv * u_dt;
  
  // Clamp values
  u = clamp(u, 0.0, 1.0);
  v = clamp(v, 0.0, 1.0);
  
  // Visualize: u as background, v as pattern
  vec3 color = vec3(0.0);
  
  // Color mapping: u determines brightness, v determines pattern
  float pattern = smoothstep(0.3, 0.7, v);
  color = mix(
    vec3(0.0, 0.0, 0.0),           // Black background
    vec3(1.0, 0.7, 0.3) * u,        // Warm orange/yellow
    pattern
  );
  
  fragColor = vec4(color, 1.0);
}
`

// Fragment shader for rendering reaction-diffusion result to screen
export const renderFragment = `#version 300 es
precision highp float;

uniform sampler2D u_texture;
uniform float u_intensity;

in vec2 v_texcoord;
out vec4 fragColor;

void main() {
  vec4 color = texture(u_texture, v_texcoord);
  fragColor = vec4(color.rgb * u_intensity, 1.0);
}
`

