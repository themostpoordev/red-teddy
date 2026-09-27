/**
 * Interaction: turning pointer events into reactions.
 *
 * Three hit regions are raycast separately — the head, the belly and the
 * floor — because they trigger different reactions.
 *
 * The head has two gestures, not one, and telling them apart is the whole
 * difficulty:
 *
 *   tap   — a press and release with almost no movement. A quick pat.
 *   pet   — a press that travels ALONG the head. A stroke.
 *
 * A pet is not a repeated tap. Someone stroking a bear moves slowly and
 * continuously; tapping means picking it out of the air. Firing the same
 * reaction for both makes the character feel like a button rather than
 * something being touched.
 *
 * The distinction is made on DISTANCE TRAVELLED, not speed. At 60fps one
 * frame is 16.7ms, and a real stroke across a head this size moves only a
 * few pixels per frame — far too little for a per-frame speed test to catch.
 * A slow, deliberate stroke is exactly the case such a test would miss, and
 * it is the case that most needs to work. So the travelled distance
 * accumulates from the press point until it crosses a fraction of the head's
 * width, and only then does the gesture become a pet.
 *
 * Distance is measured in SCREEN pixels rather than NDC, because NDC is
 * normalised and its scale changes with the viewport — a threshold in NDC
 * would mean something different on a phone than on a desktop. The head's
 * width is read from the DOM, which is the same space the pixel distances
 * live in, so the threshold tracks the actual size of the head on screen.
 *
 * The raycast is done against a small explicit list rather than the whole
 * scene. Beyond being cheaper, it is the only way to keep the outline hulls
 * out of the results.
 */

import * as THREE from "three";
import type { PointerHub } from "../core/pointer";
import type { Bear } from "../bear";
import type { Reactions } from "./reactions";
import type { Stage } from "./stage";

/** Beyond this radius from centre, a floor tap is treated as intentional. */
const HOP_RADIUS = 1.9;

/**
 * Screen fraction of the canvas width a press must travel before it counts as
 * a pet rather than a tap.
 *
 * A tenth is deliberate: enough that a finger resting and wobbling a little
 * still registers as a tap, and small enough that a genuine stroke — which
 * crosses most of the head — reaches it in a fraction of a second.
 */
const PET_DISTANCE = 0.1;

export type Interactions = {
  dispose(): void;
};

