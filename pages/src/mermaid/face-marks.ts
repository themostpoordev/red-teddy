/**
 * Face marks, drawn by the head's own shader.
 *
 * WHY THIS EXISTS
 *
 * The eyes were first built as separate 3D meshes placed in the sockets, and
 * that approach was abandoned. Every problem it had was a Z-ORDERING problem:
 * a lid dome covering the iris, a cornea occluding the sclera, a lash
 * floating above the brow, an iris z-fighting the white at 0.0002 of
 * clearance. Each of those was invisible in the numbers and obvious on screen,
 * and each fix moved the symptom rather than the cause.
 *
 * The cause is that a face is not assembled from parts. It is ONE continuous
 * surface, and an eye is not a separate object resting on it — it is a
 * PATTERN ON it. Modelling it as separate solids means constantly
 * re-deciding which one is in front, and there is no right answer because
 * they are not really separate.
 *
 * Drawn into the head's own surface, the question cannot arise. The iris, the
 * pupil, the lashes and the lids are all painted on the same geometry that
 * carries the nose and the cheekbones, at the same depth, with no ordering
 * to get wrong.
 *
 * IT STILL HAS TO FOLLOW THE CURVATURE
 *
 * The naive version — pass the eye's position and a radius, paint anything
 * within that distance of it — fails the moment the head turns, because the
 * surface curves away and the circle lands on skin that has rotated past the
 * eye.
 *
 * The fix is the same idea the geometry uses: a flat mark on a curved body
 * must be positioned in the surface's OWN parameter space, not in world
 * space. So each mark is described by two angles on the head (azimuth and
 * elevation, the same (x, y) the displacement field takes), the shader
 * converts the fragment's own surface position back to those angles, and
 * compares. A mark then stays on the cheek no matter how far the head turns,
 * because it is defined in the head's coordinates and not the camera's.
 *
 * That also makes the marks move when the expression changes, for free: the
 * displacement field is the single source of truth for where the face is, so
 * anything positioned through it tracks automatically.
 */

import * as THREE from "three";

export type FaceMarkOptions = {
  /** The colour of the eye white, as [r, g, b] in 0..1. */
  readonly sclera: readonly [number, number, number];
  /** The iris, at its rim. */
  readonly iris: readonly [number, number, number];
  /** The iris, at its centre. */
  readonly irisCore: readonly [number, number, number];
  /** Pupil and lash colour. */
  readonly ink: readonly [number, number, number];
  /** Where the eyes sit, in the head's own (x, y) surface coordinates. */
  readonly eyeX: number;
  readonly eyeY: number;
  /** Eye half-width and half-height, in the same units. */
  readonly eyeW: number;
  readonly eyeH: number;
  /** How far the pupil can travel from centre, as a fraction of eyeW. */
  readonly gaze: readonly [number, number];
  /** Vertical squint, 0 open to 1 shut. */
  readonly open: number;
};

