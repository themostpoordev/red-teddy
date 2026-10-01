/**
 * The face.
 *
 * This is where the teddy's approach stops working. The bear's head is an
 * ellipsoid and its features are flat plates laid on the surface, which is
 * only possible because an ellipsoid has a closed-form surface height. A face
 * has a nose, a brow ridge, cheekbones and a jaw, none of which are ellipsoids
 * — so the geometry here is not an ellipsoid with things on it, it is a
 * surface that gets DEFORMED, and the features are part of the same mesh.
 *
 * Deforming rather than composing is the whole point. Adding a nose to a
 * sphere means a nose-shaped object resting on a face, and however well it is
 * positioned you can see where one stops and the other begins. Pushing the
 * surface outward where the nose goes gives one continuous form with the nose
 * part of it, which is what makes it read as a face rather than as a mask
 * with attachments.
 *
 * The surface is built on a UV sphere and each vertex is displaced by a sum
 * of smooth falloffs centred on facial landmarks. That is cheap, it is
 * continuous by construction — a sum of Gaussians has no seams — and every
 * landmark is a position you can move, so the face can be tuned without
 * touching geometry code.
 *
 * Resolution matters more here than anywhere else in the project. A face
 * deformed by 0.1 world units needs enough vertices that each bump has many
 * vertices across it, or the nose is a faceted lump. three.js has no
 * subdivision surface, so the sampling density IS the smoothness, and the
 * segment count here is far higher than anything the teddy uses.
 */

import * as THREE from "three";

/** Segments around the head. Higher is smoother and heavier. */
const WIDTH_SEGMENTS = 128;
/** Segments from crown to chin. */
const HEIGHT_SEGMENTS = 96;

/**
 * A facial landmark: a centre, a radius, and how far to push the surface
 * along `dir` at that point.
 */
type Bulge = {
  /** Where, on the unit sphere, the bump is centred. */
  readonly at: readonly [number, number];
  /** Angular falloff in radians. Small is tight, large is broad. */
  readonly radius: number;
  /** How far to push outward, in head radii. */
  readonly amount: number;
  /** Direction to push. Omit to push straight out along the normal. */
  readonly dir?: readonly [number, number, number];
};

/**
 * The face, described rather than modelled.
 *
 * Every entry is a landmark on a unit head, and the numbers are chosen so the
 * proportions read: the eye line sits at just under half the head height,
 * which is where it sits on a real face, and the nose stops a third short of
 * the chin. Getting these two relationships wrong is what makes a drawn face
 * look like a mask — features in the wrong places read as wrong no matter how
 * carefully each one is drawn.
 */
