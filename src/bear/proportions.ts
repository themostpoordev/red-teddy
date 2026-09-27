/**
 * Every number that defines the character's shape, in one place.
 *
 * Tuning the bear means editing this file, not hunting through construction
 * code for the one value that moved. The dimensions are interdependent in
 * ways you cannot see from any single use site: the arm's outward angle only
 * makes sense against the torso's width, the eye's x against the skull's
 * radius, the mouth's width against the muzzle. Collected here, those
 * relationships are checkable.
 *
 * Units are world units. The whole character is roughly 3.2 tall from foot to
 * crown and about 2.2 wide across the arms.
 *
 * Radii and half-extents are written as three numbers [x, y, z] because that
 * is what mesh.scale.set wants, but they mean the ellipsoid's semi-axes, not
 * its diameter.
 */

/** Ink line width. See the note in index.ts. */
export const INK = 0.024;

/**
 * Torso.
 *
 * Narrower than it is tall, and wider than deep. A spherical torso swallows
 * the shoulders, and then the arms have nowhere to attach — they read as fins
 * stuck on the side rather than limbs coming out of the body. The slight
 * x-over-z excess gives the shoulders a surface to sit on while keeping the
 * belly from looking barrel-chested.
 */
export const TORSO = {
  scale: [0.78, 0.86, 0.64] as const,
  at: [0, 0.98, 0] as const,
};

/**
 * Belly. A separate mesh rather than a patch on the torso so it can be
 * squashed on its own without deforming the whole body.
 */
export const BELLY = {
  scale: [0.5, 0.58, 0.34] as const,
  at: [0, 0.9, 0.5] as const,
};

/**
 * Head. The node sits at the neck, so a tilt swings the head rather than
 * spinning it.
 */
export const HEAD = {
  at: [0, 1.72, 0.04] as const,
  /** Skull semi-axes. The eyes, blush and ears are all placed on this. */
  skull: [0.66, 0.6, 0.6] as const,
  /** Skull centre, relative to the head node. */
  skullAt: [0, 0.3, 0] as const,
};

/**
 * Muzzle. One cream sphere, wide and low, whose top edge sits *under* the
 * nose. A separate snout floating in front of the face reads as a second,
 * unrelated object stuck to the muzzle.
 */
export const MUZZLE = {
  scale: [0.36, 0.28, 0.26] as const,
  at: [0, 0.16, 0.44] as const,
};

/** Nose. Sits on the muzzle's front-top, overlapping it, so the two read as
 *  one form. Its lower edge is at y = 0.195, which is what the mouth's ends
 *  have to stay clear of. */
export const NOSE = {
  scale: [0.1, 0.075, 0.08] as const,
  at: [0, 0.27, 0.62] as const,
};

/**
 * Mouth.
 *
 * A teddy bear's mouth is a *shallow* curve, not a deep bowl.
 *
 * For a torus of radius R swept over `arc` radians, the drawn curve has:
 *
 *   width = 2R·sin(arc/2)      (distance between the two ends)
 *   dip   = R·(1 - cos(arc/2)) (how far the middle sits below the ends)
 *
 * so the shape is fixed by the ratio dip/width, independent of R. Dividing
 * the two and using the half-angle identity gives:
 *
 *   dip/width = tan(arc/4) / 2
 *
 * An arc of PI — a full half-turn — makes that ratio exactly 0.5, because a
 * circle is the most curved shape available for a given chord. That is the
 * ceiling, and it is what the mouth used to be: a perfect "U" that read as a
 * bucket rather than a smile. No amount of shrinking or thickening that arc
 * fixes it, because the proportion itself is the problem.
 *
 * At ratio 0.25: arc/4 = 26.565°, so arc = 1.8546. For the same 0.23 width,
 * sin(arc/2) = 0.8 gives R = 0.14375, and the dip works out to 0.0575.
 *
 * `at` is the node position: the two ends sit at exactly that y, and the
 * middle sits `dip` below it. The tube thins to 0.030 because the drawn curve
 * is shorter (R·arc falls from 0.361 to 0.267) and an unchanged tube would
 * read as proportionally heavier on a shorter line.
 */
export const MOUTH = {
  radius: 0.14375,
  tube: 0.03,
  /** Sweep in radians. PI would be a half-circle; see above. */
  arc: 1.8546,
  at: [0, 0.155, 0.66] as const,
  /** Ends relative to the centre, after the z-flip. Symmetric. */
  span: 0.115,
  /** How far the middle sits below the ends. */
  dip: 0.0575,
} as const;

/**
 * Eyes: flat dark buttons, laid on the skull along its surface normal.
 *
 * `at` is [x, y] on the skull. The z is derived, not chosen — see ellipsoid.ts.
 * The height is on the cheek rather than the forehead, and clear of the muzzle.
 */
