/**
 * The body.
 *
 * Proportions first, because on a character the proportions ARE the design.
 * A nose can be tuned forever and it will not save a figure whose shoulders
 * are too wide; get the silhouette right and the rest has somewhere to sit.
 *
 * THE NUMBERS
 *
 * An adult figure is about 7.5 heads tall. That sounds like a stylisation but
 * it is nearly exact, and it is the anchor everything else hangs off. A
 * character's head is drawn at a size the viewer reads as "one head", and the
 * body has to be built to that same ruler or the head reads as too big and the
 * whole figure reads as a doll.
 *
 * Anime proportions shorten the body and lengthen the limbs — the same 7.5
 * heads becomes closer to 6.5 by enlarging the head and thinning the torso.
 * That is the look, and it is a deliberate departure from the ruler rather
 * than a failure to follow it.
 *
 * Mermaid tails change the proportions more than anything else. A tail is
 * roughly as long as the legs it replaces, so a merman is TALLER than the
 * person above the waist is long — but the tail tapers to a point, and a
 * figure whose lower half comes to a point reads as unstable and top-heavy.
 * Two things fix that: the tail's mass is kept high for as long as possible,
 * and the torso is kept light so the eye reads the head as the heavy end.
 *
 * THE SHAPES
 *
 * Not spheres. The head is a displaced surface (head.ts) because a face needs
 * a nose; the same is true here for every joint. A sphere at a shoulder reads
 * as a ball, and balls are what made an earlier character look assembled from
 * primitives.
 *
 * Instead each limb is a lathe — a profile curve swept around an axis. A lathe
 * can taper, bulge and flatten independently along its length, which is
 * exactly what an arm or a thigh needs, and it stays one continuous surface so
 * there is no seam at the joint.
 *
 * The profile is where the character lives. A cylinder is a limb; a profile
 * that swells at the top and narrows to the wrist is an arm. That single
 * curve is most of the difference between a mannequin and a figure.
 */

import * as THREE from "three";

/** Radii around each axis, per part. Matches the head's scale of 1. */
export const BODY = {
  /** The neck is a short column between the head and the chest. */
  neck: { r: 0.17, h: 0.24 },
  /**
   * The ribcage. Narrower than a sphere and deeper than it is wide — a real
   * chest is an oval, not a ball, and a wide chest is what makes a figure
   * read as a weightlifter rather than as a swimmer.
   */
  chest: { rx: 0.44, ry: 0.5, rz: 0.3 },
  /** The waist, below the ribs. Narrower than the chest by a clear margin. */
  waist: { rx: 0.3, ry: 0.34, rz: 0.24 },
  /** The hips. Wider than the waist — the flare is what reads as female. */
  hips: { rx: 0.42, ry: 0.36, rz: 0.3 },
  /** The upper arm, thin at the top and tapering to the wrist. */
  arm: { top: 0.13, bottom: 0.085 },
  /** The hand. Flat, not a ball. */
  hand: { rx: 0.11, ry: 0.15, rz: 0.05 },
  /** The thigh. Thicker at the top, into the hip. */
  thigh: { top: 0.2, bottom: 0.13 },
  /** The tail's widest point, just under the hips. */
  tailRoot: 0.36,
  /**
   * Where the tail's centreline runs, as a set of points from the hips down
   * and back. A tail is not a cone hanging down — it curves, and the curve is
   * what makes it read as a tail rather than as a mermaid's legs being
   * replaced with a cone.
   */
} as const;

/**
 * The torso, as one lathe.
 *
 * Built in a single piece rather than as a chest, a waist and a pair of hips
 * placed together, because three overlapping solids show their intersections
 * at the seams — a chest sphere sitting on a waist sphere reads as two balls
 * stacked, and the join is visible from every angle.
 *
 * A lathe through a profile that passes from shoulder to rib to waist to hip
 * has no seams at all: one surface, one normal field, and the silhouette
 * carries the whole taper.
 */
export type Torso = {
  readonly group: THREE.Group;
  readonly mesh: THREE.Mesh;
};

/**
 * Where the torso ends at the top, and where the hips close at the bottom.
 * Both are referenced by the assembly, so they are declared here rather than
 * being buried in the profile and re-derived by eye at the call site.
 */
