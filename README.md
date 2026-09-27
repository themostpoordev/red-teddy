<p align="center">
  <img src="docs/cover.png" alt="Red Teddy — a red teddy bear rendered in 3D" width="720">
</p>

<h1 align="center">Red Teddy</h1>

<p align="center">
  An interactive 3D teddy bear that lives in a web page.<br>
  Built with three.js. No React, no framework — just the renderer.
</p>

<p align="center">
  <a href="#live">Live site</a> ·
  <a href="#interactions">Interactions</a> ·
  <a href="#how-it-works">How it works</a> ·
  <a href="#running-it">Run it locally</a>
</p>

---

<a id="live"></a>
## Live site

**[thd.themostpoordev.top](https://thd.themostpoordev.top)**

Served as a static bundle from nginx with a Let's Encrypt certificate. It
loads in about 130 KB of JavaScript and runs at the display's native pixel
ratio on every device.

<a id="interactions"></a>
## Interactions

Nothing here is hover-gated. Every response is reachable with a single tap,
so the whole thing works identically on a phone, a tablet and a desktop.

| Gesture | What happens |
|---|---|
| Move the pointer | The head follows your cursor |
| Tap the head | Hearts float up, the bear leans back and raises its arms |
| Squeeze the belly | The belly squashes and springs back |
| Tap the floor | The bear hops over to that spot |
| Drag the bear | Pick it up and move it around |

Left alone, the bear breathes, blinks on a randomised schedule, swivels its
ears out of phase with its breathing, and settles back to centre.

<a id="how-it-works"></a>
## How it works

### The character is maths, not models

There is no mesh file. The bear is about twenty spheres and capsules sharing
three materials, which is why the whole payload is small and why the code is
readable. Every animatable part is held in an explicit `rig` object, so
reactions address parts by name in constant time rather than walking the
scene graph.

### Flat things have to follow the curve

The single hardest problem in this project was placing the eyes and the blush.
The head is an ellipsoid, so its surface curves away in every direction, and a
flat disc placed at a fixed `z` with a guessed rotation ends up half-buried —
its outer edge inside the fur while the middle floats clear.

The fix is to stop guessing. For an ellipsoid with radii `r`, the surface
height and the surface normal at a point are both closed-form:

```
z = rz * sqrt(1 - (x/rx)² - (y/ry)²)
n = normalize(x/rx², y/ry², z/rz²)
```

Every flat part on the face is positioned with those two values and laid along
the resulting normal. That is the difference between a sticker floating in
front of a head and a button sewn onto it. See `src/scene/eyes.ts` and the
blush in `src/scene/bear.ts`.

### Toon shading without post-processing

The flat cel-shaded look comes from `MeshToonMaterial` with a 4×1
`DataTexture` gradient map using `NearestFilter`, which quantises the light
ramp into hard bands. The ink outline is an inverted hull — a second copy of
each mesh with `BackSide`, scaled outward — so it costs one extra draw call per
part and no full-screen pass, which is what lets it survive on a phone.

### Native resolution, no quality dial

The renderer uses the device's pixel ratio verbatim rather than the usual
`min(devicePixelRatio, 2)`. The outline is one or two pixels wide on screen, so
it is exactly the element that shows the difference between native and clamped
resolution — clamping is what makes edges look soft. The cost argument for
clamping does not hold here either: there are no textures, no environment map
and no post-processing, so a frame is a few dozen flat triangles.

`antialias` is off for the same reason. On a 2× or 3× screen the buffer is
already supersampled relative to the output, which is strictly more samples per
pixel than MSAA applied at 1×, and it costs nothing.

### Frame loop hygiene

- Delta time is clamped to 1/20 s, so returning to a backgrounded tab resumes
  as if only one slow frame had passed — otherwise every spring in the scene
  integrates a multi-minute step and the bear teleports.
- Rendering stops entirely while the tab is hidden.
- Pointer velocity is sampled once per frame, not per event. Differentiating
  raw `pointermove` events measures input rate, not visible speed.
- Hearts come from a pre-allocated pool. Allocating geometry mid-interaction
  is exactly what causes the hitch you feel when poking a particle-heavy scene
  on a phone.

### Accessibility

- The hints are real DOM text, not a canvas overlay, so a screen reader can
  read them and they survive 200% zoom.
- The canvas carries a descriptive `aria-label`.
- `prefers-reduced-motion` is honoured and live-updated: it stops the
  breathing, blinking and hearts while leaving the character interactive. The
  user can change the setting while the page is open and it takes effect.
- Every colour token is contrast-checked against the background. Nothing under
  18px uses the accent red.

<a id="running-it"></a>
## Running it

Requires Node 20 or newer.

```bash
git clone https://github.com/themostpoordev/red-teddy.git
cd red-teddy
npm install
npm run dev
```

Then build the static bundle:

```bash
npm run build     # typecheck + bundle into dist/
npm run preview   # serve dist/ locally to check the production build
```

`dist/` is plain static files. Point any web server at it.

### Project layout

```
src/
├── main.ts              entry point; WebGL support check and failure UI
├── app.ts               assembles the scene and owns the frame update
├── styles.css           design tokens, card, safe-area handling
├── core/
│   ├── ticker.ts        frame clock with a clamped delta
│   ├── capability.ts    device probe
│   ├── pointer.ts       unified pointer state for mouse, pen and touch
│   └── math.ts          damping and small helpers
├── scene/
│   ├── stage.ts         renderer, camera, resize, frame loop
│   ├── materials.ts     toon materials and the outline hull
│   ├── lighting.ts      one shadow-casting key light plus fill
│   ├── ground.ts        shadow plane and contact blob
│   ├── bear.ts          the character and its rig
│   ├── eyes.ts          button eyes placed on the surface normal
│   ├── reactions.ts     every pose and transition
│   ├── interactions.ts  pointer events to reactions
│   └── hearts.ts        pooled heart particles
└── ui/
    └── card.ts          wordmark, content card, interaction hints
```

---

## Licence

MIT — see [LICENSE](LICENSE).

Built with [three.js](https://threejs.org/).
