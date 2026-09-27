/**
 * The bear: assembles the character and exposes the rig the animation drives.
 *
 * Built entirely from spheres, capsules and one torus. Rounded, overlapping
 * volumes read as a soft toy at any angle and cost almost nothing — a single
 * SphereGeometry is reused for every part, so the whole character is about
 * twenty draw calls plus their outline hulls.
 *
 * Layout, and why it is split this way:
 *
 *   proportions.ts  every number that defines the character's shape
 *   style.ts        toon shading, palette, the ink outline
 *   parts.ts        the shared geometry and the part() factory
 *   ellipsoid.ts    how to lay a flat mark on a curved surface
 *   torso.ts        body and belly
 *   head.ts         the head group, the muzzle, the nose
 *   face.ts         the marks on the face — eyes, blush, mouth
 *   limbs.ts        arms, legs, ears
 *   index.ts        this file
 *
 * Two rules make the split worth having.
 *
 * Every dimension lives in proportions.ts. Tuning a character otherwise means
 * grepping construction code to find the one number that moved, and the numbers
 * are interdependent in ways invisible unless they sit side by side — the arm
 * angle only makes sense against the torso's width, the eye's x against the
 * skull's radius.
 *
 * Everything animatable is named in the `rig` rather than found by traversing
 * the graph. Reactions then address parts in O(1) and the tree can be
 * restructured without breaking them.
 *
 * The hierarchy is root → body → { torso, head, limbs }. Root moves when the
 * bear is dragged or hops; body carries squash, stretch and lean so those
 * compose; head carries the face and its own tilt.
 */

import * as THREE from "three";
import { createGeometry, type PartContext } from "./parts";
import { createPalette, type Palette } from "./style";
import { createTorso } from "./torso";
import { createHead } from "./head";
import { createLimbs } from "./limbs";
import type { Pupil } from "./face";

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
  /** The squishy cream belly — the squash target and a hit region. */
  readonly belly: THREE.Mesh;
  /** The mouth. Present for completeness; nothing animates it. */
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

export function createBear(): Bear {
  const palette = createPalette();
  const pickables: THREE.Mesh[] = [];

  const ctx: PartContext = {
    geometry: createGeometry(),
    palette,
    pickables,
  };

  // --- tree ------------------------------------------------------------
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const { group: torsoGroup, belly } = createTorso(ctx);
  const { group: head, skull, face } = createHead(ctx);
  const { armL, armR, legL, legR, earL, earR } = createLimbs(ctx, palette);

  body.add(torsoGroup, head, armL, armR, legL, legR);
  // Ears mount on the head, not the body, so they travel with a head tilt.
  head.add(earL, earR);

  return {
    group: root,
    palette,
    position: root.position,
    height: 0,
    rig: {
      root,
      body,
      head,
      eyeL: face.eyeL,
      eyeR: face.eyeR,
      earL,
      earR,
      belly,
      mouth: face.mouth,
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

export type { Face, Pupil } from "./face";
export type { Palette } from "./style";
