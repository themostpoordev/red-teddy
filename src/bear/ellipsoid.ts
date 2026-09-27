/**
 * Placing a flat mark on a curved surface.
 *
 * This is the one piece of geometry in the character that is not "put a sphere
 * here". Every flat mark — each eye button, each blush disc — has to lie *on*
 * the skull's curved surface, and getting that wrong is what sank them into the
 * face three separate times.
 *
 * The failure is always the same. A CircleGeometry or a flat cylinder lies in
 * the XY plane facing +z. Drop one at a fixed z and it is flush in the middle
 * and buried at the edges, because the surface curves away underneath it. On a
 * round head the outer half disappears under the fur and the mark reads as a
 * stain half submerged in the cheek. Tilting the disc by a guessed angle does
 * not fix it either, because the correct angle is different at every point on
 * the surface.
 *
 * The rule: a flat plate on a curved body must be oriented along the surface
 * normal at that plate's own position.
 *
 * For an ellipsoid with semi-axes (rx, ry, rz) centred at (cx, cy, cz), the
 * surface height above a point (x, y) is
 *
 *   z = cz + rz·sqrt(1 - ((x-cx)/rx)² - ((y-cy)/ry)²)
 *
 * and the normal there is
 *
 *   n = normalize((x-cx)/rx², (y-cy)/ry², (z-cz)/rz²)
 *
 * A note on the per-side requirement, which cost a bug of its own. The skull
 * is symmetric in x, so the two eyes are mirror images in position and *nearly*
 * mirror images in normal. But "nearly" is not "exactly", and reusing one
 * side's values for the other is what made the eyes disagree: one sat flush on
 * the cheek while the other hung off the side of the head. Compute each side
 * from its own x.
 *
 * This module takes the ellipsoid as an argument rather than importing the
 * character's proportions, so it stays a general helper and can be pointed at
 * any curved surface.
 */

import * as THREE from "three";

/** A closed ellipsoid, described the way a scaled sphere actually is. */
export type Ellipsoid = {
  /** Centre, in the same local space the caller works in. */
  readonly center: readonly [number, number, number];
  /** Semi-axes, not diameters. */
  readonly radii: readonly [number, number, number];
};

export type SurfacePoint = {
  /** Where the surface sits, in the same space as the ellipsoid. */
  readonly position: THREE.Vector3;
  /** Outward unit normal at that point. */
  readonly normal: THREE.Vector3;
};

/**
 * Evaluates the surface height and normal at (x, y).
 *
 * `x` and `y` are absolute coordinates in the head's local space, not offsets
 * from the centre. Callers tend to have a position in mind already — "this
 * high on the cheek" — so making them subtract the centre is one more place to
 * get a sign wrong.
 */
export function surfaceAt(ellipsoid: Ellipsoid, x: number, y: number): SurfacePoint {
  const [cx, cy, cz] = ellipsoid.center;
  const [rx, ry, rz] = ellipsoid.radii;

  const dx = x - cx;
  const dy = y - cy;

  // Clamped, because a point just outside the silhouette — a blush placed too
  // far out, an ear pivot — would otherwise produce a NaN that silently
  // propagates into the position and the quaternion, and the part vanishes
  // rather than reporting an error.
  const under = Math.max(0, 1 - (dx / rx) ** 2 - (dy / ry) ** 2);
  const z = cz + rz * Math.sqrt(under);

  const normal = new THREE.Vector3(
    dx / rx ** 2,
    dy / ry ** 2,
    (z - cz) / rz ** 2,
  ).normalize();

  return { position: new THREE.Vector3(x, y, z), normal };
}

/** The ellipsoid as a plain function, for callers that only need the shape. */
export function ellipsoid(
  center: readonly [number, number, number],
  radii: readonly [number, number, number],
): Ellipsoid {
  return { center, radii };
}
