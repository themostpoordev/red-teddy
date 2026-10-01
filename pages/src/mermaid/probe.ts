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
import { createHead } from "./head";
import { createFaceMaterial } from "./face-marks";

const host = document.getElementById("stage")!;

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(window.devicePixelRatio);
renderer.setSize(host.clientWidth, host.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
host.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color("#0d1526");

const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 100);
camera.position.set(0, 0.15, 6.4);
camera.lookAt(0, 0.05, 0);

const head = createHead(1);
scene.add(head.group);

const LIGHT = new THREE.Vector3(0.5, 0.8, 0.6).normalize();

// The face's marks — eyes, lashes, crease, blush — are painted by this shader
// rather than built as separate meshes. See face-marks.ts for why.
const material = createFaceMaterial(
  {
    sclera: [1.0, 0.973, 0.965],
    iris: [0.941, 0.725, 0.235],
    irisCore: [1.0, 0.914, 0.659],
    ink: [0.239, 0.122, 0.2],
    eyeX: 0.19,
    eyeY: -0.02,
    eyeW: 0.145,
    eyeH: 0.115,
    gaze: [0, 0],
    open: 1,
  },
  {
    color: "#ffe0cd",
    shadow: "#c08fa0",
    subsurface: "#ff8fa3",
    rim: "#ffd9f0",
    rimStrength: 0.9,
    rimPower: 3,
    fill: "#9fd8ff",
    fillAmount: 0.35,
    lightDir: LIGHT,
    specular: 0.3,
  },
);

head.mesh.material = material;

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
  head,
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