const vertex = /* glsl */ `
  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vNormalW;

  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    // The head mesh is uniformly scaled, so the local position works as the
    // surface parameter directly — no inverse transform needed.
    vLocal = position;
    vNormalW = normalize(mat3(modelMatrix) * normal);
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const fragment = /* glsl */ `
  precision highp float;

  uniform vec3  uColor;
  uniform vec3  uShadowColor;
  uniform vec3  uLightDir;
  /**
   * Camera position, in the same space as the vertices.
   *
   * The built-in three.js uniform of the same name exists only in the VERTEX
   * shader. Referencing it from the fragment stage resolves to nothing, so it
   * is passed in explicitly. The view vector is what makes the rim light tight
   * to the silhouette and the specular face the viewer, so it has to be the
   * real camera rather than a fixed direction.
   */
  uniform vec3 uCameraPos;
  uniform vec3  uRimColor;
  uniform float uRimStrength;
  uniform float uRimPower;
  uniform vec3  uFillColor;
  uniform float uFillAmount;
  uniform vec3  uSubsurface;
  uniform float uSubsurfaceAmount;
  uniform float uSpecular;
  uniform float uSmoothness;
  uniform float uAmbient;

  uniform vec3  uSclera;
  uniform vec3  uIris;
  uniform vec3  uIrisCore;
  uniform vec3  uInk;
  uniform float uEyeX;
  uniform float uEyeY;
  uniform float uEyeW;
  uniform float uEyeH;
  uniform float uGazeX;
  uniform float uGazeY;
  uniform float uOpen;
  uniform float uHairX;

  varying vec3 vWorld;
  varying vec3 vLocal;
  varying vec3 vNormalW;

  /**
   * A smooth 1 inside the shape and 0 outside it, over the given width.
   *
   * A hard step would alias badly at this scale — the eye is about 60px wide
   * and a one-pixel stair-step along the lash is instantly visible. This
   * gives an antialiased edge for free from geometry the head already has.
   */
  float band(float d, float soft) {
    return 1.0 - smoothstep(-soft, soft, d);
  }

  /**
   * Height of an arc that peaks at the inner third and falls away outboard.
   *
   * The fold above the lashes and the lash itself are both built on this.
   * Straight lines give two parallel bars, and two parallel bars is a robot:
   * the fold follows the round of the eye, so its height has to vary across x.
   *
   * Declared at file scope rather than inside main. GLSL ES 1.0 does not
   * allow a function definition in the middle of a block, and the compiler
   * reports it as a bare "syntax error" on the function's own line with no
   * hint that the problem is where it sits rather than what it says.
   */
  float arcY(float x, float lift, float dip) {
    float t = x / uEyeW;
    return lift + dip * (t * t * 0.85 + t * 0.15);
  }

  void main() {
    // --- where this fragment is on the head -----------------------------
    // The eyes live on the front of the head, so the surface point is
    // projected onto the head's own xy plane. That plane IS the parameter
    // space the displacement field is authored in, which is what makes the
    // marks follow the face through a turn instead of sliding off it.
    vec2 p = vLocal.xy;

    // Per-eye local coordinates: mirrored, and re-centred on the socket.
    float side = p.x < 0.0 ? -1.0 : 1.0;
    vec2 e = vec2(abs(p.x) - uEyeX, p.y - uEyeY);

    // The face mask, which decides where marks are allowed to appear at all.
    //
    // It has to be 1 ACROSS THE WHOLE FACE, not just at the centre. The
    // obvious construction — fall off with distance from the head's axis —
    // gives 0.5 at the middle of the forehead and 0.38 at the eye socket,
    // so the eyes are painted at under half strength and are invisible. The
    // falloff has to be pushed far enough out that it only bites at the ears
    // and the back of the skull.
    //
    // Two gates rather than one: a generous radial falloff for the sides, and
    // a hard gate on z for the back of the head.
    float radial = 1.0 - smoothstep(0.55, 0.95, length(p));
    float facing = step(0.0, vLocal.z);
    float face = radial * facing;

    // --- the eyeball -----------------------------------------------------
    // Two pieces: an almond-shaped white, and the iris inside it.
    //
    // The almond is the intersection of two offset circles rather than an
    // ellipse. An ellipse has round ends and reads as a lens lying on the
    // face; the almond is what gives the corners their lift, and the lift is
    // what makes an eye look like an eye rather than like a hole.
    //
    // The half-height comes from the lid aperture. When the eye is shut it
    // collapses to a sliver rather than to nothing, because a fully closed eye
    // still shows a line.
    float openH = uEyeH * max(uOpen, 0.055);
    float lidClose = 1.0 - uOpen;

    // Slightly wider than tall even when fully open — a circle-ish eye reads
    // as surprised, which is an expression, not a default.
    float aw = uEyeW * (0.92 + 0.08 * uOpen);
    float ah = openH;

    // The upper lid arc, and the lower one shallower. Both peak inboard.
    float upperLid = -(ah * 1.02 - 0.055 * (e.x / uEyeW) * (e.x / uEyeW) * uEyeW);
    float lowerLid = ah * 0.92 + 0.045 * (e.x / uEyeW) * (e.x / uEyeW) * uEyeW;

    // Outside the two lids vertically, inside the width horizontally.
    float inLids = band(
      abs(e.y - (upperLid + lowerLid) * 0.5) / ((lowerLid - upperLid) * 0.5) - 1.0,
      0.06
    );
    // The width is an ELLIPSE, not a slab. A slab gives the white a flat top
    // and bottom and square corners where it meets the lid, and a square
    // corner in a face reads as a box — which is exactly what it looked like.
    float inWidth = band(
      length(vec2(e.x / aw, (e.y - (upperLid + lowerLid) * 0.5) / (ah * 1.05))) - 1.0,
      0.05
    );
    float eye = min(inLids, inWidth);

    // --- iris, pupil, gaze ------------------------------------------------
    //
    // The iris is LARGE and fills most of the aperture. That is the single
    // biggest difference between an anime eye and a realistic one: a real
    // iris is a small disc in a large white, an anime one is a large disc
    // with a thin rim of white around it. Sizing it to be anatomically
    // correct is what makes rendered eyes look like dolls' buttons.
    vec2 gaze = vec2(uGazeX, uGazeY) * uEyeW * 0.2;
    float irisR = uEyeW * 0.7;
    float dIris = length((e - gaze) / vec2(irisR, irisR * 0.95)) - 1.0;
    float iris = band(dIris, 0.05);

    // A darker ring at the iris edge. Without it the iris is a flat sticker
    // on the white; with it the two read as different depths.
    float ring = clamp(band(dIris, 0.05) - band(dIris + 0.14, 0.06), 0.0, 1.0);

    float dPupil = length((e - gaze) / vec2(irisR * 0.4, irisR * 0.44)) - 1.0;
    float pupil = band(dPupil, 0.04);

    // Catchlights: large and high-inboard, small and low-outboard. Both eyes
    // get the same pair — the light is up and to one side, and mirroring them
    // would put one at the inner corner and the other at the outer.
    vec2 c1 = e - vec2(-uEyeW * 0.3, -uEyeH * 0.34);
    vec2 c2 = e - vec2(uEyeW * 0.22, uEyeH * 0.3);
    float spark1 = band(length(c1 / (uEyeW * 0.19)) - 1.0, 0.08);
    float spark2 = band(length(c2 / (uEyeW * 0.1)) - 1.0, 0.06);

    // --- the lid crease ---------------------------------------------------
    //
    // The lash is the heaviest mark on an anime eye and the one that most
    // gives it away when it is wrong. Three things make it read:
    //
    //   it TAPERS   heavy at the inner corner, fine at the outer
    //   it FOLLOWS  the curve of the eye, not a chord across it
    //   it FLICKS   up at the outer end, where the eye opens to the light
    //
    // The taper is squared rather than linear because a linear one keeps too
    // much weight in the middle and the lash reads as a bar that got thinner.
    //
    // The weight is deliberately close to the brow's. A lash many times
    // heavier than the brow above it stops being an eyelash and becomes
    // sunglasses — which is exactly what a thick straight line over an eye
    // looks like.
    vec2 lp = e - vec2(0.0, arcY(e.x, uEyeH * 0.86 - lidClose * 0.5, -0.055));
    float lashAng = -0.12;
    vec2 lq = vec2(
      lp.x * cos(lashAng) - lp.y * sin(lashAng),
      lp.x * sin(lashAng) + lp.y * cos(lashAng)
    );
    float lashT = clamp((lq.x + uEyeW) / (uEyeW * 2.0), 0.0, 1.0);
    float lashW = mix(0.032, 0.007, lashT * lashT);
    float lash = band(
      length(vec2(lq.x, lq.y / lashW)) - uEyeW * 1.18,
      0.035
    );

    vec2 cp = e - vec2(0.0, arcY(e.x, uEyeH * (1.06 + 0.18 * (1.0 - uOpen)), -0.07));
    float crease = band(
      length(vec2(cp.x / (uEyeW * 1.1), cp.y / (uEyeH * 0.055))) - 1.0,
      0.11
    );

    // Lower lash line: short, at the outer corner only, and very light. It
    // is a hint of an eye rather than a feature of it.
    vec2 bp = e - vec2(uEyeW * 0.46, -uEyeH * 0.84);
    float low = band(length(vec2(bp.x / (uEyeW * 0.46), bp.y / (uEyeH * 0.06))) - 1.0, 0.12);

    // --- the eyebrow -------------------------------------------------------
    // A soft arc above the crease, thickest at the inner end.
    //
    // This is the mark that most separates a face from a mask, and the one
    // that is easiest to leave out: an eye with lashes and an iris but no
    // brow has no expression on it at all, because a brow is what carries
    // mood and the eye below it can only carry attention.
    //
    // Built like the lash — an arc, tapered, mirrored per side — because a
    // straight brow above a curved lash reads as a mistake.
    //
    // Kept VERY thin. A brow drawn at lash weight reads as a second pair of lashes
    // stacked above the first, and the face looks like it is wearing a mask.
    // A brow is a soft edge of hair; the lash is the hard line below it. The
    // whole difference is one or two pixels of weight, and it is the single
    // most common way a rendered face ends up looking cross.
    vec2 bp0 = e - vec2(0.0, arcY(e.x, uEyeH * 1.46, -0.1));
    float bT = clamp((bp0.x + uEyeW * 1.0) / (uEyeW * 2.0), 0.0, 1.0);
    float bW = mix(0.02, 0.005, bT * bT);
    float brow = band(
      length(vec2(bp0.x / (uEyeW * 1.0), bp0.y / bW)) - 1.0,
      0.045
    );

    // --- shading ----------------------------------------------------------
    vec3 N = normalize(vNormalW);
    vec3 V = normalize(uCameraPos - vWorld);
    vec3 L = normalize(uLightDir);
    float ndl = dot(N, L);

    float lit = smoothstep(-0.06, 0.10, ndl);
    lit = mix(lit, 1.0, 0.18 * uSmoothness + 0.12);
    vec3 base = mix(uShadowColor, uColor, lit);

    float back = clamp(-ndl, 0.0, 1.0);
    base = mix(base, uSubsurface, back * uSubsurfaceAmount * (1.0 - lit));
    base += uFillColor * (N.y * 0.5 + 0.5) * uFillAmount * uAmbient;

    float fres = pow(1.0 - clamp(dot(N, V), 0.0, 1.0), uRimPower);
    base += uRimColor * fres * uRimStrength * smoothstep(-0.35, 0.55, ndl);

    vec3 H = normalize(L + V);
    float spec = pow(max(dot(N, H), 0.0), 48.0) * uSpecular * lit;
    base += vec3(spec) * mix(vec3(1.0), uColor, 0.35);

    // --- paint the marks ---------------------------------------------------
    // Composed in back-to-front order over the skin colour, so each layer
    // only shows where it is not covered by the one above it. No depth
    // testing is involved anywhere, which is the whole point.
    vec3 col = base;

    // The eye white sits in shadow, because it is a recess. A fully lit white
    // next to skin is the single thing that makes a painted eye look pasted.
    vec3 white = mix(uSclera * 0.72, uSclera, lit);
    col = mix(col, white, eye * face);

    // Iris, with a soft radial gradient and a darker rim.
    vec3 irisCol = mix(uIrisCore, uIris, clamp(dIris * 0.5 + 0.5, 0.0, 1.0));
    irisCol = mix(irisCol, uIris * 0.55, ring);
    col = mix(col, irisCol, iris * eye * face);

    col = mix(col, uInk, pupil * eye * face);
    col = mix(col, vec3(1.0), clamp(spark1 + spark2, 0.0, 1.0) * eye * face);

    // Ink on top of the eye so a lash crossing the corner still reads. The line
    // is drawn at reduced strength: a full-strength lash reads as the heaviest
    // mark on the face, and it is the eyebrows that should be carrying that
    // weight.
    float ink = clamp(lash + low * 0.55, 0.0, 1.0);
    col = mix(col, uInk, ink * face * 0.92);

    // The crease last, and only where the eye is open — closed, it would draw
    // a line across the shut lid.
    col = mix(col, mix(uInk, base, 0.5), crease * face * uOpen * 0.55);

    // The brow sits above everything else. Drawn in the character's own ink
    // rather than pure black — a brow is hair, and hair is never the darkest
    // thing on a face.
    col = mix(col, mix(uInk, base, 0.28), brow * face * 0.85);

    // Blush, the standard anime tell. Placed below the eye and outboard, and
    // soft enough to read as skin rather than as a mark.
    //
    // Positioned in the eye's OWN frame (e) rather than in the head's (p),
    // and mirrored by abs() so both cheeks get the same shape. Anchoring it
    // to p put the left blush under the right eye and offset downward, which
    // is what made it look like a stray smudge rather than both cheeks.
    vec2 bl = vec2(e.x - uEyeW * 0.95, e.y + uEyeH * 1.25);
    float blush = band(
      length(bl / vec2(uEyeW * 0.95, uEyeH * 0.62)) - 1.0,
      0.85
    );
    col = mix(col, mix(col, uSubsurface, 0.5), blush * face * 0.72);

    gl_FragColor = vec4(col, 1.0);
  }
