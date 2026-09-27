/**
 * The face: eyes, blush and mouth.
 *
 * These three are the character's expression and its whole personality, and
 * they are grouped together because they share a constraint the rest of the
 * body does not have — all three sit on the skull's curved surface, so all
 * three have to be placed by the normal rule in ellipsoid.ts rather than at a
 * guessed z and rotation.
 *
 * A deliberate absence: the mouth never changes. Not its size, not its shape,
 * not its visibility. It is one fixed mesh and the animation does not touch
 * it.
 *
 * That is not an oversight to be revisited. Earlier versions swapped to a
 * larger mouth on a head-pat, which read as the face distorting rather than as
 * an expression — the user saw the mouth inflate under their finger. The pat
 * is already carried by the hearts, the raised arms and the head tilt, and a
 * feature that stays put is what makes the rest of the reactions legible. If
 * a future change wants an expression here, the honest route is a *second*
 * mouth that swaps in, not a scaling of this one.
 */

import * as THREE from "three";
import { part, layFlat, type PartContext } from "./parts";
import { surfaceAt, type Ellipsoid } from "./ellipsoid";
import { BLUSH, EYE, MOUTH, SEGMENTS } from "./proportions";
import type { Palette } from "./style";

export type Pupil = {
  /** The button. Squashed vertically to blink. */
  readonly dome: THREE.Mesh;
  /** The catchlight sitting on it. */
  readonly spark: THREE.Mesh;
  readonly pivot: THREE.Group;
};

export type Face = {
  readonly eyeL: Pupil;
  readonly eyeR: Pupil;
  readonly blushL: THREE.Mesh;
  readonly blushR: THREE.Mesh;
  readonly mouth: THREE.Mesh;
  /** Everything on the face, for pick-testing. */
  readonly pickables: THREE.Mesh[];
};

