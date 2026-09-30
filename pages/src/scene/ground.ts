/**
 * Ground: a shadow-catching plane plus a soft contact blob.
 *
 * Two elements because they answer different questions. The real shadow map
 * tells you where the character is in the scene; the blob is a fixed radial
 * gradient that stays put when the character jumps, grounding it even at the
 * top of the arc where the cast shadow is small and faint.
 *
 * The blob is a canvas texture rather than geometry — one draw call, no
 * post-processing, and it can be moved and scaled independently of the
 * shadow camera.
 */

import * as THREE from "three";

export type Ground = {
  readonly group: THREE.Group;
  readonly blob: THREE.Mesh;
  /** Slides the blob to sit under the character and fades it with height. */
  update(target: THREE.Vector3, height: number): void;
};

function createBlobTexture(): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, "rgba(90, 40, 32, 0.42)");
  gradient.addColorStop(0.45, "rgba(90, 40, 32, 0.20)");
  gradient.addColorStop(1, "rgba(90, 40, 32, 0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createGround(): Ground {
  const group = new THREE.Group();

  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(16, 16),
    new THREE.ShadowMaterial({ color: "#8a4a3e", opacity: 0.28 }),
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0;
  shadowPlane.receiveShadow = true;
  // The plane is invisible except where it receives a shadow, so it must not
  // be hit by the raycaster when the user clicks the floor.
  shadowPlane.raycast = () => {};
  group.add(shadowPlane);

  const blob = new THREE.Mesh(
    new THREE.PlaneGeometry(1.5, 1.5),
    new THREE.MeshBasicMaterial({
      map: createBlobTexture(),
      transparent: true,
      depthWrite: false,
    }),
  );
  blob.rotation.x = -Math.PI / 2;
  blob.position.y = 0.01;
  // Sits above the shadow plane, so it composites on top of the real shadow
  // instead of z-fighting with it.
  blob.renderOrder = 1;
  blob.raycast = () => {};
  group.add(blob);

  return {
    group,
    blob,

    update(target: THREE.Vector3, height: number) {
      blob.position.x = target.x;
      blob.position.z = target.z;
      // Higher jump, smaller and fainter contact patch — the same cue a
      // cartoonist uses to show altitude without a reference object.
      const t = THREE.MathUtils.clamp(height / 1.6, 0, 1);
      const scale = 1 - t * 0.42;
      blob.scale.set(scale, scale, 1);
      (blob.material as THREE.MeshBasicMaterial).opacity = 1 - t * 0.55;
    },
  };
}