`;

export function createFaceMaterial(
  options: FaceMarkOptions,
  base: {
    color: THREE.ColorRepresentation;
    shadow?: THREE.ColorRepresentation;
    subsurface?: THREE.ColorRepresentation;
    rim?: THREE.ColorRepresentation;
    rimStrength?: number;
    rimPower?: number;
    fill?: THREE.ColorRepresentation;
    fillAmount?: number;
    ambient?: number;
    specular?: number;
    smoothness?: number;
    lightDir: THREE.Vector3;
  },
): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    vertexShader: vertex,
    fragmentShader: fragment,
    uniforms: {
      uColor: { value: new THREE.Color(base.color) },
      uShadowColor: { value: new THREE.Color(base.shadow ?? "#3a4a63") },
      uLightDir: { value: base.lightDir.clone().normalize() },
      uCameraPos: { value: new THREE.Vector3(0, 0, 5) },
      uRimColor: { value: new THREE.Color(base.rim ?? "#ffffff") },
      uRimStrength: { value: base.rimStrength ?? 0.55 },
      uRimPower: { value: base.rimPower ?? 3.2 },
      uFillColor: { value: new THREE.Color(base.fill ?? "#bfe4ff") },
      uFillAmount: { value: base.fillAmount ?? 0.28 },
      uSubsurface: { value: new THREE.Color(base.subsurface ?? "#ff8fa3") },
      uSubsurfaceAmount: { value: 0.45 },
      uSpecular: { value: base.specular ?? 0.35 },
      uSmoothness: { value: base.smoothness ?? 0.5 },
      uAmbient: { value: base.ambient ?? 1 },

      uSclera: { value: new THREE.Vector3(...options.sclera) },
      uIris: { value: new THREE.Vector3(...options.iris) },
      uIrisCore: { value: new THREE.Vector3(...options.irisCore) },
      uInk: { value: new THREE.Vector3(...options.ink) },
      uEyeX: { value: options.eyeX },
      uEyeY: { value: options.eyeY },
      uEyeW: { value: options.eyeW },
      uEyeH: { value: options.eyeH },
      uGazeX: { value: options.gaze[0] },
      uGazeY: { value: options.gaze[1] },
      uOpen: { value: options.open },
      uHairX: { value: 0 },
    },
  });
}
