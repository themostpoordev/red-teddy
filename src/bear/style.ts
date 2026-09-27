/**
 * Style: toon shading, the palette, and the ink outline.
 *
 * Lives under bear/ rather than beside it because it is entirely the
 * character's own visual language — the colour scheme and the line weight.
 * Nothing in the stage, the ground or the particles shares it.
 *
 * The toon look comes from a 4x1 DataTexture used as MeshToonMaterial's
 * gradientMap. NearestFilter is the important part — it quantises the light
 * ramp into hard bands instead of a smooth falloff, which is what reads as
 * "illustrated" rather than "shaded".
 *
 * The outline is an inverted hull: a second copy of each mesh, BackSide,
 * pushed out along its normals. It costs one extra draw call per part and
 * needs no full-screen pass, so it survives on a phone where a post-process
 * outline (a second render to a target plus a blur) would not.
 */

import * as THREE from "three";

/** Band values for the toon ramp: shadow, mid, light, full. */
const RAMP = [0.32, 0.66, 0.86, 1.0];

let gradientMap: THREE.DataTexture | null = null;

function createGradientMap(): THREE.DataTexture {
  // Red channel only — MeshToonMaterial samples the ramp as greyscale.
  const data = new Uint8Array(RAMP.length);
  RAMP.forEach((v, i) => {
    data[i] = Math.round(v * 255);
  });

  const tex = new THREE.DataTexture(data, RAMP.length, 1, THREE.RedFormat);
  tex.minFilter = THREE.NearestFilter;
  tex.magFilter = THREE.NearestFilter;
  tex.generateMipmaps = false;
  tex.needsUpdate = true;
  return tex;
}

export function toonGradient(): THREE.DataTexture {
  gradientMap ??= createGradientMap();
  return gradientMap;
}

/**
 * Flat-shaded toon material. There is no map, no roughness and no metalness
 * anywhere in this scene — every surface is a solid colour under one
 * directional light plus a hemisphere fill.
 */
export function toon(color: string): THREE.MeshToonMaterial {
  return new THREE.MeshToonMaterial({ color, gradientMap: toonGradient() });
}

export type Palette = {
  readonly fur: THREE.MeshToonMaterial;
  readonly furDeep: THREE.MeshToonMaterial;
  readonly cream: THREE.MeshToonMaterial;
  readonly ink: THREE.MeshToonMaterial;
  readonly blush: THREE.MeshToonMaterial;
  readonly heart: THREE.MeshBasicMaterial;
  readonly outline: THREE.MeshBasicMaterial;
};

/** Outline is a flat unlit colour — it is the silhouette, not a lit surface. */
export function createPalette(): Palette {
  return {
    fur: toon("#e8443a"),
    furDeep: toon("#c2352c"),
    cream: toon("#fbe3d2"),
    ink: toon("#3a2320"),
    blush: toon("#f7a9a0"),
    heart: new THREE.MeshBasicMaterial({ color: "#e8443a" }),
    outline: new THREE.MeshBasicMaterial({ color: "#8f2318", side: THREE.BackSide }),
  };
}

/**
 * Adds the outline hull for a mesh and parents it to the same transform.
 *
 * `worldThickness` is an absolute width in world units, and the uniform scale
 * is derived from the part's radius to achieve it. This matters more than it
 * looks: a fixed *proportional* thickness (scale by 1.03 regardless of size)
 * makes a big torso outline 6x thicker on screen than a thin arm outline,
 * because the same multiplier on a 6x smaller radius is 6x less world space.
 * The result is a character whose limbs have a barely-visible line while the
 * body is heavily outlined — which reads as unfinished rather than styled.
 *
 * Specifying the target width directly keeps every ink line the same weight,
 * which is what a cartoonist would draw.
 */
export function attachOutline(
  mesh: THREE.Mesh,
  worldThickness: number,
  radius: number,
  material: THREE.Material,
): THREE.Mesh {
  const hull = new THREE.Mesh(mesh.geometry, material);
  // Guard against a zero or negative radius on a degenerate part — that would
  // produce an infinite scale and silently remove the mesh from the frustum.
  const scale = 1 + worldThickness / Math.max(radius, 0.001);
  hull.scale.setScalar(scale);
  hull.castShadow = false;
  hull.receiveShadow = false;
  // The hull is purely decorative and would otherwise be picked up by the
  // raycaster, double-counting hits on every part.
  hull.raycast = () => {};
  mesh.add(hull);
  return hull;
}
