/**
 * The bear.
 *
 * Built entirely from spheres, capsules and one torus. Rounded, overlapping
 * volumes read as a soft toy at any angle and cost almost nothing — a single
 * SphereGeometry is reused for every part, so the whole character is about
 * twenty draw calls plus their outline hulls.
 *
 * SEGMENTS are higher than they need to be for a silhouette-only character
 * (48x32 rather than 32x24). The reason is the outline hull: it is a scaled
 * copy of the same geometry, and at low segment counts the facets on the
 * hull are large enough to break the ink line into visible straight chords
 * around the head. The extra triangles are invisible in shading but obvious
 * in the outline, and the outline is the character's whole identity.
 *
 * Everything animatable is kept in the `rig` object rather than found by
 * traversing the graph. Reactions then address parts by name in O(1) and the
 * structure can change without breaking them.
 *
 * Rig nodes are positioned so that rotations pivot where a real joint would
 * be: the head node sits at the neck, so a head tilt rotates about the neck
 * rather than the centre of the skull, and the arm nodes sit at the shoulder.
 */

import * as THREE from "three";
import { attachOutline, createPalette, type Palette } from "./materials";
import { createEyes, type Pupil } from "./eyes";

export type BearRig = {
  /** Root — moves when the user drags the bear or it hops to a new spot. */
  readonly root: THREE.Group;
  /** Squash/stretch and lean are applied here so they compose. */
  readonly body: THREE.Group;
  readonly head: THREE.Group;
  readonly eyeL: Pupil;
  readonly eyeR: Pupil;
  readonly earL: THREE.Group;
  readonly earR: THREE.Group;
  /** The squishy cream belly — the drag target. */
  readonly belly: THREE.Mesh;
  /** The mouth — a single fixed mesh, never animated. */
  readonly mouth: THREE.Mesh;
  readonly armL: THREE.Group;
  readonly armR: THREE.Group;
  readonly legL: THREE.Group;
  readonly legR: THREE.Group;
  /** Meshes that count as "the bear" for raycasting. */
  readonly pickables: THREE.Mesh[];
  /** Named sub-regions for interaction hit-testing. */
  readonly headHit: THREE.Mesh;
  readonly bellyHit: THREE.Mesh;
};

export type Bear = {
  readonly rig: BearRig;
  readonly group: THREE.Group;
  readonly palette: Palette;
  /** Current world-space position of the root. */
  readonly position: THREE.Vector3;
  /** Height above the floor, driven by the hop animation. */
  height: number;
};

/**
 * Ink line width, in world units, at the character's rest scale.
 *
 * Absolute rather than proportional so every part carries the same weight of
 * line — see attachOutline. At 0.024 this reads as roughly 2-3px on a 1440px
 * desktop, which is a pen line rather than a drawn border. Anything past 0.035
 * stops looking like ink and starts looking like a stroke around the shape.
 */
const INK = 0.024;