export function createFace(
  ctx: PartContext,
  palette: Palette,
  skull: Ellipsoid,
): Face {
  const pickables: THREE.Mesh[] = [];

  // --- eyes ------------------------------------------------------------
  // A teddy bear's eye is a *button*: a flat circle of dark felt or plastic
  // sewn onto the fur. It bulges nothing and has no depth to speak of. That
  // is not a style preference — it is what removes a whole class of bug.
  //
  // A dark sphere floating in front of a white sclera was tried first and
  // failed three ways: the pupil escaped the eyeball under any rotation, a
  // shrunken iris stayed visible on a closed lid, and the white sclera itself
  // made it read as a face rather than a toy. A button has no iris to escape
  // and no sclera to z-fight with — it is one dark form whose only job is to
  // catch a highlight.
  function makeEye(side: number): Pupil {
    const { position, normal } = surfaceAt(skull, side * EYE.x, EYE.y);

    // The pivot is the eye's own frame. Everything inside is positioned in it,
    // so tilting the eye at the surface is one rotation rather than two
    // angles that have to agree.
    const pivot = new THREE.Group();
    pivot.position.copy(position).addScaledVector(normal, EYE.lift);

    // A thin cylinder, so the button's side wall is never visible from the
    // front. Its local axis is +y, which is what layFlat orients to the normal.
    const align = new THREE.Quaternion().setFromUnitVectors(
      new THREE.Vector3(0, 1, 0),
      normal,
    );

    const dome = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, SEGMENTS.eyeDisc),
      palette.ink,
    );
    dome.scale.set(EYE.radius, EYE.halfDepth, EYE.radius);
    dome.quaternion.copy(align);
    dome.castShadow = false;
    // Never pickable: a stray click on an eye should not count as a head-pat,
    // and leaving it out of the hit list keeps the raycast cheap.
    dome.raycast = () => {};

    // Catchlight, up-and-outboard on BOTH eyes. The key light sits at +x, +y
    // and +z relative to the character, so both buttons catch it on the same
    // side of the disc — mirroring the offset would put one highlight at the
    // inner corner and the other at the outer, and the mismatched pair is what
    // makes one eye read as wrong even when nothing else differs.
    const spark = new THREE.Mesh(
      new THREE.CylinderGeometry(1, 1, 1, SEGMENTS.spark),
      palette.cream,
    );
    spark.scale.set(
      EYE.spark.radius,
      EYE.spark.halfDepth,
      EYE.spark.radius,
    );
    spark.quaternion.copy(align);
    spark.raycast = () => {};
    // Offset within the button's own plane, then raised a hair further out so
    // the highlight sits above the button rather than z-fighting with it.
    spark.position
      .set(EYE.spark.offset[0], EYE.spark.offset[1], 0)
      .applyQuaternion(align)
      .addScaledVector(normal, EYE.spark.lift);

    pivot.add(dome, spark);
    pickables.push(dome);
    return { dome, spark, pivot };
  }

  const eyeL = makeEye(-1);
  const eyeR = makeEye(1);

  // --- blush -----------------------------------------------------------
  // Two flat discs, the cheapest possible expression cue. See the file
  // header for why they have to obey the same normal rule as the eyes — an
  // earlier version floated them at a fixed z and they sat half-submerged in
  // the fur like a stain.
  //
  // Because the skull is symmetric in x, the two cheeks' surface points and
  // normals differ ONLY in the sign of their x component. So the derivation
  // runs once and the sign is flipped, rather than computing both sides and
  // hoping they agree. That is cheaper and it is exact.
  const { position, normal } = surfaceAt(skull, BLUSH.x, BLUSH.y);

  const blushGeo = new THREE.CircleGeometry(BLUSH.radius, SEGMENTS.blush);

  function makeBlush(side: number): THREE.Mesh {
    const sideNormal = normal.clone();
    sideNormal.x *= side;

    // No outline: a line around a blush reads as a hole punched in the cheek.
    const disc = part(
      ctx,
      blushGeo,
      palette.blush,
      [1, BLUSH.squash, 1],
      [0, 0, 0],
      false,
    );
    layFlat(disc, sideNormal, position.clone().setX(side * BLUSH.x), BLUSH.lift);
    return disc;
  }

  const blushL = makeBlush(-1);
  const blushR = makeBlush(1);

  // --- mouth -----------------------------------------------------------
  // A single arc, flipped so it opens upward into a smile. The geometry and
  // the arithmetic behind its numbers are documented at MOUTH in
  // proportions.ts; the short version is that `arc` is deliberately much less
  // than PI, because a true half-circle is the most curved shape available for
  // a given width and reads as a bucket.
  //
  // No outline either. The tube IS the line; an inverted hull around it would
  // just fatten the stroke and make the mouth look bitten out of the snout.
  const mouth = part(
    ctx,
    new THREE.TorusGeometry(
      MOUTH.radius,
      MOUTH.tube,
      SEGMENTS.mouthTube,
      SEGMENTS.mouthSweep,
      MOUTH.arc,
    ),
    palette.ink,
    [1, 1, 1],
    MOUTH.at,
    false,
  );

  // TorusGeometry sweeps from angle 0 — the +x axis — counterclockwise. It
  // does NOT centre the arc on the y axis, so an arc of A spans 0..A and its
  // midpoint sits at A/2, not at 90deg.
  //
  // With arc = PI that lands the midpoint at exactly 90deg, which is why a
  // half-torus came out symmetric without any correction and the flaw was
  // invisible. Any other arc does not: at 1.8546 rad the midpoint is 53deg,
  // a 37deg tilt, and the smile comes out visibly crooked with one corner
  // riding high.
  //
  // Rotating by (PI - A)/2 re-centres the midpoint on 90deg, so the two ends
  // land at the same height and the curve is symmetric about the vertical.
  // Then PI flips it from a rising arch (n) to a smile (u).
  //
  // Both rotations collapse to the original single PI when A is PI, so this
  // is a generalisation of the old value rather than a special case.
  mouth.rotation.z = (Math.PI - MOUTH.arc) / 2 + Math.PI;

  return {
    eyeL,
    eyeR,
    blushL,
    blushR,
    mouth,
    pickables,
  };
}
