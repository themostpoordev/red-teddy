/**
 * Every dimension of the cat, in one place.
 *
 * Proportions are DERIVED, not chosen. A sitting cat has a head about 35% of
 * its total height — against the 13% a standing adult human carries. That is
 * not a stylisation, it is what a cat looks like: a big skull on a small
 * body, with the ears and eyes sized against the skull rather than against
 * the animal. Getting that ratio wrong is what makes a cat read as a small
 * bear, and it is the first number to check on any change here.
 *
 * Units are world units. The whole cat is about 3.1 tall, standing measure
 * from the ground to the tip of the ears, and about 1.3 wide across the
 * haunches.
 *
 * The numbers are in ONE file so the relationships between them stay
 * checkable. Most of them depend on each other: the ear height is a fraction
 * of the skull, the eye sits at a fraction of the skull's own radius, and the
 * leg length is whatever is left between the torso's base and the ground.
 * Changing the skull without moving the eyes leaves the face unchanged and
 * the character stops being a cat.
 */

/** Ink line width. Black on cream needs more weight than red. */
export const INK = 0.028;

/**
 * The coat.
 *
 * Black, but never pure black. A true #000000 in a shaded scene is a hole in
 * the picture — there is no value for the eye to read form from and the
 * character collapses into a silhouette. Lifted well off zero, the form comes
 * back. The rim light in the scene does the rest: on a black cat, nearly
 * everything you can actually see is reflection at the edge.
 *
 * COAT_LIT is the same coat a shade lighter, used for the muzzle, the chest
 * and the paws. A black cat's markings read as a change in reflection rather
 * than as a colour, so the step is deliberately small — a clearly lighter
 * patch looks like a different animal wearing this one.
 */
export const COAT = "#33303d";
export const COAT_LIT = "#4a4557";

/** The outline hull's colour. Darker than the coat so the line reads. */
export const OUTLINE = "#15121c";

/**
 * The head.
 *
 * COORDINATE SPACE — READ THIS BEFORE EDITING ANYTHING UNDERNEATH
 *
 * HEAD.at is the head's position in the BODY's frame. Everything below it —
 * the muzzle, the nose, the ears, the eyes, the whiskers — is in the HEAD's
 * own frame, whose origin is the centre of the skull and whose +y is up.
 *
 * That means the crown of the head is at HEAD.scale[1], not at
 * HEAD.at[1] + HEAD.scale[1]. Writing world-space values into the head's
 * children is the single easiest mistake to make in this file, and it does
 * not announce itself: an ear placed at y = 2.8 inside a head whose crown is
 * at 0.52 is not drawn at all, it is drawn far above the frame and simply
 * never appears. That is what happened on the first build — the cat rendered
 * with no ears and nobody could work out why, because there was no error.
 *
 * Taller than it is wide. That is the opposite of the teddy's skull, which is
 * wider than tall, and it is most of what separates the two silhouettes: a
 * bear's head is a broad loaf, a cat's is an upright wedge.
 */
export const HEAD = {
  /** Centre height above the ground, in the body's frame. */
  at: [0, 2.36, 0.04] as const,
  /** Semi-axes. Taller than wide. The crown is at scale[1] in head-local. */
  scale: [0.46, 0.52, 0.46] as const,

  /**
   * Muzzle. Short, low, and set BACK into the face rather than projecting
   * forward of it.
   *
   * A cat's face is nearly flat from the front — the whole difference between
   * a cat and a bear in the lower half of the head is that a bear has a
   * snout sticking out and a cat has a small flat stop. Making this project
   * forward is what turns a cat into a small bear faster than anything else.
   *
   * In head-local: y -0.12 puts it just below the eyes, and z 0.31 keeps it
   * short of the skull's own 0.46 depth so it sits ON the face rather than in
   * front of it.
   */
  muzzle: {
    scale: [0.2, 0.13, 0.1] as const,
    at: [0, -0.12, 0.31] as const,
  },

  /** Nose. Tiny — a fraction of the muzzle — and just above it. */
  nose: {
    scale: [0.04, 0.028, 0.025] as const,
    at: [0, -0.06, 0.4] as const,
  },
} as const;

/**
 * Eyes.
 *
 * White sclera with a black slit pupil in it, which is what was asked for and
 * is also how a real cat looks when the light is on it: the pupil is a
 * VERTICAL SLIT and the white either side of it is what makes the eye read as
 * huge.
 *
 * The slit is the second most identifying feature after the ears. A round pupil
 * in a white eye is a cartoon character; a narrow vertical slit is a cat.
 *
 * Positions are FRACTIONS of the skull's own semi-axes rather than fixed
 * numbers, so scaling the head carries the face with it. The eye also sits
 * high and forward — a cat's eyes are on the front of the face for binocular
 * vision, not on the sides as a teddy's are.
 *
 * Head-local, like everything else under HEAD.
 */
export const EYE = {
  /** Fraction of the skull's x and y. */
  x: 0.41,
  y: 0.2,
  /** Radius of the white, in world units. */
  radius: 0.135,
  /** Half-width and half-height of the slit pupil. */
  pupil: [0.03, 0.105] as const,
  /** How far the pupil may travel inside the white when looking around. */
  gaze: 0.035,
} as const;

