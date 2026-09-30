/**
 * The cast.
 *
 * One entry per character, and the menu is generated from this list rather
 * than hand-written. Adding a character means adding a line here — the
 * markup, the path it links to, and the drawing that represents it. Nothing
 * else in the menu needs to know the character exists.
 *
 * The figures are inline SVG rather than images or emoji. An emoji renders
 * differently on every platform — the teddy is a different bear on iOS,
 * Android and Windows, and it cannot blink or sway at all. Inline SVG is
 * styled by the same CSS as everything else, animates, scales without
 * pixelation, and is a few hundred bytes each.
 *
 * `hue` is the one number that varies a character, and it drives everything
 * derived from it: fur, shade, blush, ink. A whole palette from a single
 * hue keeps a growing cast coherent without anyone having to pick colours by
 * hand each time, which is what happens when each character hardcodes its
 * own palette.
 */

export type Figure = {
  /** One or two arcs of inline SVG, drawn in a 100x100 viewBox. */
  readonly paths: readonly string[];
};

export type Character = {
  readonly id: string;
  readonly name: string;
  /** Thai subtitle, shown under the name. */
  readonly tag: string;
  /** URL relative to the site root, with a leading slash. */
  readonly href: string;
  /** Base hue in degrees. Everything else is derived from it. */
  readonly hue: number;
  readonly figure: Figure;
  /** Marks a character that does not exist yet. */
  readonly soon?: boolean;
};

export const CHARACTERS: readonly Character[] = [
  {
    id: "teddy",
    name: "ตุ๊กตาหมี",
    tag: "ตอนนี้กำลังอยู่ตรงนี้",
    href: "/teddy/",
    hue: 4,
    figure: {
      paths: [
        // Ears.
        "<circle cx='27' cy='28' r='11'/>",
        "<circle cx='73' cy='28' r='11'/>",
        // Head.
        "<circle cx='50' cy='50' r='28'/>",
        // Muzzle.
        "<ellipse cx='50' cy='61' rx='17' ry='13' fill='var(--fur-pale)'/>",
        // Eyes, as buttons with a catchlight.
        "<circle cx='40' cy='46' r='5' fill='var(--ink)'/>",
        "<circle cx='60' cy='46' r='5' fill='var(--ink)'/>",
        "<circle cx='41.6' cy='44.4' r='1.6' fill='var(--fur-pale)'/>",
        "<circle cx='61.6' cy='44.4' r='1.6' fill='var(--fur-pale)'/>",
        // Nose.
        "<ellipse cx='50' cy='57' rx='4' ry='3' fill='var(--ink)'/>",
        // Mouth: a shallow arc, not a half-circle. A teddy's smile is flat.
        "<path d='M42 64 Q50 70 58 64' stroke='var(--ink)' stroke-width='2.6' fill='none' stroke-linecap='round'/>",
      ],
    },
  },
  {
    id: "soon",
    name: "กำลังมา",
    tag: "เตรียมไว้ให้คุณ",
    href: "#",
    hue: 320,
    soon: true,
    figure: {
      paths: [
        "<circle cx='50' cy='50' r='26'/>",
        "<circle cx='50' cy='50' r='26' fill='none' stroke='var(--ink)' stroke-width='2.5' stroke-dasharray='5 7' stroke-linecap='round'/>",
        "<circle cx='50' cy='45' r='3.2' fill='var(--ink)'/>",
        "<circle cx='50' cy='56' r='3.2' fill='var(--ink)'/>",
      ],
    },
  },
];