/**
 * The cat page's stage: renderer, camera, lights and the frame loop.
 *
 * Separate from the bear's stage on purpose, even though the two look like
 * they could share one. They differ in three ways that all matter:
 *
 *   the camera is at the cat's own height, because a cat is a ground-level
 *   animal and shot from a bear's eye line it reads as standing on stilts
 *
 *   the key light comes from behind and to the side, because a black coat has
 *   almost no diffuse response to work with — everything you can see on a
 *   black cat is a specular edge, so a soft front key leaves a silhouette
 *
 *   the canvas is opaque over a gradient background, because the bear's
 *   transparent canvas sits on the page's own cream and a black cat on cream
 *   is a dark blob with no rim to separate it
 *
 * The one thing reused from the bear is the shading model (`toon`), because
 * the shading model is not what makes a character a character.
 */

import * as THREE from "three";
import { createPointerHub } from "./core/pointer";
import { createCat, type CatRig } from "./cat";
import { createCatGestures, type CatGestures } from "./cat-gestures";

/**
 * The background. A pale violet wash rather than a flat colour.
 *
 * A black cat needs something to be black AGAINST. On the bear's cream it is
 * a dark shape with an edge but no interior; on a near-black background it
 * disappears entirely and only the rim survives, which reads as a glowing
 * outline rather than as an animal. A mid-light gradient gives the coat a
 * full range of contrast while keeping it distinct from the page.
 *
 * Violet rather than the bear's cream so the two pages read as different
 * rooms rather than as the same one with different furniture.
 */
const BACKDROP_TOP = "#efe6f6";
const BACKDROP_BOTTOM = "#cfc0e2";

export type CatPage = {
  readonly rig: CatRig;
  readonly gestures: CatGestures;
  dispose(): void;
};