export const TORSO_TOP = 0.74;
export const TORSO_BOTTOM = -0.66;

export function createTorso(): Torso {
  const group = new THREE.Group();

  // Chest to hip. The whole figure is 6.5 heads tall, so with a head radius of 1
// the torso should be about 1.8 units — roughly what this spans.
  const profile: THREE.Vector2[] = [
    // Shoulder line — narrow, because the arms hang from here.
    new THREE.Vector2(0.06, TORSO_TOP),
    new THREE.Vector2(0.19, 0.74),
    // Shoulder cap.
    new THREE.Vector2(0.32, 0.62),
    new THREE.Vector2(0.4, 0.44),
    // Widest point of the ribs.
    new THREE.Vector2(0.42, 0.22),
    // Waist.
    new THREE.Vector2(0.34, 0.0),
    new THREE.Vector2(0.3, -0.12),
    // Hip flare.
    new THREE.Vector2(0.36, -0.3),
    new THREE.Vector2(0.38, -0.44),
    new THREE.Vector2(0.32, -0.55),
    // Close at the bottom, where the tail begins.
    new THREE.Vector2(0.18, -0.62),
    new THREE.Vector2(0.02, -0.66),
  ];

  const geo = new THREE.LatheGeometry(profile, 40);
  // Flattened front-to-back. A lathe is a solid of revolution, so on its own it
  // is round in every direction; a torso is not.
  geo.scale(1, 1, 0.7);

  const mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
  group.add(mesh);

  return { group, mesh };
}

/**
 * A limb: a lathe through a profile that tapers from one end to the other.
 *
 * Shared by the arms and the legs, because they differ only in their numbers
 * and not in how they are made. One function means the shape is defined once,
 * and a change to how a limb tapers applies everywhere.
 */
export function createLimb(
  profile: readonly THREE.Vector2[],
  segments = 24,
): THREE.Mesh {
  const geo = new THREE.LatheGeometry(
    profile.map((p) => p.clone()),
    segments,
  );
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
}

/** The profile for an arm hanging from a shoulder at the origin. */
export function armProfile(): THREE.Vector2[] {
  return [
    // Shoulder, where it meets the torso.
    new THREE.Vector2(0.02, 0),
    new THREE.Vector2(0.11, -0.02),
    // Upper arm, narrowing.
    new THREE.Vector2(0.12, -0.14),
    new THREE.Vector2(0.105, -0.3),
    // Elbow — the narrowest point, and slightly flattened.
    new THREE.Vector2(0.088, -0.42),
    // Forearm, thickening very slightly toward the wrist, which is what an
    // actual forearm does above the taper.
    new THREE.Vector2(0.082, -0.55),
    new THREE.Vector2(0.072, -0.68),
    // Wrist.
    new THREE.Vector2(0.062, -0.74),
    new THREE.Vector2(0.02, -0.76),
  ];
}

/** The profile for a leg from the hip at the origin. */
export function legProfile(): THREE.Vector2[] {
  return [
    new THREE.Vector2(0.02, 0),
    new THREE.Vector2(0.16, -0.02),
    // Thigh, heaviest at the top.
    new THREE.Vector2(0.19, -0.16),
    new THREE.Vector2(0.175, -0.36),
    // Knee.
    new THREE.Vector2(0.135, -0.5),
    // Calf, swelling then tapering.
    new THREE.Vector2(0.15, -0.62),
    new THREE.Vector2(0.125, -0.76),
    // Ankle.
    new THREE.Vector2(0.085, -0.9),
    new THREE.Vector2(0.02, -0.94),
  ];
}

/**
 * The tail.
 *
 * A swept tube rather than a cone, and the difference is the whole point: a
 * cone is straight and a tail is not. This follows a curve, so it can arc
 * behind the figure and taper into a point without the taper being obvious as
 * a simple reduction.
 *
 * The radius along the curve is set per control point rather than left to the
 * tube's default, because a tail's mass has to stay high near the hips for as
 * long as possible. A tail that narrows immediately reads as a cone stuck
 * under a body, and the figure reads as top-heavy and unstable.
 */
