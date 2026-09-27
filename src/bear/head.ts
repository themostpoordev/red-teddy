/**
 * The head: the group, the skull, the muzzle and the nose.
 *
 * The face — eyes, blush, mouth — is built separately in face.ts. It is split
 * out because the face is the part with its own placement rule (everything on
 * it has to sit on a surface normal, see ellipsoid.ts) and its own history of
 * getting that wrong. Keeping it separate means the head file stays about the
 * head's *form* and the face file stays about its *marks*.
 *
 * The head node sits at the neck, not at the centre of the skull. That is what
 * makes a head tilt read as a tilt rather than as a wobble — the head swings
 * about the joint under it, the way a real one does.
 */

import * as THREE from "three";
import { part, type PartContext } from "./parts";
import { createFace, type Face } from "./face";
import { ellipsoid } from "./ellipsoid";
import { HEAD, MUZZLE, NOSE } from "./proportions";

export type Head = {
  readonly group: THREE.Group;
  /** The skull mesh — the hit target for a head-pat. */
  readonly skull: THREE.Mesh;
  readonly muzzle: THREE.Mesh;
  readonly nose: THREE.Mesh;
  readonly face: Face;
};

export function createHead(ctx: PartContext): Head {
  const { geometry, palette } = ctx;

  const group = new THREE.Group();
  group.position.set(...HEAD.at);

  const skull = part(
    ctx,
    geometry.sphere,
    palette.fur,
    HEAD.skull,
    HEAD.skullAt,
  );

  // Muzzle: one cream sphere, wide and low, whose top edge sits *under* the
  // nose. A separate snout floating in front of the face reads as a second,
  // unrelated object stuck to the muzzle — the user described exactly that
  // ("it looks like a different part").
  const muzzle = part(
    ctx,
    geometry.sphere,
    palette.cream,
    MUZZLE.scale,
    MUZZLE.at,
  );

  // Sits on the muzzle's front-top, overlapping it, so the two read as one
  // form rather than as a nose balanced on a snout.
  const nose = part(
    ctx,
    geometry.smallSphere,
    palette.ink,
    NOSE.scale,
    NOSE.at,
  );

  group.add(skull, muzzle, nose);

  // The face needs the skull's *shape*, not the mesh, to find the surface — it
  // solves for the height and normal analytically rather than raycasting.
  const face = createFace(ctx, palette, ellipsoid(HEAD.skullAt, HEAD.skull));

  group.add(face.eyeL.pivot, face.eyeR.pivot, face.blushL, face.blushR, face.mouth);

  return { group, skull, muzzle, nose, face };
}