const BULGES: readonly Bulge[] = [
  // The skull. Slightly flattened front-to-back and longer than wide, which
  // is the base proportion of a human head — a perfect sphere reads as a
  // ball no matter what is placed on it.
  { at: [0, 0], radius: Math.PI, amount: 0.06, dir: [0, -0.06, -0.12] },

  // Brow ridge, just above the eye line. Broad and shallow — a strong brow
  // reads as masculine, and a deep one casts a shadow that makes the eyes
  // look sunken.
  { at: [0, 0.14], radius: 0.4, amount: 0.09, dir: [0, 0.06, 0.35] },
  { at: [-0.24, 0.12], radius: 0.28, amount: 0.075, dir: [-0.14, 0.04, 0.4] },
  { at: [0.24, 0.12], radius: 0.28, amount: 0.075, dir: [0.14, 0.04, 0.4] },

  // Eye sockets. NEGATIVE — these are hollows, not bumps, and they are what
  // the eyeballs will sit in.
  //
  // Deep, and much deeper than they look like they should be. The face's
  // midline is pushed forward by the brow and the skull bumps, so a socket
  // that merely flattens still leaves the eye behind the surrounding surface
  // and it renders as a dimple with no eye in it. The socket has to go
  // further back than the face is proud, not just level with it — measured,
  // the eye position sits at z = 0.99 while the cheek beside it is at 1.04,
  // so a shallow socket leaves the eye entirely occluded.
  { at: [-0.24, -0.02], radius: 0.28, amount: -0.14, dir: [0, 0, 0.5] },
  { at: [0.24, -0.02], radius: 0.28, amount: -0.14, dir: [0, 0, 0.5] },
  // A shallower hollow around each socket, blending the deep one into the
  // cheek. Without the blend the socket is a crater with a rim.
  { at: [-0.3, -0.02], radius: 0.42, amount: -0.05, dir: [-0.2, 0, 0.3] },
  { at: [0.3, -0.02], radius: 0.42, amount: -0.05, dir: [0.2, 0, 0.3] },

  // The nose. The most important shape on a face and the one most often left
  // out. Bridge, tip and a pair of wings, because one bump for all three
  // gives a lump rather than a nose.
  //
  // Kept short. A long bridge from between the brows is anatomically
  // correct and looks wrong: it runs down past the mouth line and the whole
  // thing reads as a beak. A face reads as a face from the tip and the wings;
  // the bridge is a suggestion.
  { at: [0, -0.06], radius: 0.15, amount: 0.06, dir: [0, 0.04, 0.45] },
  { at: [0, -0.17], radius: 0.14, amount: 0.12, dir: [0, -0.05, 0.55] },
  { at: [-0.11, -0.18], radius: 0.1, amount: 0.07, dir: [-0.45, -0.06, 0.35] },
  { at: [0.11, -0.18], radius: 0.1, amount: 0.07, dir: [0.45, -0.06, 0.35] },
  { at: [0, -0.11], radius: 0.11, amount: 0.035, dir: [0, 0, 0.4] },

  // Cheekbones, high and outboard. These give a face its structure in
  // three-quarter view and are most of the difference between a round blob
  // and something with a skull under it.
  { at: [-0.32, -0.04], radius: 0.26, amount: 0.07, dir: [-0.4, 0.12, 0.2] },
  { at: [0.32, -0.04], radius: 0.26, amount: 0.07, dir: [0.4, 0.12, 0.2] },

  // The muzzle mass around the mouth. A flat plane between the nose and the
  // chin is what makes a mouth look pasted on.
  { at: [0, -0.3], radius: 0.22, amount: 0.05, dir: [0, -0.04, 0.35] },

  // Chin and the jaw line running back from it. A jaw is an angle and has to
  // be built out of bumps or the lower face is an egg.
  { at: [0, -0.45], radius: 0.2, amount: 0.07, dir: [0, -0.28, 0.3] },
  { at: [-0.26, -0.36], radius: 0.24, amount: 0.05, dir: [-0.45, -0.22, 0.02] },
  { at: [0.26, -0.36], radius: 0.24, amount: 0.05, dir: [0.45, -0.22, 0.02] },
  { at: [-0.42, -0.24], radius: 0.22, amount: 0.02, dir: [-0.5, -0.15, -0.1] },
  { at: [0.42, -0.24], radius: 0.22, amount: 0.02, dir: [0.5, -0.15, -0.1] },

  // Temples, slightly hollowed. A face is widest at the cheekbones and
  // narrows above them; without this the head is an egg all the way up.
  { at: [-0.38, 0.22], radius: 0.26, amount: -0.045, dir: [-0.35, 0, 0] },
  { at: [0.38, 0.22], radius: 0.26, amount: -0.045, dir: [0.35, 0, 0] },

  // The slight hollow under the cheekbone, which is what makes a face read
  // as young and as three-dimensional rather than as a mask.
  { at: [-0.3, -0.18], radius: 0.2, amount: -0.035, dir: [-0.3, 0, 0.2] },
  { at: [0.3, -0.18], radius: 0.2, amount: -0.035, dir: [0.3, 0, 0.2] },

  // Lips. Two small ridges rather than one, because an upper and a lower lip
  // at different heights is what a mouth is.
  { at: [0, -0.33], radius: 0.09, amount: 0.035, dir: [0, 0.06, 0.3] },
  { at: [0, -0.36], radius: 0.1, amount: 0.03, dir: [0, -0.08, 0.3] },
];

/** Where the surface is pushed by the bulge set, at a point on the unit
 *  sphere. Returns an offset direction and magnitude. */
function displace(x: number, y: number, z: number): [number, number, number, number] {
  let ox = 0;
  let oy = 0;
  let oz = 0;
  let total = 0;

  for (const b of BULGES) {
    // Angular distance on the sphere. Chord length is fine and much cheaper
    // than an acos, and the falloff is smooth enough that the difference is
    // invisible.
    const dx = x - b.at[0];
    const dy = y - b.at[1];
    const d2 = dx * dx + dy * dy;
    const d = Math.sqrt(d2);

    if (d > b.radius * 2.5) continue;

    // Gaussian falloff. Cut off at 2.5 radii so distant bumps contribute
    // exactly zero rather than a tiny amount that would show up as a faint
    // ripple in the flat areas.
    const t = d / b.radius;
    const w = Math.exp(-t * t * 2.2);
    if (w < 0.004) continue;

    const amt = b.amount * w;
    if (b.dir) {
      ox += b.dir[0] * amt;
      oy += b.dir[1] * amt;
      oz += b.dir[2] * amt;
    } else {
      ox += x * amt;
      oy += y * amt;
      oz += z * amt;
    }
    total += amt;
  }

  return [ox, oy, oz, total];
}

