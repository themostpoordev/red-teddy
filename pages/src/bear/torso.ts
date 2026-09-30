/**
 * The torso: the body mass and the belly.
 *
 * Two meshes, not one. The belly is separate specifically so the animation can
 * squash it on its own — a patch texture on the torso would have to deform the
 * whole body, and a bear being squeezed should bulge, not shrink.
 */

import * as THREE from "three";
import { part, type PartContext } from "./parts";
import { BELLY, TORSO } from "./proportions";

export type Torso = {
  readonly group: THREE.Group;
  readonly torso: THREE.Mesh;
  readonly belly: THREE.Mesh;
};

export function createTorso(ctx: PartContext): Torso {
  const { geometry, palette } = ctx;

  const group = new THREE.Group();

  const torso = part(ctx, geometry.sphere, palette.fur, TORSO.scale, TORSO.at);
  const belly = part(ctx, geometry.sphere, palette.cream, BELLY.scale, BELLY.at);

  group.add(torso, belly);

  return { group, torso, belly };
}
