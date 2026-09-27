/**
 * Eyes: protruding dark buttons.
 *
 * This went through three wrong designs before landing here, and each failure
 * is worth recording because the geometry constraints do not change:
 *
 *  1. A dark sphere floating in front of a white sclera. The iris sat at
 *     z = 0.082 with a depth of 0.045, reaching 0.127 — 0.02 *past* the
 *     sclera's own front surface at 0.105. A ball resting on an eyeball gets
 *     thrown off it by any rotation, so the pupil read as a bead escaping the
 *     face.
 *
 *  2. Shrinking that iris during a blink instead of hiding it. The sclera
 *     flattens to 6% of its height but keeps its full width, so a smaller iris
 *     still sat on it and stayed visible as a dark mark on a closed eye.
 *
 *  3. A white sclera at all. It is a rendering convention borrowed from
 *     human eyes, and it is what made this read as a face rather than a toy.
 *
 * A button eye removes the whole class of problem. There is no iris to
 * escape, no sclera to z-fight with, and nothing to coordinate during a blink
 * — it is one dark dome whose only job is to catch a highlight.
 */

import * as THREE from "three";
import type { Palette } from "./materials";

export type Pupil = {
  /** The dome. Squashed vertically to blink. */
  readonly dome: THREE.Mesh;
  /** The catchlight sitting on it. */
  readonly spark: THREE.Mesh;
  readonly pivot: THREE.Group;
};

export type Eyes = {
  readonly L: Pupil;
  readonly R: Pupil;
};

export function createEyes(palette: Palette): Eyes {
  /**
   * One eye. `side` is -1 for the character's right (screen left) and +1 for
   * its left (screen right); the character's own left is the viewer's right.
   *
   * Every stage is computed per side. The skull is a single ellipsoid
   * centred on the head's axis, so the two eye positions are mirror images
   * in x — but the surface normal, the surface height and the disc's tilt
   * are not, and reusing one side's values for both is what made the eyes
   * disagree: one sat flush on the cheek while the other hung off the side
   * of the head.
   */
  function make(side: number): Pupil {
    // The eye goes at x = 0.28 from the head's centre, on the cheek rather
    // than the forehead, and clear of the muzzle.
    const EX = side * 0.28;
    const EY = 0.36;
    const EZ = 0.6 * Math.sqrt(1 - (EX / 0.66) ** 2 - ((EY - 0.3) / 0.6) ** 2);

    // Surface normal of the ellipsoid at that point, for THIS side. For an
    // ellipsoid with radii r, the normal at p is (px/rx², py/ry², pz/rz²).
    // The x term carries the sign of EX, so the left eye's normal leans left
    // and the right eye's leans right — which is what tilts each disc to sit
    // parallel to the cheek it sits on.
    const normal = new THREE.Vector3(
      EX / 0.66 ** 2,
      (EY - 0.3) / 0.6 ** 2,
      EZ / 0.6 ** 2,
    ).normalize();

    // Lift the disc a hair along its own normal. The skull is approximated by
    // a smooth ellipsoid, and this offset is what keeps the disc from
    // intersecting the tessellated mesh underneath.
    const pivot = new THREE.Group();
    pivot.position.set(EX, EY, EZ).addScaledVector(normal, 0.012);

    // A teddy bear's button eye is a *flat* circle, not a bead. It reads as a
    // disc of dark felt or plastic sewn onto the fur — it bulges nothing, and
    // it has no depth to speak of.
    //
    // A thin cylinder with only 0.02 of depth, so its side wall is never
    // visible from the front.
    //
    // Orientation is done with a quaternion rather than Euler angles. The
    // cylinder's axis is +Y in its local space, so aligning that axis to the
    // surface normal is a single shortest-arc rotation — no gimbal case, and
    // no trigonometry to get wrong at the extremes.
    const align = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      normal,
    );

    const dome = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32), palette.ink);
    dome.scale.set(0.12, 0.02, 0.12);
    dome.quaternion.copy(align);
    dome.castShadow = false;
    // Never pickable: a stray click on an eye should not count as a head-pat,
    // and leaving it out of the hit list keeps the raycast cheap.
    dome.raycast = () => {};

    // Catchlight, up-and-outboard on both eyes. The key light sits at +x, +y
    // and +z relative to the character, so both buttons catch it on the same
    // side of the disc — mirroring the offset would put one highlight at the
    // inner corner and the other at the outer corner, and the mismatched pair
    // is what makes one eye read as wrong even when nothing else differs.
    const spark = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 16), palette.cream);
    spark.scale.set(0.034, 0.01, 0.034);
    spark.quaternion.copy(align);
    spark.raycast = () => {};
    // Offset within the disc's own plane, then raised a hair further out so
    // the highlight sits above the button rather than z-fighting with it.
    const inPlane = new THREE.Vector3(0.038, 0.044, 0).applyQuaternion(align);
    spark.position.copy(inPlane).addScaledVector(normal, 0.012);

    pivot.add(dome, spark);
    return { dome, spark, pivot };
  }

  return { L: make(-1), R: make(1) };
}