export function startCatPage(host: HTMLElement): CatPage {
  // --- canvas -----------------------------------------------------------
  const canvas = document.createElement("canvas");
  canvas.setAttribute("role", "img");
  canvas.setAttribute(
    "aria-label",
    "แมวดำนั่งอยู่กลางจอ เลื่อนเมาส์หรือแตะหัวเพื่อให้มันเอียงหัวตาม จับหางเพื่อดึงมัน",
  );
  host.appendChild(canvas);

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    stencil: false,
  });
  // Native device ratio, unclamped — the same reasoning as the bear's: the
  // outline is the identity of the character and it is the first thing to go
  // soft when the render scale is cut.
  renderer.setPixelRatio(window.devicePixelRatio);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFShadowMap;

  const scene = new THREE.Scene();

  // The backdrop as a scene background, built from the same two colours the
  // CSS uses, so there is no seam if the canvas ever fails to cover.
  scene.background = new THREE.Color(BACKDROP_TOP);

  // --- camera -----------------------------------------------------------
  // Low and close. A cat is about 3.1 units tall and sits on the ground, so
  // the camera belongs at roughly its shoulder height and close enough that
  // the face fills a reasonable part of the frame.
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 100);
  camera.position.set(0.35, 1.75, 6.4);
  camera.lookAt(0, 1.45, 0);

  // --- lights ------------------------------------------------------------
  // The key is BEHIND and to one side. This is the single most important
  // lighting decision on this page: a black coat reflects very little
  // diffusely, so a front key produces a shape with no readable interior and
  // the character collapses into a paper cut-out.
  const keyDir = new THREE.Vector3(-0.5, 0.8, 0.55).normalize();
  const key = new THREE.DirectionalLight("#fff4e6", 1.35);
  key.position.copy(keyDir).multiplyScalar(8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 20;
  key.shadow.camera.left = -3.5;
  key.shadow.camera.right = 3.5;
  key.shadow.camera.top = 3.5;
  key.shadow.camera.bottom = -3.5;
  // Both biases, and the second one is the one that matters here. `bias`
  // stops a shadow surface occluding itself; `normalBias` is what removes the
  // dark seams where closely-pressing curved parts meet — and on a single
  // black mass (head into haunches, legs into torso) a seam that is a subtle
  // shading artefact on a red bear is a hard black line on a black cat.
  key.shadow.bias = -0.0004;
  key.shadow.normalBias = 0.06;
  scene.add(key, key.target);

  // A cool rim from behind, which is what separates a dark coat from a dark
  // background. Warm-cool separation rather than two white lights, because
  // the warmth is what makes the coat read as fur and the cool is what makes
  // the edge visible.
  const rim = new THREE.DirectionalLight("#a8c8ff", 1.15);
  rim.position.set(2.6, 2.2, -4.5);
  scene.add(rim);

  // Hemisphere fill so the shadow side is dark but not dead. Cool from above,
  // warm-violet from below, picking up the backdrop.
  scene.add(new THREE.HemisphereLight("#cfe0ff", "#6a5a78", 0.6));

  // --- floor -------------------------------------------------------------
  // A shadow-catching plane only. The visible floor is the backdrop gradient
  // painted behind, so this never needs to match anything — it only has to
  // catch, which is why it is a ShadowMaterial and not a lit surface.
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(24, 24),
    new THREE.ShadowMaterial({ color: "#4a3d5c", opacity: 0.3 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  scene.add(floor);

  // --- the cat -----------------------------------------------------------
  const rig = createCat();
  scene.add(rig.group);

  // --- backdrop ----------------------------------------------------------
  // A full-screen gradient behind everything, drawn with depth test off so it
  // can never clip the cat. A CSS gradient on the host would have been
  // simpler, but the renderer clears the canvas opaque and a canvas gradient
  // cannot be expressed with a plain background colour — so it is one quad.
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(2, 2),
    new THREE.ShaderMaterial({
      depthTest: false,
      depthWrite: false,
      uniforms: {
        uTop: { value: new THREE.Color(BACKDROP_TOP) },
        uBottom: { value: new THREE.Color(BACKDROP_BOTTOM) },
      },
      vertexShader: /* glsl */ `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          // Clip-space quad: drawn behind everything regardless of the camera,
          // so it needs no transform and can never fight the depth buffer.
          gl_Position = vec4(position.xy, 1.0, 1.0);
        }
      `,
      fragmentShader: /* glsl */ `
        uniform vec3 uTop;
        uniform vec3 uBottom;
        varying vec2 vUv;
        void main() {
          // Eased rather than linear. A linear ramp reads as a flat wash; the
          // easing concentrates the change low, which puts the darker colour
          // behind the cat's body where it does the most work separating it
          // from the coat.
          float t = pow(1.0 - vUv.y, 1.6);
          gl_FragColor = vec4(mix(uBottom, uTop, t), 1.0);
        }
      `,
    }),
  );
  backdrop.frustumCulled = false;
  backdrop.renderOrder = -1;
  scene.add(backdrop);

  // --- input and gestures -------------------------------------------------
  // The pointer hub rather than raw listeners: one place normalises mouse,
  // pen and touch, and one place owns the NDC conversion the raycaster needs.
  //
  // Gaze is polled from the frame loop rather than subscribed to, because the
  // hub has no move event by design — onMove fires many times per frame on a
  // high-rate pointer and the rig only needs the value once. Reading it here
  // also means a dropped frame cannot leave the eyes stuck mid-turn.
  const hub = createPointerHub(canvas);
  const gestures = createCatGestures(rig, hub, camera);

  // --- blink -------------------------------------------------------------
  // On a loose random schedule rather than a fixed period, because a fixed
  // one is the thing that makes a loop read as mechanical.
  let blinkAt = 2.4;
  let blinkT = -1;
  const BLINK = 0.16;

  // --- frame loop --------------------------------------------------------
  let last = performance.now();
  let elapsed = 0;
  let running = true;

  function resize(): void {
    const w = host.clientWidth;
    const h = host.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / Math.max(1, h);
    camera.updateProjectionMatrix();
  }
  window.addEventListener("resize", resize);
  resize();

  function frame(): void {
    if (!running) return;
    const now = performance.now();
    // Clamped, because a tab that has been in the background reports however
    // long it was away as one frame. An unclamped delta would teleport every
    // easing in the scene in a single step.
    const dt = Math.min((now - last) / 1000, 1 / 20);
    last = now;
    elapsed += dt;

    // --- gaze and head ---------------------------------------------------
    // Polled, not subscribed — see the note where the hub is created.
    //
    // Both are driven from the same pointer but at different rates inside the
    // rig: the eyes track fast, the head follows slowly. Handing both the same
    // value here is correct — the separation belongs to the rig, where the two
    // responses can be tuned independently.
    const gx = hub.pointer.active ? hub.pointer.x : 0;
    const gy = hub.pointer.active ? hub.pointer.y : 0;
    rig.look(gx, gy);
    rig.turnHead(gx, gy);

    // --- gestures -------------------------------------------------------
    // The head lean and the tail springs are advanced here so they share the
    // frame's clamped delta rather than each keeping their own clock.
    gestures.update(dt);

    // --- blink -----------------------------------------------------------
    if (blinkT < 0 && elapsed > blinkAt) blinkT = 0;
    if (blinkT >= 0) {
      blinkT += dt;
      // Down fast, up slower.
      const p = blinkT / BLINK;
      rig.setEyesOpen(p < 0.4 ? 1 - p / 0.4 : (p - 0.4) / 0.6);
      if (p >= 1) {
        blinkT = -1;
        blinkAt = elapsed + 2.2 + Math.random() * 4;
      }
    }

    // --- advance the rig's own easings ------------------------------------
    rig.update(dt);

    // --- breathing -------------------------------------------------------
    // Small, and mostly in the body. A cat's chest moves when it breathes;
    // its head does not.
    const breath = Math.sin(elapsed * 1.6) * 0.5 + 0.5;
    rig.group.scale.set(
      1 + breath * 0.011,
      1 + breath * 0.015,
      1 + breath * 0.011,
    );

    // --- ears ------------------------------------------------------------
    // A cat's ears swivel toward whatever caught its attention, and they
    // lead the eyes rather than following them. Easing at a middling rate and
    // aiming at the gaze rather than the pointer is what gives the head its
    // "something moved over there" quality without ever looking at the cursor.
    const earTarget = rig.gaze.x * 0.34;
    rig.earL.rotation.y = rig.earL.rotation.y + (earTarget - rig.earL.rotation.y) * Math.min(1, dt * 5);
    rig.earR.rotation.y = rig.earR.rotation.y + (earTarget - rig.earR.rotation.y) * Math.min(1, dt * 5);

    // The shadow frustum follows the cat so it stays tight; the cat does not
    // move, so this is a one-time placement rather than a per-frame chase.
    key.target.position.set(0, 1.2, 0);
    key.target.updateMatrixWorld();

    renderer.render(scene, camera);
  }

  renderer.setAnimationLoop(frame);

  // Pause while hidden. rAF is throttled in background tabs anyway, but a
  // hidden tab can still get occasional frames, and drawing them is waste.
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      running = false;
    } else if (!running) {
      running = true;
      // Resync the clock, or the first frame back integrates the whole time
      // away in one step.
      last = performance.now();
      renderer.setAnimationLoop(frame);
    }
  });

  return {
    rig,
    gestures,
    dispose() {
      running = false;
      renderer.setAnimationLoop(null);
      window.removeEventListener("resize", resize);
      gestures.dispose();
      hub.dispose();
      renderer.dispose();
      canvas.remove();
    },
  };
}
