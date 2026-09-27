/**
 * Stage: renderer, camera, resize handling and the frame loop.
 *
 * The render scale is the device's own pixel ratio, used verbatim. The usual
 * practice is to clamp it — `min(devicePixelRatio, 2)` — on the theory that
 * beyond 2x nobody can see the difference and the fill rate is wasted. On a
 * scene whose identity is a hard ink outline, that is the wrong call: the
 * outline is one to two pixels wide on screen, so it is exactly the element
 * that reveals the difference between native and clamped resolution, and
 * clamping is what makes edges look soft on a modern phone.
 *
 * The cost argument for clamping does not hold here either. There are no
 * textures, no environment map and no post-processing — the frame is a few
 * dozen flat-shaded triangles, so the work is fill rate on a handful of large
 * surfaces, which is far cheaper than decoding a single photo-sized image.
 * Sharpness is the better trade.
 */

import * as THREE from "three";
import { createTicker } from "../core/ticker";

export type Stage = {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  readonly canvas: HTMLCanvasElement;
  /** Render scale in use — the device's native pixel ratio. */
  readonly pixelRatio: number;
  /** Add a per-frame callback. Returns an unsubscribe function. */
  onFrame(fn: (dt: number, elapsed: number) => void): () => void;
  start(): void;
  stop(): void;
  dispose(): void;
};

export function createStage(host: HTMLElement): Stage {
  const canvas = document.createElement("canvas");
  // The bear is the only meaningful content; a screen-reader label describing
  // the scene is more useful than exposing the canvas as an image.
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "หมีตุ๊กตาหมีสีแดงยืนอยู่กลางจอ เลื่อนเมาส์หรือแตะเพื่อให้หมีมองตาม ลากเพื่อย้ายหมี",
  );
  host.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    // No MSAA, and that is a deliberate choice rather than a shortcut.
    // Supersampling does not apply here either: the render buffer is sized to
    // the device's native pixel ratio, so on a 2x or 3x screen the renderer
    // is already producing several device pixels per CSS pixel, and the
    // browser downsamples that to the panel. That is strictly more samples
    // per output pixel than 4x MSAA at 1x, applied to every edge in the
    // frame rather than only where the rasteriser detects a boundary.
    //
    // MSAA would cost 4x the fill rate and add almost nothing here. On a 1x
    // desktop the supersampling argument does not hold, and a 1-pixel jaggies
    // is the correct trade against spending a quarter of the frame budget on
    // edge quality in an outline-driven character.
    antialias: false,
    alpha: true,
    powerPreference: "high-performance",
    stencil: false,
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  // PCFSoftShadowMap is deprecated in three 0.185 and silently downgrades to
  // PCFShadowMap, so the choice is made explicit. The soft look comes from
  // the light's shadow.radius instead — see lighting.ts.
  renderer.shadowMap.type = THREE.PCFShadowMap;
  // The page background is the page's own CSS colour; a transparent canvas
  // lets it show through without a second full-screen clear colour.
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();

  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 60);
  // Far enough back that the whole character fits with breathing room on a
  // short landscape phone, and framed slightly above centre so the bear sits
  // in the optical middle rather than in the lower third.
  camera.position.set(0, 1.5, 7.6);
  camera.lookAt(0, 1.05, 0);

  const ticker = createTicker();
  const frameCallbacks = new Set<(dt: number, elapsed: number) => void>();

  // Render at the device's own pixel ratio, unclamped. On a 3x phone that is
  // the difference between a crisp outline and a visibly soft one, and the
  // outline is the character's whole identity. There is no quality selector
  // and no frame-time-based downscaling: the scene is a few dozen triangles of
  // flat colour with no textures and no post-processing, so the cost at native
  // resolution is fill rate alone — cheaper than decoding a single image.
  const renderRatio = window.devicePixelRatio || 1;

  function applyRatio(): void {
    renderer.setPixelRatio(renderRatio);
    renderer.setSize(host.clientWidth, host.clientHeight, false);
    camera.aspect = host.clientWidth / Math.max(1, host.clientHeight);
    camera.updateProjectionMatrix();
  }

  // The renderer defaults to a 300x150 drawing buffer. Without this call the
  // first frames are stretched from that size to fill the viewport, which
  // looks like a soft, badly-scaled image until something triggers a resize.
  applyRatio();

  function resize(): void {
    applyRatio();
  }

  const onWindowResize = (): void => resize();
  window.addEventListener("resize", onWindowResize);
  window.addEventListener("orientationchange", onWindowResize);
  // Mobile browsers change the visual viewport height when the URL bar
  // collapses, which fires resize without a window size change.
  window.visualViewport?.addEventListener("resize", onWindowResize);

  let running = false;
  let lastVisibility = document.hidden;

  function startLoop(): void {
    if (running) return;
    running = true;
    document.addEventListener("visibilitychange", handleVisibility);
    renderer.setAnimationLoop(frame);
  }

  function stopLoop(): void {
    if (!running) return;
    running = false;
    document.removeEventListener("visibilitychange", handleVisibility);
    renderer.setAnimationLoop(null);
  }

  function handleVisibility(): void {
    if (!document.hidden && !running) startLoop();
  }

  function frame(): void {
    const t = ticker.tick();
    // Skip rendering entirely while hidden. rAF is already throttled in
    // background tabs, but a hidden tab can still get occasional frames on
    // some platforms, and drawing them is pure waste.
    if (document.hidden !== lastVisibility) {
      lastVisibility = document.hidden;
      if (!document.hidden) ticker.resync();
    }
    if (document.hidden) return;

    for (const fn of frameCallbacks) fn(t.dt, t.elapsed);
    renderer.render(scene, camera);
  }

  return {
    renderer,
    scene,
    camera,
    canvas,
    pixelRatio: renderRatio,

    onFrame(fn) {
      frameCallbacks.add(fn);
      return () => frameCallbacks.delete(fn);
    },

    start: startLoop,

    stop: stopLoop,

    dispose() {
      stopLoop();
      window.removeEventListener("resize", onWindowResize);
      window.removeEventListener("orientationchange", onWindowResize);
      window.visualViewport?.removeEventListener("resize", onWindowResize);
      frameCallbacks.clear();
      renderer.dispose();
      canvas.remove();
    },
  };
}
