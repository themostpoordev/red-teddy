/**
 * What the cat does when touched.
 *
 * Two gestures, chosen because they are the two a cat actually invites:
 *
 *   touch the head  — it leans into your hand
 *   pull the tail   — the tail follows, and the cat turns to watch
 *
 * Both are read off the geometry rather than assumed. The head and the tail
 * are raycast as named parts, not as one "did they click the cat" test,
 * because a tap on the shoulder should not count as a head touch and a grab
 * at the tail should not fire both.
 *
 * THE TAIL IS A CHAIN, NOT A MESH
 *
 * The drag resolves which segment was grabbed and how far along it the grab
 * landed. That is what makes the gesture feel like it has a hinge: pulling at
 * the root moves the whole tail, pulling at the tip barely disturbs the base.
 * On a single rigid mesh both of those are the same gesture and neither feels
 * like anything.
 *
 * Each segment gets its own spring, so the tail lags behind the hand and
 * whips on release. A chain whose segments all move together reads as a stick
 * being dragged; a lagged one reads as weight.
 */

import * as THREE from "three";
import type { PointerHub } from "./core/pointer";
import type { CatRig } from "./cat";
import { clamp, damp } from "./core/math";

/** How far the head leans into a touch, in radians. */
const HEAD_LEAN = 0.3;
/** Easing rates for the head. In fast, out slow — a cat settles rather than
 *  snapping, and the slowness on release is most of what makes it read as a
 *  deliberate movement rather than a snap. */
const HEAD_IN = 4.5;
const HEAD_OUT = 1.7;

/** Stiffness and damping for each tail segment's spring. */
const TAIL_K = 90;
const TAIL_C = 11;

export type CatGestures = {
  /** Advance the smoothed pose. Called once per frame by the page. */
  update(dt: number): void;
  /** True while the tail is being held. */
  readonly holdingTail: boolean;
  dispose(): void;
};

export function createCatGestures(
  rig: CatRig,
  hub: PointerHub,
  camera: THREE.PerspectiveCamera,
): CatGestures {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  /** 1 while the head is being touched. */
  let headTarget = 0;
  let headLevel = 0;

  let holdingTail = false;
  /** Index of the grabbed joint in the chain. 0 is nearest the body. */
  let grabIndex = 0;
  /** 0 at the joint, 1 at the far end of its segment. */
  let grabAlong = 0.5;

  /**
   * Per-joint angular offset from the resting curl, and its rate.
   *
   * A spring rather than a direct set, so the chain lags and overshoots. The
   * velocity is what carries that: without it the tail tracks the hand
   * exactly and there is no whip on release.
   */
  const offsets = rig.tail.children.map(() => 0);
  const velocities = rig.tail.children.map(() => 0);

  /** Where the tail is being dragged to, in world space. */
  const dragTo = new THREE.Vector3();
  const scratch = new THREE.Vector3();

  const joints = rig.tail.children;

  function pickHead(): boolean {
    raycaster.setFromCamera(hub.ndc(ndc), camera);
    return raycaster.intersectObjects(rig.head.children, true).length > 0;
  }

  /**
   * Which joint a ray hits, and how far along that joint's segment.
   *
   * Joint by joint rather than all at once: a single raycast against the whole
   * chain returns whichever segment is nearest the camera and says nothing
   * about where along it the grab landed, which is the half of the gesture
   * that decides how much of the tail moves.
   */
  function pickTail(): { index: number; along: number } | null {
    raycaster.setFromCamera(hub.ndc(ndc), camera);
    for (let i = 0; i < joints.length; i++) {
      const hits = raycaster.intersectObject(joints[i], true);
      if (hits.length === 0) continue;
      const local = joints[i].worldToLocal(hits[0].point.clone());
      // The segment hangs downward from its joint, so local y runs negative
      // along its length.
      return { index: i, along: clamp(-local.y * 1.4 + 0.5, 0, 1) };
    }
    return null;
  }

  const unsubs: Array<() => void> = [];

  unsubs.push(
    hub.onPress(() => {
      if (pickHead()) {
        headTarget = 1;
        return;
      }
      const tail = pickTail();
      if (tail) {
        holdingTail = true;
        grabIndex = tail.index;
        grabAlong = tail.along;
      }
    }),
  );

  unsubs.push(
    hub.onDrag(() => {
      if (!holdingTail) return;
      // The drag happens on a plane facing the camera through the grabbed
      // joint, so the tail follows the cursor across the screen instead of
      // shooting backward in depth as the pointer moves.
      const anchor = joints[grabIndex].getWorldPosition(scratch);
      const normal = camera.getWorldDirection(new THREE.Vector3()).negate();
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, anchor);
      raycaster.setFromCamera(hub.ndc(ndc), camera);
      if (raycaster.ray.intersectPlane(plane, dragTo)) {
        // Recorded; the springs consume it in update().
      }
    }),
  );

  unsubs.push(
    hub.onRelease(() => {
      headTarget = 0;
      holdingTail = false;
    }),
  );

  const self: CatGestures = {
    holdingTail: false,

    update(dt) {
      // --- head ----------------------------------------------------------
      headLevel = damp(
        headLevel,
        headTarget,
        headTarget > headLevel ? HEAD_IN : HEAD_OUT,
        dt,
      );
      // The lean is a NOD, not a turn — the head drops toward the hand
      // rather than swivelling at it. A cat being touched on the head ducks
      // into it; it does not look around at the finger.
      rig.head.rotation.x = headLevel * HEAD_LEAN;
      // ...and a small turn toward it, so the face angles over as well. Both
      // together read as leaning in; either alone reads as a glitch.
      rig.head.rotation.y = headLevel * HEAD_LEAN * 0.55;

      // --- tail ----------------------------------------------------------
      for (let i = 0; i < joints.length; i++) {
        const joint = joints[i];

        if (holdingTail && i >= grabIndex) {
          // How much this joint is affected: zero at the grabbed one, rising
          // along the tail past it. A grab near the root therefore moves
          // everything, and a grab at the tip leaves the base alone.
          const reach = clamp((i - grabIndex) / 3, 0, 1);

          // The angle this joint would need to point at the drag position.
          // Measured against the joint's own world position, so it works
          // however the chain is curled.
          const here = joint.getWorldPosition(scratch);
          const wanted = Math.atan2(
            dragTo.x - here.x,
            THREE.MathUtils.clamp(dragTo.y - here.y, -0.4, 0.2),
          );

          // Ease the resting curl toward that, in proportion to how far past
          // the grab this joint is. `grabAlong` scales the whole gesture: a
          // grab at the very tip of a segment pulls less than one at its root.
          const pull = reach * (0.35 + grabAlong * 0.45);
          const goal = joint.rotation.z + (wanted - joint.rotation.z) * pull;

          velocities[i] += (goal - joint.rotation.z) * TAIL_K * dt;
        }

        // Damping always applies, so a released tail settles instead of
        // oscillating forever, and a held one stays calm rather than
        // ringing under the hand's movement.
        velocities[i] -= velocities[i] * TAIL_C * dt;
        offsets[i] += velocities[i] * dt;
        joint.rotation.z += offsets[i];
      }
    },

    dispose() {
      for (const off of unsubs) off();
      unsubs.length = 0;
    },
  };

  return self;
}
