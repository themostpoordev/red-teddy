/**
 * Face probe.
 *
 * A test harness for the head, deliberately separate from the real page. The
 * head is the part most likely to be wrong and the hardest to judge from code
 * — whether a nose is too deep or an eye socket too shallow is only visible,
 * so this renders the head large, lit, and alone, where it can be judged.
 *
 * Not part of the shipped page; it exists to be run.
 */

import * as THREE from "three";
import { createMermaid } from "./mermaid";

const host = document.getElementById("stage")!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(host.clientWidth, host.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.setClearColor(0x0d1526, 1);
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
// Pulled back and centred a little lower so the whole figure fits — the head
// alone framed the shot, and with a body attached the composition has to
// account for it or the head is at the top edge and the tail is off-screen.
camera.position.set(0, 0.1, 12);
camera.lookAt(0, -0.2, 0);

const mermaid = createMermaid();
scene.add(mermaid.group);

const material = mermaid.material;

function resize() {
  const w = host.clientWidth;
  const h = host.clientHeight;
  renderer.setSize(w, h);
  camera.aspect = w / Math.max(1, h);
  camera.updateProjectionMatrix();
}
window.addEventListener("resize", resize);
resize();

// Exposed so a capture script can read the rig back and drive the expression.
// Judging a face from a screenshot alone is guesswork: two eyes a few
// thousandths apart look like one eye is lower, and only the numbers say
// whether that is true.
(window as unknown as { __probe?: unknown }).__probe = {
  scene,
  camera,
  mermaid,
  material,
  /** Open the eyes, 0 shut to 1 open. */
  setOpen: (v: number) => {
    (material.uniforms.uOpen as THREE.IUniform<number>).value = v;
  },
  /** Move the gaze, -1..1 on each axis. */
  setGaze: (x: number, y: number) => {
    (material.uniforms.uGazeX as THREE.IUniform<number>).value = x;
    (material.uniforms.uGazeY as THREE.IUniform<number>).value = y;
  },
};

renderer.setAnimationLoop(() => {
  // The face shader needs the camera position for its view vector, which is
  // what makes the rim light and the specular face the viewer. Passed every
  // frame rather than set once, because a static value freezes the rim and
  // the eye stops looking wet the moment the camera moves.
  (material.uniforms.uCameraPos as THREE.IUniform<THREE.Vector3>).value.copy(
    camera.position,
  );
  renderer.render(scene, camera);
});