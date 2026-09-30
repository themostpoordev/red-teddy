/**
 * Lighting: one shadow-casting directional light plus a hemisphere fill.
 *
 * A single caster is deliberate. Toon banding only reads correctly when the
 * light direction is unambiguous — a second shadow-casting light creates two
 * conflicting terminator lines and the band boundaries stop agreeing across
 * parts. The hemisphere light lifts the shadow side to a warm cream so the
 * character never goes to pure black, and costs nothing since it does not
 * participate in the shadow pass.
 */

import * as THREE from "three";

export type Lighting = {
  readonly group: THREE.Group;
  readonly sun: THREE.DirectionalLight;
  /** Re-points the shadow frustum at the character. */
  follow(target: THREE.Vector3): void;
};

export function createLighting(): Lighting {
  const group = new THREE.Group();

  const sun = new THREE.DirectionalLight("#fff4e8", 2.1);
  sun.position.set(3.2, 6.4, 4.6);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 20;
  sun.shadow.camera.left = -3.2;
  sun.shadow.camera.right = 3.2;
  sun.shadow.camera.top = 3.2;
  sun.shadow.camera.bottom = -3.2;
  // Softens the shadow edge just enough to avoid a hard aliased staircase,
  // without the cost of a full PCSS pass.
  sun.shadow.radius = 2.5;
  // Two biases, and both are needed. `bias` shifts the depth comparison to
  // stop the shadow surface from occluding itself (peter-panning, acne), while
  // `normalBias` offsets the sample along the surface normal, which is what
  // actually removes the dark seams on curved, closely-packed parts — the
  // shadowed crease where the head meets the muzzle is exactly that case, and
  // a bias alone leaves a black wedge there.
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.06;
  group.add(sun);
  group.add(sun.target);

  // Sky/ground fill. Warm above, dusty rose below, so the underside of the
  // character picks up a tint rather than reading as flat black.
  const hemi = new THREE.HemisphereLight("#fff1e2", "#e8b6ab", 1.25);
  group.add(hemi);

  // A dim rim from behind separates the silhouette from the page background,
  // which is the same cream as the character's belly — without this the head
  // melts into the backdrop at some camera angles.
  const rim = new THREE.DirectionalLight("#ffd9c4", 0.7);
  rim.position.set(-4, 2.5, -5);
  group.add(rim);

  return {
    group,
    sun,

    follow(target: THREE.Vector3) {
      // Moving the light with the character keeps the shadow frustum tight
      // around it. A fixed frustum large enough for the whole jump range would
      // waste most of its 1024x1024 texels on empty space, which shows up as
      // a visibly softer, blockier shadow.
      sun.position.set(target.x + 3.2, target.y + 6.4, target.z + 4.6);
      sun.target.position.copy(target);
      sun.target.updateMatrixWorld();
    },
  };
}
