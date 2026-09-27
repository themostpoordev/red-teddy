/**
 * App: assembles the scene, the interactions and the UI, and owns the
 * per-frame update.
 *
 * Update order matters and is the reason this is a function rather than
 * scattered subscriptions. Per frame:
 *
 *   1. sample pointer velocity  — needs the freshest input
 *   2. run reactions            — writes transforms for this frame
 *   3. update ground/hearts     — reads those transforms
 *   4. update lighting          — follows the final position
 *
 * Lighting last means the shadow frustum tracks where the bear actually is
 * this frame, not where it was when the light was last touched.
 */

import * as THREE from "three";
import { detectCapability } from "./core/capability";
import { createPointerHub } from "./core/pointer";
import { createStage } from "./scene/stage";
import { createLighting } from "./scene/lighting";
import { createGround } from "./scene/ground";
import { createBear } from "./bear";
import { createHearts } from "./scene/hearts";
import { createReactions } from "./scene/reactions";
import { createInteractions } from "./scene/interactions";
import { createCard, createWordmark } from "./ui/card";

/** Hearts in the pool. More than the largest burst so a fast repeated pat
 *  never runs dry and emits fewer hearts than requested. */
const HEART_CAPACITY = 8;

export function createApp(host: HTMLElement): void {
  const capability = detectCapability();

  const stage = createStage(host);
  const lighting = createLighting();
  const ground = createGround();
  const bear = createBear();
  const hearts = createHearts(HEART_CAPACITY);
  const reactions = createReactions(bear, hearts);
  reactions.reducedMotion = capability.reducedMotion;

  stage.scene.add(lighting.group, ground.group, bear.group, hearts.group);

  const hub = createPointerHub(stage.canvas);
  const interactions = createInteractions(stage, hub, bear, reactions);

  // --- UI -------------------------------------------------------------
  document.body.append(createWordmark());
  document.body.append(createCard());

  // --- reduced motion is live-updatable --------------------------------
  // The preference can change while the page is open (macOS System Settings,
  // the Windows animation toggle), so listen rather than reading it once.
  const motionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const syncMotion = (): void => {
    reactions.reducedMotion = motionQuery.matches;
  };
  motionQuery.addEventListener("change", syncMotion);

  // --- frame -----------------------------------------------------------
  const lookTarget = new THREE.Vector3();

  stage.onFrame((dt, elapsed) => {
    reactions.update(dt, elapsed);
    hearts.update(dt);

    // Track the head rather than the root, so the contact shadow and the
    // light follow the part of the character that reads as "the bear".
    bear.rig.head.getWorldPosition(lookTarget);
    ground.update(bear.rig.root.position, bear.height);
    lighting.follow(lookTarget);
  });

  stage.start();

  // Exposed for testing. The reactions are otherwise unreachable from outside
  // the closure, so an automated check cannot tell which gesture a tap fired
  // or read the arm angles back. Read-only in practice; nothing in the app
  // reads it back, and it is one object holding references, not a copy of the
  // state.
  (host as HTMLElement & { __thd?: unknown }).__thd = {
    bear,
    reactions,
    stage,
    hub,
    /**
     * Where a named rig part actually is on screen, in client pixels.
     *
     * An automated test cannot guess this: the part moves with the camera,
     * the viewport and the animation, and every value hardcoded from a
     * previous run is wrong by the time the layout changes. Projecting the
     * mesh through the live camera is the only way to get a real target.
     */
    screenPoint(part: "head" | "belly") {
      const mesh = part === "head" ? bear.rig.headHit : bear.rig.bellyHit;
      const box = new THREE.Box3().setFromObject(mesh);
      const centre = box.getCenter(new THREE.Vector3());
      const projected = centre.clone().project(stage.camera);
      const rect = stage.canvas.getBoundingClientRect();
      return {
        x: rect.left + ((projected.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - projected.y) / 2) * rect.height,
        /** Half the projected width, for sizing a stroke that covers the part. */
        radius: rect.width * 0.06,
      };
    },
  };

  // --- teardown ---------------------------------------------------------
  // Exposed so a future hot-reload or SPA mount can unmount cleanly; also
  // what the dev server's HMR dispose hook calls.
  (host as HTMLElement & { __thdDispose?: () => void }).__thdDispose = () => {
    motionQuery.removeEventListener("change", syncMotion);
    interactions.dispose();
    hub.dispose();
    stage.dispose();
  };
}
