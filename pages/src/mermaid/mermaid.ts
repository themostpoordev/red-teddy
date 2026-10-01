/**
 * The mermaid, assembled.
 *
 * Everything is positioned in ONE unit system where the head's radius is 1, so
 * every number here can be read against the head's dimensions without
 * conversion. That is what makes the proportions checkable: "the shoulder sits
 * at y = -1.5" is only meaningful next to "the head's radius is 1".
 *
 * THE ORDER OF ASSEMBLY
 *
 * Head, then body, then limbs hanging off the body. The body is built first
 * and the head placed on the neck after, because the neck position depends on
 * the torso's top and the head's bottom depends on the neck's length — so
 * defining them in the other order means solving for a value that already
 * exists.
 *
 * WHAT IS NOT HERE YET
 *
 * Hair, and the arms are bare. Both are deliberate omissions rather than
 * oversights: hair is the part that decides whether the silhouette reads as a
 * character or as a mannequin, and it is worth getting right on its own
 * rather than bolting on. The structure below is what they hang from.
 */

import * as THREE from "three";
import { createHead } from "./head";
import { createFaceMaterial } from "./face-marks";
import {
  createTorso,
  createLimb,
  armProfile,
  createTail,
  TORSO_TOP,
} from "./body";

export type Mermaid = {
  readonly group: THREE.Group;
  readonly head: THREE.Group;
  readonly torso: THREE.Group;
  readonly tail: THREE.Mesh;
  readonly armL: THREE.Group;
  readonly armR: THREE.Group;
  readonly material: THREE.ShaderMaterial;
};

const SKIN = "#ffe0cd";

export function createMermaid(): Mermaid {
  const group = new THREE.Group();
  const LIGHT = new THREE.Vector3(0.5, 0.8, 0.6).normalize();

  // --- body ------------------------------------------------------------
  const torso = createTorso();
  const tail = createTail();

  const material = createFaceMaterial(
    {
      sclera: [1.0, 0.973, 0.965],
      iris: [0.941, 0.725, 0.235],
      irisCore: [1.0, 0.914, 0.659],
      ink: [0.239, 0.122, 0.2],
      eyeX: 0.19,
      eyeY: -0.02,
      eyeW: 0.145,
      eyeH: 0.115,
      gaze: [0, 0],
      open: 1,
    },
    {
      color: SKIN,
      shadow: "#c08fa0",
      subsurface: "#ff8fa3",
      rim: "#ffd9f0",
      rimStrength: 0.9,
      rimPower: 3,
      fill: "#9fd8ff",
      fillAmount: 0.35,
      lightDir: LIGHT,
      specular: 0.3,
    },
  );

  torso.mesh.material = material;
  tail.material = material;

  // --- head ------------------------------------------------------------
  const head = createHead(1);
  head.mesh.material = material;

  // The neck, and the head on top of it.
  //
  // The head's radius is 1, so its chin sits at y = -1 from the head's centre.
  // The torso's profile now tops out at TORSO_TOP, so the head's centre has to
  // be a full radius above that plus the neck's length — otherwise the chin
  // lands inside the shoulders and the figure appears to have no neck at all.
  //
  // The gap matters more than it looks: with the head low the whole figure
  // reads as a snowman, and no amount of work on the torso fixes it.
  const NECK = 0.3;
  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.19, NECK, 20),
    material,
  );
  neck.position.y = TORSO_TOP + NECK / 2 - 0.06;

  const headPivot = new THREE.Group();
  headPivot.position.set(0, TORSO_TOP + NECK + 0.94, 0.02);
  headPivot.add(head.group);
  head.group.position.set(0, 0, 0);

  group.add(torso.group, tail, neck, headPivot);

  // --- arms ------------------------------------------------------------
  // Hung from the shoulder, which the torso's profile puts at about y = 0.55
  // and x = +-0.36. The limb profiles are built downward from their origin,
  // so the pivot IS the shoulder and no offset is needed below it.
  function makeArm(side: number): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(side * 0.34, 0.5, 0);
    // A slight splay so the arms do not hang perfectly vertical — a figure
    // with arms at its sides reads as a mannequin in a shop window.
    pivot.rotation.z = side * 0.14;

    const limb = createLimb(armProfile());
    limb.material = material;
    pivot.add(limb);
    return pivot;
  }

  const armL = makeArm(-1);
  const armR = makeArm(1);
  group.add(armL, armR);

  return {
    group,
    head: headPivot,
    torso: torso.group,
    tail,
    armL,
    armR,
    material,
  };
}