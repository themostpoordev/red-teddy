/**
 * The part factory: shared geometry, and the one way a body piece is made.
 *
 * Every solid form on the character — torso, skull, ear, limb, muzzle, nose —
 * goes through `part()`. That is what keeps three things true everywhere at
 * once without repeating them per call site:
 *
 *   - the outline hull is attached, with the ink weight the same on every part
 *   - the mesh is registered as pickable for raycasting
 *   - shadow casting and receiving are on
 *
 * `outlined` opts a part out, for the few that must not carry a line: the
 * mouth (its own form IS the line), the blush (an outline around a blush reads
 * as a hole) and the inner ear.
 */

import * as THREE from "three";
import { attachOutline, type Palette } from "./style";
import { INK, SEGMENTS } from "./proportions";

/**
 * The shared geometry pool.
 *
 * One SphereGeometry serves the torso, the skull, the muzzle, the paws, the
 * feet and the ears — they differ only in scale, and a mesh's transform is free
 * compared with its vertex data. The whole character is about twenty draw
 * calls, and most of them are this one buffer with a different matrix.
 *
 * Segment counts are set by SEGMENTS; the note there explains why they are
 * higher than a silhouette-only character would need.
 */
export type Geometry = {
  readonly sphere: THREE.BufferGeometry;
  readonly smallSphere: THREE.BufferGeometry;
  readonly capsule: THREE.BufferGeometry;
};

export function createGeometry(): Geometry {
  const [w, h] = SEGMENTS.sphere;
  const [sw, sh] = SEGMENTS.smallSphere;
  const [capRings, capSegments] = SEGMENTS.capsule;

  return {
    sphere: new THREE.SphereGeometry(1, w, h),
    smallSphere: new THREE.SphereGeometry(1, sw, sh),
    capsule: new THREE.CapsuleGeometry(1, 1, capRings, capSegments),
  };
}

/** The context every part builder needs: the geometry pool, the colours, and
 *  somewhere to register a mesh as pickable. */
export type PartContext = {
  readonly geometry: Geometry;
  readonly palette: Palette;
  readonly pickables: THREE.Mesh[];
};

/**
 * Builds one solid body piece.
 *
 * `scale` is the final world size on each axis. `position` is in the parent's
 * local space.
 *
 * The outline radius is taken as the LARGEST axis, because that is the
 * dimension the eye reads the part's width from. Using anything smaller makes a
 * flat, wide shape — the belly — come out with a proportionally much heavier
 * line than a round one, which is the opposite of how a cartoonist weights an
 * ink line.
 */
export function part(
  ctx: PartContext,
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  scale: readonly [number, number, number],
  position: readonly [number, number, number],
  outlined = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.scale.set(...scale);
  mesh.position.set(...position);
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  if (outlined) {
    const radius = Math.max(...scale);
    attachOutline(mesh, INK, radius, ctx.palette.outline);
  }

  ctx.pickables.push(mesh);
  return mesh;
}

/**
 * Builds a flat disc or button and lays it on a surface.
 *
 * This exists because placing a flat plate on a curved body is the one thing
 * in this character that is easy to get subtly wrong, and it went wrong three
 * times. `surfaceAt` in ellipsoid.ts has the derivation; this is just the
 * mechanical half — orient, offset, done.
 *
 * `axis` is which local axis the geometry's flat face points along, so the
 * same helper serves a CircleGeometry (faces +z) and a flat cylinder (faces
 * ±y). Aligning that axis to the normal is a single shortest-arc rotation,
 * which is why a quaternion is used rather than Euler angles — Euler has
 * gimbal cases at exactly the extremes a cheek is at.
 */
export function layFlat(
  mesh: THREE.Mesh,
  normal: THREE.Vector3,
  at: THREE.Vector3,
  lift: number,
  axis: "z" | "y" = "z",
): void {
  const local = axis === "z" ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(0, 1, 0);
  mesh.quaternion.setFromUnitVectors(local, normal);
  mesh.position.copy(at).addScaledVector(normal, lift);
}
