/**
 * The black cat.
 *
 * Built entirely from ellipsoids and lathed profiles, and that is not a
 * shortcut — a cat genuinely is a stack of soft ovoids. What makes one an
 * animal and the other a teddy bear is not the shapes but the ratios and
 * angles in proportions.ts, and every one of them is commented there.
 *
 * WHY NOTHING IS SHARED WITH THE BEAR
 *
 * They look like they could share a lot of code, and they cannot. The bear is
 * built for one head and one body; the cat for one head, one sitting body, and
 * a tail that moves. They need different proportions, different poses, and
 * different interactions. An earlier attempt shared the bear's module
 * directory and produced something that was neither, so this is separate on
 * purpose rather than by accident.
 *
 * THE COAT IS NOT BLACK
 *
 * A true black in a shaded scene is a hole in the picture: there is nothing
 * for the eye to read form from, and the character becomes a silhouette. The
 * coat here is lifted well off zero, and the scene's rim light is what
 * actually separates it from the page behind it. On a black cat, almost all
 * of the modelling you can see is reflection.
 */

import * as THREE from "three";
import {
  HEAD,
  EYE,
  EAR,
  TORSO,
  LEG,
  TAIL,
  WHISKER,
  INK,
  COAT,
  COAT_LIT,
  OUTLINE,
} from "./proportions";
import { toon, attachOutline } from "../bear/style";
import { damp } from "../core/math";

export type CatRig = {
  readonly group: THREE.Group;
  /** The head node, at the neck, so a tilt swings the head. */
  readonly head: THREE.Group;
  /** The tail's chain root. */
  readonly tail: THREE.Group;
  readonly earL: THREE.Group;
  readonly earR: THREE.Group;
  /** Everything a pointer can hit. */
  readonly pickables: THREE.Mesh[];
  /** Blink. 1 open, 0 shut. */
  setEyesOpen(amount: number): void;
  /** Look around, -1..1 per axis. The eyes move; the head does not. */
  look(x: number, y: number): void;
  /**
   * Turn the head toward a point, -1..1 per axis.
   *
   * Separate from `look` because they are different responses with different
   * speeds. The eyes track fast and precisely; the head follows slowly and
   * loosely and lags behind them. Driving both from one value makes a head
   * that turns exactly as far and as fast as the eyes — which has no mass
   * behind it and reads as a cursor rather than as an animal.
   */
  turnHead(x: number, y: number): void;
  /**
   * Advance every internal easing toward its target. Called once per frame by
   * the page, which owns the clock; the rig never reads time itself.
   */
  update(dt: number): void;
  /** Where the cat is actually looking, -1..1 per axis. */
  readonly gaze: { x: number; y: number };
};