/**
 * Ears.
 *
 * Triangular, upright, and set on the CROWN — angled up and slightly out,
 * not on the sides of the head where a teddy's are. This is the clearest
 * silhouette difference in the whole character and the one most worth getting
 * right: low round ears make a cat indistinguishable from a bear no matter
 * what else is correct.
 *
 * The profile is a lathe rather than a cone. A cone is a spike, and a spike
 * reads as an antenna; this one widens from a narrow base, bulges, and comes
 * to a soft point, which is the shape a real ear has.
 *
 * The base sits at the crown MINUS a hair, not at the crown. A lathe starts
 * at its profile's first point and grows upward from there, so a base placed
 * exactly at the top of the skull puts the ear's own base below the surface
 * and most of the ear inside the head — which is exactly what happened on
 * the first build, where no ears were visible at all.
 */
export const EAR = {
  /** (radius, height) from the base upward. */
  profile: [
    [0.02, 0],
    [0.13, 0.03],
    [0.17, 0.13],
    [0.155, 0.25],
    [0.1, 0.35],
    [0.02, 0.42],
  ] as const,
  /**
   * Base position, per side, in head-local. The crown is at HEAD.scale[1] =
   * 0.52, and the ear's own profile starts at y = 0 and grows upward — so a
   * base exactly at the crown would start half a unit too low and bury the
   * whole ear in the skull. 0.46 puts the base just under the crown so the
   * ear grows out of the head.
   */
  at: [0.29, 0.46, -0.02] as const,
  /** Outward splay in radians, so the ears are not parallel. */
  tilt: 0.2,
  /** Front-to-back depth as a fraction of the ear's width. */
  depth: 0.45,
} as const;

/**
 * The body, sitting.
 *
 * A sitting cat is a TEARDROP: broad and heavy at the base, tapering up to
 * narrow shoulders. A teddy sits as a mound. This is the second thing that
 * separates them, and it comes from the torso being taller than wide with its
 * widest point low.
 */
export const TORSO = {
  scale: [0.46, 0.66, 0.42] as const,
  at: [0, 1.12, 0] as const,
  /**
   * The chest, a hair lighter than the coat. Subtle on purpose — a black
   * cat's markings show as a change in reflection rather than as a colour, and
   * a clearly lighter patch reads as a different animal underneath.
   */
  chest: {
    scale: [0.26, 0.34, 0.14] as const,
    at: [0, 1.42, 0.3] as const,
  },
  /**
   * The haunches — the folded hind legs, which are the widest part of a
   * sitting cat and sit ON the ground rather than under the body. Without
   * them a sitting cat looks like a standing one that has been shortened.
   */
  haunch: {
    scale: [0.3, 0.32, 0.34] as const,
    at: [0.42, 0.34, -0.04] as const,
  },
} as const;

/**
 * Front legs.
 *
 * Straight and vertical down the front of the chest, which is how a sitting
 * cat holds them. Straight columns, not tapered limbs — a cat's front leg is
 * almost a cylinder from shoulder to paw, and giving it an elbow or a taper
 * makes it read as an arm.
 *
 * They sit at the FRONT of the chest and close together, which is what stops
 * them from being swallowed by the torso. Placed at the body's own width they
 * end up behind the chest mass and invisible, and a cat with no visible
 * front legs reads as a featureless blob.
 */
export const LEG = {
  scale: [0.13, 0.46, 0.13] as const,
  at: [0.2, 1.14, 0.36] as const,
  paw: {
    scale: [0.16, 0.1, 0.2] as const,
    /** Offset from the leg's centre. */
    at: [0, -0.46, 0.06] as const,
  },
} as const;

/**
 * The tail.
 *
 * Built as a CHAIN rather than a swept tube, because the interaction is
 * dragging it. A fixed curve can only be posed at fixed angles; a chain of
 * segments can be pulled, whip and settle, which is the whole point of
 * letting someone hold a cat's tail.
 *
 * THE ROOT IS THE NUMBER THAT MATTERS
 *
 * A cat's tail grows out of the base of its spine, level with the hips and
 * behind them. Rooting it low puts it on the floor behind the cat, where it is
 * either hidden by the haunches or lies flat and reads as a shadow rather than
 * as a tail. The root sits just behind and slightly below the top of the
 * haunch — high enough to clear the body, low enough to look attached to the
 * spine rather than floating off the back.
 *
 * It curls out to one side and forward, which is where a relaxed cat carries
 * it. Straight up is a startled cat; straight back is an angry one.
 */
export const TAIL = {
  /** Number of segments. More is smoother and costs more per frame. */
  segments: 9,
  /** Length of each segment. */
  segment: 0.19,
  /** Radius at the base, tapering to a point. */
  radius: [0.105, 0.026] as const,
  /** Where the chain is rooted: behind and just above the haunches. */
  root: [-0.34, 0.62, -0.3] as const,
  /** Initial curl, as a rotation per joint in radians. */
  curl: 0.42,
  /** Which way it curls. */
  swing: -1,
} as const;

/**
 * Whiskers.
 *
 * Three a side, fanning from the muzzle. They are as much a part of a cat's
 * silhouette as the ears — a smooth face with no whiskers looks unfinished
 * even when everything else is right.
 *
 * The colour is the part that is easy to get wrong. On a black cat the
 * whiskers are LIGHTER than the coat, not darker: they catch the same light
 * the rim does, and a dark line against a dark face is a line you cannot
 * see. They are drawn slightly in front of the muzzle so they sit over the
 * coat rather than inside it.
 */
export const WHISKER = {
  count: 3,
  /** Length. */
  length: 0.62,
  /** Vertical fan across the three, as a fraction of the length. */
  spread: 0.34,
  /** Where they leave the muzzle, per side, in head-local. */
  at: [0.13, -0.12, 0.38] as const,
  /**
   * Lighter than the coat on purpose. A whisker darker than the face it
   * leaves is invisible, which is what made them vanish on the first build.
   */
  color: "#cfc6dc",
} as const;
