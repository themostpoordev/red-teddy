/**
 * Limbs and ears: the four limbs, plus the two ears.
 *
 * Grouped because they are all the same kind of thing — a pivot that the
 * animation rotates, with one or two solid forms hanging off it. They differ
 * from the face in the constraint they have to satisfy, which is worth stating
 * because it drove the design.
 *
 * Every limb pivots at a real joint, not at its own centre. The arm's pivot is
 * the shoulder, so a raise rotates the arm *from the shoulder*; a pivot at the
 * middle of the limb would swing it like a pendulum and read as a broken
 * puppet.
 *
 * The arms also have to be *attached*, and that took three attempts:
 *
 *   1. Arms placed beside the torso left a visible gap.
 *   2. A sphere at the shoulder bridged the gap — and became a visible round
 *      bump on the silhouette. Once the outline passed around it, the
 *      character stopped reading as a soft toy and started reading as a stack
 *      of primitives. The user put it plainly: it looked Roblox.
 *   3. The fix is to bury the limb. One capsule, long enough that its upper
 *      end sits *inside* the torso, so the join is a limb passing into a body
 *      rather than a ball stuck onto one. No shoulder geometry at all.
 *
 * The arms' outward angle is arithmetic rather than taste, and the derivation
 * is at ARM in proportions.ts. Getting the SIGN wrong is invisible in code and
 * obvious on screen, so it is spelled out here too: a downward limb swings
 * toward +x under a positive z rotation, so the left arm — the one at negative
 * x — needs the negative angle to move further left. Assigning both by screen
 * position instead of by swing direction folds the arms into the torso.
 *
 * The ears are here rather than in face.ts because they are spheres seen
 * edge-on, not flat plates laid on the skull. That difference matters: a flat
 * plate needs the surface-normal treatment, and an ear does not. A plain
 * rotation is correct for it.
 */

import * as THREE from "three";
import { part, type PartContext } from "./parts";
import { ARM, EAR, LEG } from "./proportions";

export type Limbs = {
  readonly armL: THREE.Group;
  readonly armR: THREE.Group;
  readonly legL: THREE.Group;
  readonly legR: THREE.Group;
  readonly earL: THREE.Group;
  readonly earR: THREE.Group;
};

/** Arms and ears, which mount on the torso and the head respectively. */
export function createLimbs(
  ctx: PartContext,
  palette: PartContext["palette"],
): Limbs {
  const { geometry } = ctx;

  // --- arms ------------------------------------------------------------
  function makeArm(side: number): THREE.Group {
    const pivot = new THREE.Group();
    // `at[0]` is the character's HALF-width, so it is mirrored by side. The
    // other two axes are shared. Forgetting the mirror stacks both arms on
    // the same shoulder, which reads as one arm with a second growing out of
    // it — and it is invisible in code because the array looks complete.
    pivot.position.set(side * ARM.at[0], ARM.at[1], ARM.at[2]);
    pivot.rotation.z = side * ARM.rest;

    // One continuous limb. The top of the capsule is the shoulder, and it sits
    // inside the torso — see the file header.
    const upper = part(
      ctx,
      geometry.capsule,
      palette.fur,
      ARM.upper,
      ARM.upperAt,
    );
    const paw = part(
      ctx,
      geometry.sphere,
      palette.cream,
      ARM.paw,
      ARM.pawAt,
    );

    pivot.add(upper, paw);
    return pivot;
  }

  // --- legs ------------------------------------------------------------
  function makeLeg(side: number): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(side * LEG.at[0], LEG.at[1], LEG.at[2]);

    const upper = part(
      ctx,
      geometry.capsule,
      palette.fur,
      LEG.upper,
      LEG.upperAt,
    );
    // The foot is wider in z than the leg is, which is what makes it read as a
    // foot pointing at the viewer rather than as a rounded end-cap.
    const foot = part(ctx, geometry.sphere, palette.cream, LEG.foot, LEG.footAt);

    pivot.add(upper, foot);
    return pivot;
  }

  // --- ears ------------------------------------------------------------
  function makeEar(side: number): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(side * EAR.at[0], EAR.at[1], EAR.at[2]);

    const outer = part(ctx, geometry.sphere, palette.fur, EAR.outer, [0, 0, 0]);
    // The inner ear is the one place a second colour sits *on* another part
    // rather than replacing one, so it takes no outline — a line here would
    // trace over the outer ear's own.
    const inner = part(
      ctx,
      geometry.sphere,
      palette.furDeep,
      EAR.inner,
      [side * EAR.innerAt[0], EAR.innerAt[1], EAR.innerAt[2]],
      false,
    );

    pivot.add(outer, inner);
    return pivot;
  }

  return {
    armL: makeArm(-1),
    armR: makeArm(1),
    legL: makeLeg(-1),
    legR: makeLeg(1),
    earL: makeEar(-1),
    earR: makeEar(1),
  };
}