export const EYE = {
  /** Horizontal offset from the head's axis, per side. */
  x: 0.28,
  y: 0.36,
  /** Radius of the button. */
  radius: 0.12,
  /** Half its thickness. A button is flat — it bulges nothing. */
  halfDepth: 0.02,
  /** Lifted along the normal to clear the tessellated skull underneath. */
  lift: 0.012,
  /** Catchlight, offset within the button's own plane. */
  spark: {
    radius: 0.034,
    halfDepth: 0.005,
    offset: [0.038, 0.044] as const,
    lift: 0.012,
  },
  /** Below this the catchlight is hidden — it would read as a speck on a
   *  closed lid. */
  sparkVisibleAbove: 0.4,
} as const;

/**
 * Blush: two flat discs, the cheapest possible expression cue.
 *
 * Same rule as the eyes — laid on the skull's normal, not floated at a fixed
 * z. `at` is [x, y] on the skull; the z and normal are derived.
 */
export const BLUSH = {
  x: 0.44,
  y: 0.2,
  radius: 0.15,
  /** Vertical squash, so the disc is a cheek rather than a circle. */
  squash: 0.66,
  lift: 0.01,
} as const;

/**
 * Ears.
 *
 * Unlike the eyes and blush, an ear is a sphere seen edge-on rather than a
 * flat plate laid on the skull, so no surface normal is needed — a plain
 * rotation is enough. `at` is the pivot, which is where the ear swings from.
 */
export const EAR = {
  at: [0.5, 0.6, -0.02] as const,
  outer: [0.22, 0.25, 0.13] as const,
  inner: [0.12, 0.14, 0.07] as const,
  /** Inner ear, relative to the pivot. */
  innerAt: [0.03, -0.01, 0.08] as const,
  /** Resting outward tilt, mirrored per side. */
  rest: 0.22,
} as const;

/**
 * Arms.
 *
 * The fix for floating shoulders is to bury the limb rather than bridge the
 * gap with a ball. One capsule, long enough that its upper end sits *inside*
 * the torso, so the join reads as a limb passing into a body rather than a
 * sphere stuck onto one. A sphere large enough to fill the gap becomes a
 * visible round bump on the silhouette, and once the outline passes around it
 * the character stops reading as a soft toy and starts reading as a stack of
 * primitives.
 *
 * The outward angle is arithmetic, not taste. Hanging straight down puts the
 * paw at x = 0.66, but the torso surface at the paw's height (y = 0.68) is at
 * x = 0.739 — the paw ends up inside the body showing only a crescent, which
 * reads as a stray bump. At 0.33 rad the paw reaches x = 0.86, clear of that
 * edge.
 *
 * A downward limb swings toward +x under a positive z rotation, so the left
 * arm takes the negative angle to move further left, and the right arm its
 * mirror. Assigning both by screen position instead of by swing direction
 * folds the arms into the torso.
 */
export const ARM = {
  /** The pivot is the shoulder. */
  at: [0.62, 1.32, 0.16] as const,
  /** Outward tilt, mirrored per side. */
  rest: 0.33,
  upper: [0.115, 0.3, 0.115] as const,
  upperAt: [0, -0.24, 0] as const,
  /**
   * The paw must be visibly WIDER than the limb it ends. A teddy bear's mitten
   * is a ball at least twice the arm's thickness — that contrast is what reads
   * as a hand rather than as the rounded cap of a tube. At 0.14 against an arm
   * of 0.115 it was barely wider and read as a bead stuck on the end; 0.19 is
   * the ratio that reads as a mitten.
   */
  paw: [0.19, 0.2, 0.19] as const,
  pawAt: [0, -0.66, 0.02] as const,
} as const;

/** Legs and feet. Feet read as feet because they are wider in z than the leg. */
export const LEG = {
  at: [0.3, 0.5, 0.02] as const,
  upper: [0.2, 0.2, 0.2] as const,
  upperAt: [0, -0.16, 0] as const,
  foot: [0.23, 0.17, 0.27] as const,
  footAt: [0, -0.38, 0.08] as const,
} as const;

/**
 * Shared geometry segment counts.
 *
 * Higher than a silhouette-only character needs (48x32 rather than 32x24). The
 * reason is the outline hull: it is a scaled copy of the same geometry, and at
 * low segment counts the facets on the hull are large enough to break the ink
 * line into visible straight chords around the head. The extra triangles are
 * invisible in shading but obvious in the outline, and the outline is the
 * character's whole identity.
 */
export const SEGMENTS = {
  sphere: [48, 32] as const,
  smallSphere: [28, 20] as const,
  capsule: [10, 28] as const,
  eyeDisc: 32,
  spark: 16,
  blush: 28,
  mouthTube: 10,
  mouthSweep: 30,
} as const;
