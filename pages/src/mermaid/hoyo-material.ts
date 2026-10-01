/**
 * Hoyo-style shading.
 *
 * The teddy uses MeshToonMaterial: four flat bands, hard edges between them,
 * a colour ramp. That is what a printed cartoon looks like, and it is why the
 * bear reads as a drawing. A Hoyoverse character is not drawn — it is a 3D
 * object shown under a stylised light, so the light has to behave like light
 * while the palette stays flat.
 *
 * Three things do that, and all three are in this shader.
 *
 * 1. The ramp is smooth but narrow. A cel ramp quantises into hard bands, and
 *    a hard band across a curved cheek draws attention to the curve. Keeping
 *    the transition narrow rather than stepped keeps the surface reading as
 *    a surface. This is the difference between "shaded" and "banded".
 *
 * 2. Rim light, which is the single biggest contributor. A character lit
 *    only from the front is flat no matter how good the ramp is. A strong
 *    light from behind traces the silhouette in light and separates the
 *    character from the background — and it is what the eye reads as
 *    "premium" before it has parsed anything else.
 *
 * 3. A subsurface tint on the shadow side. Real skin does not go dark; light
 *    enters it, scatters, and comes back out warm. Shading the shadow toward
 *    a desaturated blue instead of toward black is most of what separates a
 *    face from a shape.
 *
 * It is a ShaderMaterial rather than a patched MeshToonMaterial because
 * MeshPhysicalMaterial's scattering terms are computed per-light and this
 * scene has one key light plus a fill, which does not justify the cost. A
 * hand-written shader also lets the ramp, the rim falloff and the tint be
 * exposed as uniforms, so the look can be tuned without recompiling.
 */

import * as THREE from "three";

const vertex = /* glsl */ `
  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vViewPos;
  varying vec2 vUv;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vViewPos = world.xyz;
    // Transformed normal, not the object-space one. Every part of a character
    // is scaled differently — an ellipsoid head, a tapered limb — and the
    // object normal is wrong on all of them once they are non-uniform.
    vNormalW = normalize(mat3(modelMatrix) * normal);
    vUv = uv;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragment = /* glsl */ `
  precision highp float;

  uniform vec3  uColor;
  uniform vec3  uShadowColor;
  uniform vec3  uLightDir;
  uniform vec3  uRimColor;
  uniform float uRimStrength;
  uniform float uRimPower;
  uniform vec3  uFillColor;
  uniform float uFillAmount;
  uniform vec3  uSubsurface;
  uniform float uSubsurfaceAmount;
  uniform float uSmoothness;
  uniform float uSpecular;
  uniform float uAmbient;

  varying vec3 vNormalW;
  varying vec3 vViewDir;
  varying vec3 vViewPos;
  varying vec2 vUv;

  void main() {
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(cameraPosition - vViewPos);
    vec3 L = normalize(uLightDir);

    float ndl = dot(N, L);

    // --- the ramp -------------------------------------------------------
    // smoothstep across a narrow band around the terminator, rather than
    // floor(ndl * n) which would produce hard steps. Both are "toon"; only
    // one of them still looks like a surface.
    float lit = smoothstep(-0.06, 0.10, ndl);
    lit = mix(lit, 1.0, 0.18 * uSmoothness + 0.12);

    vec3 base = mix(uShadowColor, uColor, lit);

    // --- subsurface -----------------------------------------------------
    // Applied only where the surface faces away from the light. Adding it
    // everywhere flattens the form; adding it only to the shadow is what
    // makes light appear to bleed through the edge of a form.
    float back = clamp(-ndl, 0.0, 1.0);
    base = mix(base, uSubsurface, back * uSubsurfaceAmount * (1.0 - lit));

    // --- fill -----------------------------------------------------------
    // A hemisphere-ish fill so the shadow side is never dead. Weighted by
    // how much the normal points up, which is what makes it read as sky
    // light rather than as a flat ambient term.
    float sky = N.y * 0.5 + 0.5;
    base += uFillColor * sky * uFillAmount * uAmbient;

    // --- rim ------------------------------------------------------------
    // 1 - dot(N, V) is high exactly where the surface turns away from the
    // camera, which is the silhouette. Squaring it and raising that to a
    // power keeps the light tight to the edge; without the power it washes
    // across the whole form.
    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uRimPower);

    // Gated by the light so the rim only appears where the key light can
    // actually wrap around. An ungated rim puts a bright edge on the shadow
    // side too, which no real light does.
    float rimGate = smoothstep(-0.35, 0.55, ndl);
    base += uRimColor * fres * uRimStrength * rimGate;

    // --- specular -------------------------------------------------------
    // One tight highlight. Kept small and slightly warm: a broad white
    // highlight on skin reads as plastic.
    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 48.0) * uSpecular * lit;
    base += vec3(spec) * mix(vec3(1.0), uColor, 0.35);

    gl_FragColor = vec4(base, 1.0);
  }