export function createBear(): Bear {
  const palette = createPalette();
  const pickables: THREE.Mesh[] = [];

  // --- shared geometry -------------------------------------------------
  // 48x32 is the smallest count where the outline hull stays smooth on the
  // head. See the note at the top of the file.
  const sphere = new THREE.SphereGeometry(1, 48, 32);
  const smallSphere = new THREE.SphereGeometry(1, 28, 20);
  const capsule = new THREE.CapsuleGeometry(1, 1, 10, 28);

  /**
   * Final world size on each axis. The outline radius is the largest axis,
   * since that is the width the eye reads the part from — a smaller choice
   * gives a flat, wide shape like the belly a heavier line than a round one.
   */
  function part(
    geometry: THREE.BufferGeometry,
    material: THREE.Material,
    scale: [number, number, number],
    position: [number, number, number],
    outlined = true,
  ): THREE.Mesh {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.scale.set(...scale);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    if (outlined) {
      // The outline radius is the LARGEST axis, because that is the dimension
      // the eye reads the part's width from. Using anything smaller makes a
      // flat, wide shape — the belly — come out with a proportionally much
      // heavier line than a round one, which is the opposite of how a
      // cartoonist weights an ink line.
      const radius = Math.max(...scale);
      attachOutline(mesh, INK, radius, palette.outline);
    }
    pickables.push(mesh);
    return mesh;
  }

  // --- root and body ---------------------------------------------------
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  // --- torso -----------------------------------------------------------
  // Narrower than it is tall, and wider than deep. A spherical torso swallows
  // the shoulders, and then the arms have nowhere to attach — they read as
  // fins stuck on the side rather than limbs coming out of the body. The
  // slight x-over-z excess gives the shoulders a surface to sit on while
  // keeping the belly from looking barrel-chested.
  const torso = part(sphere, palette.fur, [0.78, 0.86, 0.64], [0, 0.98, 0]);

  // The belly is a separate mesh rather than a patch on the torso so it can
  // be squashed on its own without deforming the whole body.
  const belly = part(sphere, palette.cream, [0.5, 0.58, 0.34], [0, 0.9, 0.5]);
  body.add(torso, belly);

  // --- head ------------------------------------------------------------
  // Node at the neck, so a tilt swings the head rather than spinning it.
  const head = new THREE.Group();
  head.position.set(0, 1.72, 0.04);
  body.add(head);

  const skull = part(sphere, palette.fur, [0.66, 0.6, 0.6], [0, 0.3, 0]);
  head.add(skull);

  // Muzzle: one cream sphere, wide and low, whose top edge sits *under* the
  // nose. The previous build floated a separate snout in front of the face,
  // which read as a second, unrelated object stuck to the muzzle.
  const muzzle = part(sphere, palette.cream, [0.36, 0.28, 0.26], [0, 0.16, 0.44]);
  head.add(muzzle);

  // Nose sits on the front-top of the muzzle, overlapping it, so the two
  // read as one form.
  const nose = part(smallSphere, palette.ink, [0.1, 0.075, 0.08], [0, 0.27, 0.62]);
  head.add(nose);

  // A teddy bear's mouth is a *shallow* curve, not a deep bowl. The previous
  // arc used radius 0.15 against a 0.038 tube, so the visible curve dropped
  // 0.15 below its ends — a deep U that read as a bucket, not a smile. A real
  // bear's mouth spans about the width of the muzzle with a dip of maybe a
  // fifth of that width, so the radius has to be several times the tube's
  // own thickness.
  //
  // TorusGeometry with arc = PI sweeps from +x, up through +y, to -x. That is
  // an arch — ∩ — with the ends low and the middle high. Rotating PI about z
  // flips it to ∪: ends high, middle low. That is a smile.
  //
  // Because of the flip, the two numbers that matter are read like this:
  //
  //   arc ends   at  y = node_y
  //   arc middle at  y = node_y - radius
  //
  // At radius 0.15 the dip landed at 0.05, deep under the nose. At 0.115 with
  // the node at 0.17, the dip is at 0.055 and the curve is visibly shallower
  // for a mouth of the same width.
  //
  // The 0.115 is also what keeps cream visible at the corners. The muzzle is
  // 0.36 across; an arc that wide leaves almost nothing showing on either
  // side, and the mouth reads as a slot cut into the snout. At this radius
  // roughly 0.12 of muzzle remains at each corner, which is what makes it
  // look like a mouth drawn *on* a snout rather than a mouth replacing one.
  //
  // Depth: the muzzle is centred at z = 0.44 with a 0.26 radius, so its front
  // face reaches 0.70. At 0.66 the arc sits just proud of that. Because the
  // muzzle is convex, the arc's ends (further out in x) naturally fall
  // slightly behind its centre — which is exactly right, since a real smile
  // curves around the form of the snout rather than floating flat in front.
  const mouth = part(
    new THREE.TorusGeometry(0.115, 0.034, 10, 26, Math.PI),
    palette.ink,
    [1, 1, 1],
    [0, 0.17, 0.66],
    false,
  );
  mouth.rotation.z = Math.PI;
  head.add(mouth);

  // Blush: two flat discs, the cheapest possible expression cue.
  //
  // These have to obey the same rule as the eyes, and an earlier version did
  // not. A CircleGeometry lies in the XY plane facing +z, so placing it at a
  // fixed z and merely rotating it a guessed amount leaves the disc's lower
  // and outer edges inside the fur — the blush looked like a stain half
  // submerged in the cheek.
  //
  // The fix is identical to the eyes': evaluate the skull's surface height
  // and its normal at the blush's own x and y, then lay the disc on that
  // normal. The skull is an ellipsoid centred at (0, 0.3, 0) with radii
  // (0.66, 0.6, 0.6), so for a point (x, y):
  //   z = 0.6 * sqrt(1 - (x/0.66)^2 - ((y - 0.3)/0.6)^2)
  //   n = normalize(x/0.66^2, (y - 0.3)/0.6^2, z/0.6^2)
  //
  // At x = 0.44, y = 0.2 the surface is at z = 0.53 and the normal leans
  // about 29 degrees off-axis. Sitting the disc on that normal is what makes
  // it flush instead of buried.
  const BLUSH_X = 0.44;
  const BLUSH_Y = 0.2;
  const BLUSH_Z =
    0.6 * Math.sqrt(1 - (BLUSH_X / 0.66) ** 2 - ((BLUSH_Y - 0.3) / 0.6) ** 2);
  // Computed once for +x and mirrored for -x: the ellipsoid is symmetric in
  // x, so only the x component of the normal changes sign between the two
  // cheeks. Anything more would be inventing an asymmetry the head does not
  // have.
  const blushNormalR = new THREE.Vector3(
    BLUSH_X / 0.66 ** 2,
    (BLUSH_Y - 0.3) / 0.6 ** 2,
    BLUSH_Z / 0.6 ** 2,
  ).normalize();

  const blushGeo = new THREE.CircleGeometry(0.15, 28);
  function makeBlush(side: number): THREE.Mesh {
    const normal = blushNormalR.clone();
    normal.x *= side;

    const disc = part(blushGeo, palette.blush, [1, 0.66, 1], [0, 0, 0], false);
    // CircleGeometry faces +z, so aim +z along the normal. A quaternion
    // avoids the Euler-angle ambiguity that made the original guesswork.
    disc.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal);
    disc.position
      .set(side * BLUSH_X, BLUSH_Y, BLUSH_Z)
      .addScaledVector(normal, 0.01);
    return disc;
  }
  head.add(makeBlush(-1), makeBlush(1));

  // --- eyes ------------------------------------------------------------
  // Each eye is three layers under one pivot: a cream sclera, a dark iris
  // that slides within it, and a catchlight. The pivot rotates to aim, the
  // iris slides to track, and the sclera squashes to blink — three separate
  // motions, so a blink mid-look never resets the gaze.
  const eyes = createEyes(palette);
  head.add(eyes.L.pivot, eyes.R.pivot);

  const eyeL = eyes.L;
  const eyeR = eyes.R;

  // --- ears ------------------------------------------------------------
  function makeEar(side: number): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.5, 0.6, -0.02);
    const outer = part(sphere, palette.fur, [0.22, 0.25, 0.13], [0, 0, 0]);
    const inner = part(sphere, palette.furDeep, [0.12, 0.14, 0.07], [side * 0.03, -0.01, 0.08], false);
    pivot.add(outer, inner);
    head.add(pivot);
    return pivot;
  }
  const earL = makeEar(-1);
  const earR = makeEar(1);

  // --- arms ------------------------------------------------------------
  // The torso is an ellipsoid: half-width 0.78, half-height 0.86, centred at
  // y = 0.98, so its surface at any height is
  //   x(y) = 0.78 * sqrt(1 - ((y - 0.98) / 0.86)^2)
  //
  // An earlier version put a sphere at the shoulder to bridge the gap between
  // arm and torso. It solved the gap and created a worse problem: a sphere
  // that large is a visible round bump on the silhouette, and once the outline
  // passes around it the character stops reading as a soft toy and starts
  // reading as a stack of primitives.
  //
  // The fix is to bury the limb instead. One capsule, long enough that its
  // upper end sits *inside* the torso, so the join is a limb passing into a
  // body rather than a ball stuck onto one. With the arm rotated out to
  // 0.33 rad, its top at local y = +0.12 lands at (0.62, 1.41); the torso
  // surface there is at x = 0.69, so roughly half the capsule width is hidden.
  //
  // The outward angle is arithmetic, not taste. Hanging straight down puts the
  // paw at x = 0.66, but the torso surface at the paw's height (y = 0.68) is
  // at x = 0.739 — the paw ends up inside the body showing only a crescent,
  // which reads as a stray bump. At 0.33 rad the paw reaches x = 0.86, clear
  // of that edge.
  function makeArm(side: number): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.62, 1.32, 0.16);
    // A downward limb swings toward +x under a positive z rotation, so the
    // left arm takes the negative angle to move further left.
    pivot.rotation.z = side * 0.33;

    // One continuous limb. The top of the capsule is the shoulder.
    const upper = part(capsule, palette.fur, [0.115, 0.3, 0.115], [0, -0.24, 0]);
    // The paw must be visibly WIDER than the limb it ends. A teddy bear's
    // mitten is a ball at least twice the arm's thickness — that contrast is
    // what reads as a hand rather than as the rounded cap of a tube. At 0.14
    // against an arm of 0.115 it was barely wider and read as a bead stuck
    // on the end; 0.19 is the ratio that reads as a mitten.
    const paw = part(sphere, palette.cream, [0.19, 0.2, 0.19], [0, -0.66, 0.02]);

    pivot.add(upper, paw);
    body.add(pivot);
    return pivot;
  }
  const armL = makeArm(-1);
  const armR = makeArm(1);

  // --- legs ------------------------------------------------------------
  function makeLeg(side: number): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.3, 0.5, 0.02);
    const leg = part(capsule, palette.fur, [0.2, 0.2, 0.2], [0, -0.16, 0]);
    const foot = part(sphere, palette.cream, [0.23, 0.17, 0.27], [0, -0.38, 0.08]);
    pivot.add(leg, foot);
    body.add(pivot);
    return pivot;
  }
  const legL = makeLeg(-1);
  const legR = makeLeg(1);

  return {
    group: root,
    palette,
    position: root.position,
    height: 0,
    rig: {
      root,
      body,
      head,
      eyeL,
      eyeR,
      earL,
      earR,
      belly,
      mouth,
      armL,
      armR,
      legL,
      legR,
      pickables,
      headHit: skull,
      bellyHit: belly,
    },
  };
}
