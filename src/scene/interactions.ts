/**
 * Interaction: turning pointer events into reactions.
 *
 * Two hit regions are raycast separately — the head and the belly — because
 * they trigger different reactions. The floor is the third target: a tap that
 * hits neither sends the bear to that spot.
 *
 * The raycast is done against a small explicit list rather than the whole
 * scene. Beyond being cheaper, it is the only way to keep the outline hulls
 * out of the results (they have their raycast disabled in materials.ts, but
 * the blob and shadow plane are not pickable targets at all).
 */

import * as THREE from "three";
import type { PointerHub } from "../core/pointer";
import type { Bear } from "../bear";
import type { Reactions } from "./reactions";
import type { Stage } from "./stage";

/** Beyond this radius from centre, a floor tap is treated as intentional. */
const HOP_RADIUS = 1.9;

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
        reactions.pat();
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
    hub.onDrag(() => {
      if (!dragging) {
        // The press landed on the bear, so this drag continues the grab.
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
    }),
  );

  return {
    dispose() {
      for (const off of unsubs) off();
      unsubs.length = 0;
    },
  };
}