export function createInteractions(
  stage: Stage,
  hub: PointerHub,
  bear: Bear,
  reactions: Reactions,
): Interactions {
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const hitPoint = new THREE.Vector3();

  let dragging = false;
  const dragOffset = new THREE.Vector3();
  const cursor = new THREE.Vector3();
  const unsubs: Array<() => void> = [];

  // --- head gesture tracking -------------------------------------------
  // A press starts as not-yet-a-pet and is resolved on release. Two booleans
  // rather than a three-state union: TypeScript narrows a union member
  // assigned inside a closure to the value it was last set to, and then
  // rejects a later comparison against a different member as impossible.
  // Two flags say exactly what is meant and stay checkable.
  let onHead = false;
  let isPet = false;
  // Where the press began, in client pixels, so distance can be measured
  // without accumulating per-frame deltas.
  const pressAt = new THREE.Vector2();
  // Furthest the pointer has strayed from the press point, kept separately
  // from the path length so a jittery finger that returns to its start is
  // still classified as movement rather than as "never left".
  let petTravel = 0;

  /**
   * How many pixels the pointer must cover to count as a stroke.
   *
   * Read from the canvas rather than the head mesh, because a THREE.Mesh has
   * no DOM box — its screen extent is only available by projecting its
   * corners through the camera, which is more machinery than the threshold
   * deserves. The canvas is a fine proxy: the head occupies a fixed slice of
   * it, so a fraction of the canvas width is a fraction of the head, and it
   * scales correctly with the viewport either way.
   */
  function petDistancePx(): number {
    return (stage.canvas.clientWidth || window.innerWidth) * PET_DISTANCE;
  }

  function intersectFloor(): THREE.Vector3 | null {
    raycaster.setFromCamera(hub.ndc(ndc), stage.camera);
    const point = raycaster.ray.intersectPlane(groundPlane, hitPoint);
    return point ? point.clone() : null;
  }

  /** Returns which region the pointer is over, or null. */
  function pickRegion(): "head" | "belly" | null {
    raycaster.setFromCamera(hub.ndc(ndc), stage.camera);
    const headHits = raycaster.intersectObject(bear.rig.headHit, false);
    if (headHits.length > 0) return "head";

    const bellyHits = raycaster.intersectObject(bear.rig.bellyHit, false);
    if (bellyHits.length > 0) return "belly";

    return null;
  }

  function beginDrag(): void {
    dragging = true;
    // Freeze the grab offset at press time. Recomputing it every frame would
    // make the bear chase the pointer with an accumulating drift, and the
    // character would slide away from under the finger.
    cursor.copy(bear.position);
    dragOffset.set(
      cursor.x - bear.position.x,
      0,
      cursor.z - bear.position.z,
    );
  }

  unsubs.push(
    hub.onPress(() => {
      const region = pickRegion();

      if (region === "head") {
        // Resolve the gesture on release, not here. Committing to a pat on
        // the press frame is what makes a stroke read as a series of angry
        // taps instead of as a pet.
        onHead = true;
        isPet = false;
        pressAt.set(hub.pointer.clientX, hub.pointer.clientY);
        petTravel = 0;
        return;
      }

      if (region === "belly") {
        reactions.squash();
        return;
      }

      // A tap on empty space: send the bear there, if it is close enough to be
      // a deliberate gesture. Taps at the far edge of a wide screen would
      // otherwise launch the character off-screen.
      const floorPoint = intersectFloor();
      if (floorPoint && Math.hypot(floorPoint.x, floorPoint.z) <= HOP_RADIUS) {
        reactions.hopTo(floorPoint);
        return;
      }
      beginDrag();
    }),
  );

  unsubs.push(
    hub.onDrag((pointer) => {
      // A press on the head that is turning into a stroke. Measured first, so
      // a pet that wanders off the head and back is still a pet.
      if (onHead && !dragging) {
        const dx = pointer.clientX - pressAt.x;
        const dy = pointer.clientY - pressAt.y;
        const travel = Math.hypot(dx, dy);
        if (travel > petTravel) petTravel = travel;

        const threshold = petDistancePx();
        if (isPet || travel >= threshold) {
          // Crossed the threshold on THIS event, so the touch has only just
          // landed. Announce it once, here, rather than on every frame of
          // the stroke — the reaction is a level and setting it repeatedly
          // would be redundant. The check is on `travel` rather than
          // `petTravel` because petTravel was already raised above, which
          // would make the "first time" test never fire again.
          if (!isPet) reactions.petBegin();
          isPet = true;
          // The head leans away from the stroke continuously while it runs.
          reactions.petMove(pointer.x, pointer.y);
          return;
        }
      }

      if (!dragging) {
        // The press landed on the bear somewhere other than the head — the
        // belly, or a spot on the torso — so this drag continues the grab.
        //
        // The head is excluded on purpose. A press there is a tap or a pet,
        // and it was already claimed in onPress; letting it fall through to
        // beginDrag here would set `dragging` and then the head branch above
        // would never run again, so a stroke would move the bear instead of
        // petting it. That is exactly what happened: the drag guard was
        // checked with `dragging`, but `dragging` had been set by this very
        // handler one line earlier.
        if (onHead) return;
        if (pickRegion() !== null) beginDrag();
        else return;
      }

      raycaster.setFromCamera(hub.ndc(ndc), stage.camera);
      if (!raycaster.ray.intersectPlane(groundPlane, hitPoint)) return;

      // Clamp to a disc in front of the camera rather than the whole floor,
      // so the bear can never be dragged out of frame.
      const target = hitPoint.clone().sub(dragOffset);
      const distance = Math.hypot(target.x, target.z);
      if (distance > 2.2) {
        target.x *= 2.2 / distance;
        target.z *= 2.2 / distance;
      }

      bear.rig.root.position.x = target.x;
      bear.rig.root.position.z = target.z;
    }),
  );

  unsubs.push(
    hub.onRelease(() => {
      dragging = false;

      if (onHead) {
        if (isPet) {
          reactions.petEnd();
        } else {
          // A press on the head that never travelled far enough to be a
          // stroke: an ordinary pat.
          reactions.pat();
        }
      }

      onHead = false;
      isPet = false;
      petTravel = 0;
    }),
  );

  return {
    dispose() {
      for (const off of unsubs) off();
      unsubs.length = 0;
    },
  };
}
