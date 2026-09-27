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
import { createBear } from "./scene/bear";
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
    hub.sampleVelocity(dt);

    reactions.update(dt, elapsed, hub.pointer.active, hub.pointer.x, hub.pointer.y);
    hearts.update(dt);

    // Track the head rather than the root, so the contact shadow and the
    // light follow the part of the character that reads as "the bear".
    bear.rig.head.getWorldPosition(lookTarget);
    ground.update(bear.rig.root.position, bear.height);
    lighting.follow(lookTarget);

    // A gentle counter-lean makes the character feel like it has weight:
    // the body tips against the direction it is being pulled.
    if (!reactions.reducedMotion) {
      bear.rig.body.rotation.z = THREE.MathUtils.lerp(
        bear.rig.body.rotation.z,
        -hub.pointer.vx * 0.035,
        1 - Math.exp(-6 * dt),
      );
    }
  });

  stage.start();

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