/**
 * Build the head.
 *
 * Returns the mesh plus the landmarks, so the eyes and mouth can be placed
 * against the ACTUAL deformed surface rather than against the sphere they
 * were authored on. A feature placed on the undeformed sphere sinks or floats
 * — the same failure as the teddy's eyes, and the ellipsoid formula does not
 * apply here because the surface is no longer an ellipsoid.
 */
export type Head = {
  readonly group: THREE.Group;
  readonly mesh: THREE.Mesh;
  /** Radius of the undeformed head, in world units. */
  readonly radius: number;
  /** Surface point and normal at a landmark, in world space. */
  surfaceAt(x: number, y: number): { point: THREE.Vector3; normal: THREE.Vector3 };
};

export function createHead(radius = 1): Head {
  // Built on a UV sphere, then displaced. The sphere's own vertices are the
  // sampling grid, so the segment counts above set both the tessellation and
  // how finely each facial bump can be expressed.
  const geo = new THREE.SphereGeometry(1, WIDTH_SEGMENTS, HEIGHT_SEGMENTS);
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const nrm = geo.attributes.normal as THREE.BufferAttribute;

  const v = new THREE.Vector3();

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i).normalize();
    const [ox, oy, oz] = displace(v.x, v.y, v.z);
    pos.setXYZ(i, v.x + ox, v.y + oy, v.z + oz);
  }

  // Recomputed rather than left alone: the original normals describe the
  // undeformed sphere, and shading them would light the face as though it
  // were still round — which erases every bump on it.
  pos.needsUpdate = true;
  geo.computeVertexNormals();
  void nrm;

  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  mesh.scale.setScalar(radius);

  const group = new THREE.Group();
  group.add(mesh);

  /** Evaluate the deformed surface at a landmark, the same way the vertices
   *  were built — so a feature placed here sits on the face rather than near
   *  it. */
  const surfaceAt = (x: number, y: number) => {
    const z = Math.sqrt(Math.max(0, 1 - x * x - y * y));
    const [ox, oy, oz] = displace(x, y, z);
    const point = new THREE.Vector3(x + ox, y + oy, z + oz).multiplyScalar(radius);

    // Normal from finite differences on the deformed surface, not from the
    // analytic falloff. Two tangent samples and a cross product is cheap and
    // gets the direction right even where bulges overlap, which is where an
    // analytic approximation drifts.
    //
    // Each sample steps AWAY from the landmark rather than in a fixed
    // direction. Stepping always in +x breaks the symmetry outright: for the
    // eye at negative x the sample lands on the other side of the socket's
    // steepest gradient, and the resulting normal tilts inward and downward.
    // That is what made one eye sit lower than the other and both of them
    // look crooked — a difference of a few thousandths of a world unit, and
    // completely visible on a face.
    const eps = 0.01;
    const sx = x < 0 ? -eps : eps;
    const tangentX = new THREE.Vector3();
    const tangentY = new THREE.Vector3();

    for (const [tx, ty, out] of [
      [x + sx, y, tangentX],
      [x, y + eps, tangentY],
    ] as const) {
      const tz = Math.sqrt(Math.max(0, 1 - tx * tx - ty * ty));
      const [dx, dy, dz] = displace(tx, ty, tz);
      out.set(tx + dx, ty + dy, tz + dz);
    }

    const normal = new THREE.Vector3()
      .crossVectors(tangentX, tangentY)
      .normalize();

    // Point it outward, i.e. away from the head's centre. Comparing against
    // the landmark's own radial direction is the robust way to do that.
    //
    // The obvious alternative — multiply by sign(z) — is a trap. Only the
    // front of the face is ever sampled, so z is always positive there and
    // the multiplier is always +1, which makes it look like it works. It
    // silently gives the wrong answer the moment anything samples the side
    // or the back of the head.
    const radial = new THREE.Vector3(x, y, z).normalize();
    if (normal.dot(radial) < 0) normal.negate();

    return { point, normal };
  };

  return { group, mesh, radius, surfaceAt };
}