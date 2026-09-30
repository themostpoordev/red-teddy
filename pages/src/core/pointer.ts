/**
 * Central pointer state.
 *
 * One Pointer Events listener set drives mouse, pen and touch identically, so
 * every interaction in the scene has exactly one code path. Nothing here is
 * hover-gated: a tap must be able to do everything a hover can.
 *
 * Coordinates are normalised to [-1, 1] on both axes with +y up, which is what
 * the camera projection wants. Raw client coordinates are kept alongside for
 * raycasting, where NDC has to be computed against the canvas rect.
 */

import * as THREE from "three";

export type Pointer = {
  /** Normalised device coords, -1..1, +y up. */
  x: number;
  y: number;
  /** Client-space pixel position. */
  clientX: number;
  clientY: number;
  /** True while a primary-button press or touch contact is active. */
  down: boolean;
  /** True once the pointer has produced at least one event. */
  active: boolean;
};

export type PointerHub = {
  readonly pointer: Pointer;
  /** Registers a press callback. Returns an unsubscribe function. */
  onPress(fn: (p: Pointer, ev: PointerEvent) => void): () => void;
  /** Registers a drag callback, fired only while `down` is true. */
  onDrag(fn: (p: Pointer, ev: PointerEvent) => void): () => void;
  /** Registers a release callback. */
  onRelease(fn: (p: Pointer, ev: PointerEvent) => void): () => void;
  /** NDC vector for the current pointer position, for raycasting. */
  ndc(target: THREE.Vector2): THREE.Vector2;
  dispose(): void;
};

export function createPointerHub(target: HTMLElement): PointerHub {
  const pointer: Pointer = {
    x: 0,
    y: 0,
    clientX: 0,
    clientY: 0,
    down: false,
    active: false,
  };

  const pressHandlers = new Set<(p: Pointer, ev: PointerEvent) => void>();
  const dragHandlers = new Set<(p: Pointer, ev: PointerEvent) => void>();
  const releaseHandlers = new Set<(p: Pointer, ev: PointerEvent) => void>();

  function setFromEvent(ev: PointerEvent): void {
    const rect = target.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;

    pointer.clientX = ev.clientX;
    pointer.clientY = ev.clientY;
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
    pointer.active = true;
  }

  function handleDown(ev: PointerEvent): void {
    if (ev.button !== 0 && ev.pointerType === "mouse") return;
    setFromEvent(ev);
    pointer.down = true;
    for (const fn of pressHandlers) fn(pointer, ev);
  }

  function handleMove(ev: PointerEvent): void {
    setFromEvent(ev);
    if (pointer.down) {
      for (const fn of dragHandlers) fn(pointer, ev);
    }
  }

  function handleUp(ev: PointerEvent): void {
    if (!pointer.down) return;
    setFromEvent(ev);
    pointer.down = false;
    for (const fn of releaseHandlers) fn(pointer, ev);
  }

  function handleLeave(): void {
    pointer.active = false;
  }

  target.addEventListener("pointerdown", handleDown);
  target.addEventListener("pointermove", handleMove);
  window.addEventListener("pointerup", handleUp);
  window.addEventListener("pointercancel", handleUp);
  target.addEventListener("pointerleave", handleLeave);

  return {
    pointer,

    onPress(fn) {
      pressHandlers.add(fn);
      return () => pressHandlers.delete(fn);
    },
    onDrag(fn) {
      dragHandlers.add(fn);
      return () => dragHandlers.delete(fn);
    },
    onRelease(fn) {
      releaseHandlers.add(fn);
      return () => releaseHandlers.delete(fn);
    },

    ndc(out) {
      return out.set(pointer.x, pointer.y);
    },

    dispose() {
      target.removeEventListener("pointerdown", handleDown);
      target.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleUp);
      target.removeEventListener("pointerleave", handleLeave);
      pressHandlers.clear();
      dragHandlers.clear();
      releaseHandlers.clear();
    },
  };
}