`;

export type HoyoMaterial = THREE.ShaderMaterial & {
  userData: { uColor: THREE.IUniform<THREE.Color> };
};

export type HoyoOptions = {
  /** The colour on the lit side. */
  color: THREE.ColorRepresentation;
  /** The colour on the shadow side. Cooler and darker, never black. */
  shadow?: THREE.ColorRepresentation;
  /** Warm tone bleeding through the shadow. This is the "skin" cue. */
  subsurface?: THREE.ColorRepresentation;
  /** How much the subsurface tint shows. 0 disables it entirely. */
  subsurfaceAmount?: number;
  /** Rim colour — almost always a lighter, more saturated version of the key. */
  rim?: THREE.ColorRepresentation;
  /** Rim brightness. Values above 1 read as emissive, which is often wanted. */
  rimStrength?: number;
  /** Higher tightens the rim to the silhouette edge. */
  rimPower?: number;
  /** Direction the key light comes FROM, in world space. */
  lightDir?: THREE.Vector3;
  /** Hemisphere fill. */
  fill?: THREE.ColorRepresentation;
  fillAmount?: number;
  /** Overall exposure of the fill term. */
  ambient?: number;
  /** Highlight tightness. */
  specular?: number;
  /** Extra light on the lit side; 0 gives the flat painted look. */
  smoothness?: number;
  /** Transparent. */
  transparent?: boolean;
  /** Render both faces. Needed for hair shells and fins. */
  side?: THREE.Side;
  /** Suppress depth write, for effects that layer. */
  depthWrite?: boolean;
};

export function createHoyoMaterial(options: HoyoOptions): THREE.ShaderMaterial {
  const {
    color,
    shadow = "#3a4a63",
    subsurface = "#ff8fa3",
    subsurfaceAmount = 0.42,
    rim = "#ffffff",
    rimStrength = 0.55,
    rimPower = 3.2,
    lightDir = new THREE.Vector3(0.45, 0.75, 0.5),
    fill = "#bfe4ff",
    fillAmount = 0.28,
    ambient = 1,
    specular = 0.35,
    smoothness = 0.5,
    transparent = false,
    side = THREE.FrontSide,
    depthWrite = true,
  } = options;

  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    transparent,
    depthWrite,
    side,
    uniforms: {
      uColor: { value: new THREE.Color(color) },
      uShadowColor: { value: new THREE.Color(shadow) },
      uLightDir: { value: lightDir.clone().normalize() },
      uRimColor: { value: new THREE.Color(rim) },
      uRimStrength: { value: rimStrength },
      uRimPower: { value: rimPower },
      uFillColor: { value: new THREE.Color(fill) },
      uFillAmount: { value: fillAmount },
      uSubsurface: { value: new THREE.Color(subsurface) },
      uSubsurfaceAmount: { value: subsurfaceAmount },
      uSpecular: { value: specular },
      uSmoothness: { value: smoothness },
      uAmbient: { value: ambient },
    },
  });
}

/**
 * Point every Hoyo material at the same key light.
 *
 * The light direction is a uniform, not a scene object, so moving the light
 * in the scene graph would not move the shading — each material carries its
 * own copy and they would drift apart. This keeps them in one place, and it
 * is worth doing because a character lit from two directions by a few
 * degrees reads as two characters.
 */
export function setLightDirection(
  materials: readonly THREE.ShaderMaterial[],
  direction: THREE.Vector3,
): void {
  const d = direction.clone().normalize();
  for (const m of materials) {
    const u = m.uniforms?.uLightDir;
    if (u) (u as THREE.IUniform<THREE.Vector3>).value.copy(d);
  }
}