export function createTail(): THREE.Mesh {
  // The curve. Read as a tail's spine: it leaves the hips, sweeps back and
  // out, and the last third rises into the fin.
  //
  // The sweep is in X, not Z, and that is the whole difference between a tail
  // and a cone. The camera looks down +z at the figure, so a tail that curves
  // backwards along z is foreshortened into a straight taper and the curve is
  // invisible from the only angle anyone will actually see. Sweeping sideways
  // puts the whole arc across the screen, which is where the eye expects a
  // tail's bend.
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.6, 0),
    // Straight down first, so the tail leaves the hips as a leg would.
    new THREE.Vector3(0.02, -1.05, 0),
    new THREE.Vector3(0.12, -1.45, -0.02),
    // The sweep out to the side, where the mass leaves the body.
    new THREE.Vector3(0.42, -1.78, -0.05),
    new THREE.Vector3(0.82, -1.98, -0.08),
    // The tip, curling up and back in — the curl is what makes it a fin
    // rather than a wedge.
    new THREE.Vector3(1.18, -2.02, -0.1),
    new THREE.Vector3(1.42, -1.9, -0.12),
  ]);

  const geo = new THREE.TubeGeometry(curve, 48, 0.3, 20, false);

  // Taper the radius along the length by moving every ring inward. TubeGeometry
  // has no radius function, so this is done on the vertices after the fact —
  // which is also the only way to get a non-linear taper.
  const pos = geo.attributes.position as THREE.BufferAttribute;
  const tubularSegments = 48;
  const radialSegments = 20;

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    // Radius profile: full at the root, holding for a third, then a smooth
    // fall-off to nothing. The hold is what keeps the mass up near the hips.
    const r =
      t < 0.3 ? 1 - t * 0.25 : Math.pow(Math.max(0, 1 - (t - 0.3) / 0.7), 1.6);
    for (let j = 0; j <= radialSegments; j++) {
      const idx = i * (radialSegments + 1) + j;
      if (idx >= pos.count) continue;
      const centre = curve.getPointAt(t);
      const vx = pos.getX(idx) - centre.x;
      const vy = pos.getY(idx) - centre.y;
      const vz = pos.getZ(idx) - centre.z;
      pos.setXYZ(idx, centre.x + vx * r, centre.y + vy * r, centre.z + vz * r);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

// Flattened VERTICALLY rather than sideways, so the tail is a vertical blade
  // the way a real tail is. Flattening on x would work at the root but the
  // tail sweeps across x as it goes, so a global x-scale squashes the middle
  // and not the tip.
  //
  // Applied along the curve's own normal, computed from the tangent: flatten
  // against the local up, which is what makes the blade stay vertical all the
  // way around the sweep.
  const up = new THREE.Vector3(0, 1, 0);
  const tangent = new THREE.Vector3();
  const side = new THREE.Vector3();

  for (let i = 0; i <= tubularSegments; i++) {
    const t = i / tubularSegments;
    // Wider toward the fin, narrow at the root where it is a leg.
    const flatten = 1 - 0.55 * clamp01((t - 0.3) / 0.7);

    curve.getTangentAt(t, tangent);
    side.crossVectors(tangent, up).normalize();

    for (let j = 0; j <= radialSegments; j++) {
      const idx = i * (radialSegments + 1) + j;
      if (idx >= pos.count) continue;
      // Distance from the centreline along the local side axis, and the
      // component along the blade's own normal (world up, tilted with the
      // tangent so the blade rolls with the tail).
      const p = new THREE.Vector3(pos.getX(idx), pos.getY(idx), pos.getZ(idx));
      const centre = curve.getPointAt(t);
      const rel = p.clone().sub(centre);

      const across = rel.dot(side);
      const through = rel.y;
      // Rebuild from the two components: squashing `through` is the flatten.
      p.set(
        centre.x + side.x * across,
        centre.y + through * flatten,
        centre.z + side.z * across,
      );
      pos.setXYZ(idx, p.x, p.y, p.z);
    }
  }
  pos.needsUpdate = true;
  geo.computeVertexNormals();

  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial());
}

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}