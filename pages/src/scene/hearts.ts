/**
 * Heart particles.
 *
 * A pre-allocated pool of sprites that are recycled, never created. Allocating
 * geometry mid-interaction is what causes the hitch people feel when they poke
 * a particle-heavy scene on a phone, so every mesh exists from the first frame
 * and only its position, scale and opacity change.
 *
 * The heart shape is a canvas texture: two circles and a triangle, drawn once
 * at startup. It is smaller than any geometry would be and stays crisp because
 * the texture is only ever rendered a few hundred pixels across.
 */

import * as THREE from "three";
import { clamp } from "../core/math";

type Particle = {
  mesh: THREE.Mesh;
  life: number;
  ttl: number;
  velocity: THREE.Vector3;
  spin: number;
};

export type Hearts = {
  readonly group: THREE.Group;
  setCapacity(n: number): void;
  /** Emits `count` hearts from a world-space origin. */
  burst(origin: THREE.Vector3, count: number): void;
  update(dt: number): void;
};

const RISE = 1.1;
const SPREAD = 0.42;
const TTL = 1.5;

function createHeartTexture(): THREE.CanvasTexture {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return new THREE.CanvasTexture(canvas);

  ctx.fillStyle = "#e8443a";
  ctx.beginPath();
  // Two lobes.
  ctx.arc(size * 0.29, size * 0.32, size * 0.22, 0, Math.PI * 2);
  ctx.arc(size * 0.71, size * 0.32, size * 0.22, 0, Math.PI * 2);
  // Pointed base.
  ctx.moveTo(size * 0.07, size * 0.44);
  ctx.lineTo(size * 0.93, size * 0.44);
  ctx.lineTo(size * 0.5, size * 0.94);
  ctx.closePath();
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createHearts(initialCapacity: number): Hearts {
  const group = new THREE.Group();
  const geometry = new THREE.PlaneGeometry(0.3, 0.3);
  const texture = createHeartTexture();

  const pool: Particle[] = [];
  let cursor = 0;

  function build(count: number): void {
    // One material per particle, because each fades independently and
    // opacity is per-material. They share a single texture, so the memory
    // cost is one small bitmap total.
    for (let i = 0; i < count; i++) {
      const material = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthWrite: false,
        opacity: 0,
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.visible = false;
      mesh.raycast = () => {};
      group.add(mesh);
      pool.push({
        mesh,
        life: 0,
        ttl: 1,
        velocity: new THREE.Vector3(),
        spin: 0,
      });
    }
  }

  build(initialCapacity);

  function emit(origin: THREE.Vector3): void {
    const p = pool[cursor];
    cursor = (cursor + 1) % pool.length;
    if (!p) return;

    p.life = 0;
    // Jittered so a burst fans out instead of stacking into one line.
    p.ttl = TTL * (0.75 + Math.random() * 0.5);
    p.mesh.position.set(
      origin.x + (Math.random() - 0.5) * 0.4,
      origin.y + (Math.random() - 0.5) * 0.2,
      origin.z + (Math.random() - 0.5) * 0.3,
    );
    p.velocity.set(
      (Math.random() - 0.5) * SPREAD,
      RISE * (0.7 + Math.random() * 0.6),
      (Math.random() - 0.5) * SPREAD * 0.5,
    );
    p.spin = (Math.random() - 0.5) * 2.2;
    p.mesh.rotation.z = Math.random() * Math.PI * 2;
    p.mesh.scale.setScalar(0.7 + Math.random() * 0.5);
    p.mesh.visible = true;
  }

  return {
    group,
    setCapacity(n) {
      // Grow-only: shrinking would mean destroying pooled meshes that
      // reactions may still hold a reference to.
      if (n > pool.length) build(n - pool.length);
    },
    burst(origin, count) {
      for (let i = 0; i < count; i++) emit(origin);
    },
    update(dt) {
      for (const p of pool) {
        if (!p.mesh.visible) continue;
        p.life += dt;
        if (p.life >= p.ttl) {
          p.mesh.visible = false;
          continue;
        }
        const t = p.life / p.ttl;
        p.mesh.position.addScaledVector(p.velocity, dt);
        // Ease-out on the rise so hearts decelerate as they climb, which
        // reads as buoyancy rather than a constant upward conveyor.
        p.velocity.y -= dt * 0.55;
        p.mesh.rotation.z += p.spin * dt;
        const material = p.mesh.material as THREE.MeshBasicMaterial;
        // Fade in fast, hold, fade out — a linear ramp looks like a glitch.
        material.opacity = clamp(Math.min(t * 6, (1 - t) * 2.2), 0, 1);
      }
    },
  };
}