export function createCat(): CatRig {
  const pickables: THREE.Mesh[] = [];
  const group = new THREE.Group();

  // Only the two materials the cat actually uses. The bear's `createPalette`
  // builds seven — fur, deep fur, cream, ink, blush, heart and outline — and
  // calling it here would allocate six of them for nothing and then throw
  // five away, while making it look as though the cat borrows the bear's
  // palette. Sharing `toon()` is the right seam: it is the shading model, and
  // the shading model is not what makes a character a character.
  const coat = toon(COAT);
  const coatLit = toon(COAT_LIT);
  const outlineMat = new THREE.MeshBasicMaterial({
    color: OUTLINE,
    side: THREE.BackSide,
  });

  function part(
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
      // The outline radius is the LARGEST axis, because that is the dimension
      // the eye reads a part's width from. Using a smaller one gives a flat
      // shape a proportionally much heavier line than a round one.
      attachOutline(mesh, INK, Math.max(...scale), outlineMat);
    }
    pickables.push(mesh);
    return mesh;
  }

  const sphere = new THREE.SphereGeometry(1, 40, 28);
  const capsule = new THREE.CapsuleGeometry(1, 1, 8, 24);

  // --- body --------------------------------------------------------------
  const body = new THREE.Group();
  group.add(body);

  const torso = part(sphere, coat, TORSO.scale, TORSO.at);
  body.add(torso);

  const chest = part(sphere, coatLit, TORSO.chest.scale, TORSO.chest.at, false);
  body.add(chest);

  // The haunches. These sit on the GROUND and are the widest part of a
  // sitting cat — without them the figure looks like a standing one that has
  // been squashed, because a sitting cat's mass is all at floor level.
  const haunchL = part(sphere, coat, TORSO.haunch.scale, [
    -TORSO.haunch.at[0],
    TORSO.haunch.at[1],
    TORSO.haunch.at[2],
  ]);
  const haunchR = part(sphere, coat, TORSO.haunch.scale, [
    TORSO.haunch.at[0],
    TORSO.haunch.at[1],
    TORSO.haunch.at[2],
  ]);
  body.add(haunchL, haunchR);

  // --- head --------------------------------------------------------------
  const head = new THREE.Group();
  head.position.set(...HEAD.at);
  body.add(head);

  const skull = part(sphere, coat, HEAD.scale, [0, 0, 0]);
  head.add(skull);

  const muzzle = part(sphere, coatLit, HEAD.muzzle.scale, HEAD.muzzle.at, false);
  head.add(muzzle);

  const nose = part(sphere, coatLit, HEAD.nose.scale, HEAD.nose.at, false);
  head.add(nose);

  // --- ears --------------------------------------------------------------
  // A lathe, not a cone. A cone is a spike and a spike reads as an antenna;
  // this widens from a narrow base, bulges, and comes to a soft point, which
  // is the shape a real ear has.
  const earGeo = new THREE.LatheGeometry(
    EAR.profile.map(([r, h]) => new THREE.Vector2(r, h)),
    18,
  );
  earGeo.scale(1, 1, EAR.depth);

  function makeEar(side: number): THREE.Group {
    const pivot = new THREE.Group();
    pivot.position.set(side * EAR.at[0], EAR.at[1], EAR.at[2]);
    // Splayed outward so the ears are not parallel, which reads as alert
    // rather than as antennae.
    pivot.rotation.z = -side * EAR.tilt;

    pivot.add(part(earGeo, coat, [1, 1, 1], [0, 0, 0]));

    // The inner ear, the darkest thing on the cat. A pink inner ear would
    // make this a cat-shaped sticker.
    pivot.add(
      part(earGeo, new THREE.MeshBasicMaterial({ color: "#14111c" }), [
        0.58,
        0.8,
        0.55,
      ], [0, 0.04, 0.09], false),
    );
    return pivot;
  }

  const earL = makeEar(-1);
  const earR = makeEar(1);
  head.add(earL, earR);

  // --- eyes --------------------------------------------------------------
  // White sclera with a black slit pupil. The slit is the point: a round pupil
  // in a white is a cartoon character, a narrow vertical one is a cat.
  //
  // Positioned as a FRACTION of the skull's own semi-axes rather than as fixed
  // numbers, so resizing the head carries the face with it. And the eye sits
  // forward and high, because a cat's eyes face forward for binocular vision
  // where a bear's sit to the sides.
  const whiteGeo = new THREE.CircleGeometry(EYE.radius, 32);
  const slitGeo = new THREE.PlaneGeometry(
    EYE.pupil[0] * 2,
    EYE.pupil[1] * 2,
  );
  const whiteMat = new THREE.MeshBasicMaterial({ color: "#f6f1e8" });
  const slitMat = new THREE.MeshBasicMaterial({ color: "#0d0a12" });

  type EyeParts = { white: THREE.Mesh; slit: THREE.Mesh };

  function makeEye(side: number): EyeParts {
    const ex = side * EYE.x * HEAD.scale[0];
    const ey = EYE.y * HEAD.scale[1];
    const [sx, sy, sz] = HEAD.scale;

    // Where the skull's surface is at that point, and its normal there. A flat
    // disc laid on a sphere at a fixed z sinks at the edges — the disc's outer
    // ends go under the fur while its centre floats clear, which reads as a
    // sticker half-buried in the face. Laying it along the normal is the whole
    // fix, and it is the same rule the bear's eyes follow.
    const unitZ = Math.sqrt(Math.max(0, 1 - (ex / sx) ** 2 - (ey / sy) ** 2));
    const nx = ex / sx ** 2;
    const ny = ey / sy ** 2;
    const nz = unitZ / sz ** 2;
    const len = Math.hypot(nx, ny, nz);

    const pivot = new THREE.Group();
    pivot.position.set(ex, ey, unitZ * sz + 0.008);
    pivot.quaternion.setFromUnitVectors(
      new THREE.Vector3(0, 0, 1),
      new THREE.Vector3(nx / len, ny / len, nz / len),
    );

    const white = new THREE.Mesh(whiteGeo, whiteMat);
    white.renderOrder = 2;
    pivot.add(white);

    // The slit, lifted a hair further forward so it does not z-fight with the
    // white it sits on.
    const slit = new THREE.Mesh(slitGeo, slitMat);
    slit.position.z = 0.004;
    slit.renderOrder = 3;
    pivot.add(slit);

    head.add(pivot);
    return { white, slit };
  }

  const eyeL = makeEye(-1);
  const eyeR = makeEye(1);

  // --- front legs --------------------------------------------------------
  // Straight vertical columns. A cat's front leg is very nearly a cylinder
  // from shoulder to paw, and giving it a taper or an elbow makes it read as
  // an arm.
  function makeLeg(side: number): THREE.Group {
    const g = new THREE.Group();
    g.position.set(side * LEG.at[0], LEG.at[1], LEG.at[2]);

    g.add(part(capsule, coat, LEG.scale, [0, 0, 0]));
    g.add(part(sphere, coatLit, LEG.paw.scale, LEG.paw.at, false));
    body.add(g);
    return g;
  }
  makeLeg(-1);
  makeLeg(1);

  // --- whiskers ----------------------------------------------------------
  // Three a side, fanning off the muzzle. A smooth face with no whiskers looks
  // unfinished even when everything else is right — they are as much a part
  // of the silhouette as the ears are.
  const whiskerMat = new THREE.LineBasicMaterial({ color: WHISKER.color });
  for (const side of [-1, 1]) {
    for (let i = 0; i < WHISKER.count; i++) {
      // Spread the whiskers across the vertical range: -0.5 at the top one to
      // +0.5 at the bottom, so the fan is symmetric about the muzzle rather
      // than all leaning the same way.
      const t = i / (WHISKER.count - 1) - 0.5;
      const geo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(
          side * WHISKER.at[0],
          WHISKER.at[1],
          WHISKER.at[2],
        ),
        new THREE.Vector3(
          side * (WHISKER.at[0] + WHISKER.length * Math.cos(t * WHISKER.spread * 3)),
          WHISKER.at[1] + t * WHISKER.length * 0.55,
          WHISKER.at[2] + WHISKER.length * Math.sin(t * WHISKER.spread * 3) * 0.5,
        ),
      ]);
      head.add(new THREE.Line(geo, whiskerMat));
    }
  }

  // --- tail --------------------------------------------------------------
  // A CHAIN of short segments rather than one swept curve, because the
  // interaction is dragging it: a fixed curve can only be posed at fixed
  // angles, while a chain can be pulled, whipped and let settle. That
  // difference is the whole reason it is built this way.
  const tail = new THREE.Group();
  tail.position.set(...TAIL.root);
  group.add(tail);

  const tailJoints: THREE.Group[] = [];
  const tailSegGeo = new THREE.CapsuleGeometry(1, 1, 6, 16);
  let parent: THREE.Object3D = tail;

  for (let i = 0; i < TAIL.segments; i++) {
    const joint = new THREE.Group();
    // The curl tapers down along the chain so the tip loosens and the base
    // holds its curve — an even curl throughout makes the tail look wound.
    joint.rotation.z = TAIL.swing * TAIL.curl * (1 - i / TAIL.segments) * 0.9;
    parent.add(joint);

    // The radius falls along the tail, so it is thick at the root and nearly
    // a point at the tip. A constant radius reads as a snake.
    const t = i / (TAIL.segments - 1);
    const r = THREE.MathUtils.lerp(TAIL.radius[0], TAIL.radius[1], t);
    const len = TAIL.segment;
    joint.add(part(tailSegGeo, coat, [r, len / 2, r], [0, -len / 2, 0]));

    tailJoints.push(joint);
    parent = joint;
  }

  // --- expression --------------------------------------------------------
  const setEyesOpen = (amount: number): void => {
    const a = THREE.MathUtils.clamp(amount, 0.05, 1);
    // A cat blinks by squeezing the eye vertically, and the pupil narrows with
    // it. Scaling the pupil alone leaves a wide slit sitting in a shut eye.
    for (const e of [eyeL, eyeR]) {
      e.white.scale.y = a;
      e.slit.scale.y = Math.max(a * 0.92, 0.06);
    }
  };

  // Where the pointer is asking the eyes to go, and where they have smoothed
  // to. Kept apart so `update` can ease one toward the other; collapsing them
  // means the eyes snap instead of tracking, and a snapping eye reads as a
  // cursor.
  const gazeTarget = new THREE.Vector2(0, 0);
  /** Read back by the page, so it can decide what to do with the gaze. */
  const gaze = { x: 0, y: 0 };
  /** Where the head is being asked to turn. */
  const headTarget = new THREE.Vector2(0, 0);

  const look = (x: number, y: number): void => {
    // The slit moves inside the white and stays inside it, so the gaze can
    // travel without the pupil ever leaving the eye.
    const dx = THREE.MathUtils.clamp(x, -1, 1) * EYE.gaze;
    const dy = THREE.MathUtils.clamp(y, -1, 1) * EYE.gaze;
    for (const e of [eyeL, eyeR]) {
      e.slit.position.x = dx;
      e.slit.position.y = dy;
    }
    gazeTarget.set(THREE.MathUtils.clamp(x, -1, 1), THREE.MathUtils.clamp(y, -1, 1));
  };

  const turnHead = (x: number, y: number): void => {
    // Positive y is DOWN in screen terms, and tipping the head down is a
    // positive rotation about x — so the sign is NOT inverted here.
    headTarget.set(
      THREE.MathUtils.clamp(x, -1, 1) * 0.42,
      THREE.MathUtils.clamp(y, -1, 1) * 0.2,
    );
  };

  const update = (dt: number): void => {
    // The eyes ease at 9 and the head at 3 — a third of the speed. That ratio
    // is the weight: a heavy head arrives late and settles, and the lag
    // between the two is what separates an animal from a cursor.
    gaze.x = damp(gaze.x, gazeTarget.x, 9, dt);
    gaze.y = damp(gaze.y, gazeTarget.y, 9, dt);
    head.rotation.y = damp(head.rotation.y, headTarget.x, 3, dt);
    head.rotation.x = damp(head.rotation.x, headTarget.y, 3, dt);
  };

  setEyesOpen(1);

  return {
    group,
    head,
    tail,
    earL,
    earR,
    pickables,
    setEyesOpen,
    look,
    turnHead,
    update,
    gaze,
  };
}
