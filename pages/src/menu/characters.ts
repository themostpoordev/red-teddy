/**
 * The cast.
 *
 * One entry per character, and the menu is generated from this list rather
 * than hand-written. Adding a character means adding one entry here — its
 * name, where it links, its colours, and the drawing that represents it.
 * Nothing else in the menu needs to know the character exists.
 *
 * The figures are inline SVG rather than images or emoji. An emoji renders
 * differently on every platform — the teddy is a different bear on iOS,
 * Android and Windows — and it cannot blink or sway at all. Inline SVG is
 * styled by the same CSS as everything else, animates, scales without
 * pixelation, and is a few hundred bytes each.
 */

/**
 * A character's colours, as CSS custom property names without the leading
 * dashes.
 *
 * The names are semantic rather than numeric — `fur` rather than
 * `colour-2` — because the SVG paths reference them by name and a reader
 * needs to know what a fill is for without counting fills. A character with
 * a different set of parts just declares a different set of names; unused
 * ones are harmless, and missing ones fall back to `ink` so a typo shows up
 * as a wrong colour rather than as nothing at all.
 *
 * The palette started as a single hue from which everything was derived,
 * which is enough for a character that is one colour all over — which is all
 * the teddy is. A character with two or three unrelated colours cannot be
 * built that way without collapsing into a monochrome head, so the values are
 * declared directly.
 */
export type Palette = {
  /** The character's main colour: fur, or hair. */
  readonly main: string;
  /** A lighter version of `main`, for highlights and the mouth area. */
  readonly pale: string;
  /** A darker version of `main`, for shading and the far side. */
  readonly shade: string;
  /** Eyes, and any other small dark accent. */
  readonly iris: string;
  /** Line work. Outlines, lashes, pupils. */
  readonly ink: string;
  /** Cheeks. Optional — falls back to `main`. */
  readonly blush?: string;
  /** Any further colours a character's drawing needs. */
  readonly [key: string]: string | undefined;
};

export type Figure = {
  /** SVG drawn in a 100x100 viewBox, back to front. */
  readonly paths: readonly string[];
};

export type Character = {
  readonly id: string;
  readonly name: string;
  /** Thai subtitle, shown under the name. */
  readonly tag: string;
  /** URL relative to the site root, with a leading slash. */
  readonly href: string;
  /**
   * The hue the card itself is built around, in degrees. Separate from the
   * palette: the card's background and border come from this, so a
   * character's surroundings always harmonise with it even when the character
   * itself is many colours.
   */
  readonly hue: number;
  readonly palette: Palette;
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
    palette: {
      main: "hsl(var(--hue) 72% 62%)",
      pale: "hsl(var(--hue) 68% 88%)",
      shade: "hsl(var(--hue) 60% 52%)",
      iris: "hsl(var(--hue) 32% 20%)",
      ink: "hsl(var(--hue) 32% 20%)",
      blush: "hsl(var(--hue) 88% 74%)",
    },
    figure: {
      paths: [
        // Ears.
        "<circle cx='27' cy='28' r='11'/>",
        "<circle cx='73' cy='28' r='11'/>",
        // Head.
        "<circle cx='50' cy='50' r='28'/>",
        // Muzzle.
        "<ellipse cx='50' cy='61' rx='17' ry='13' fill='var(--pale)'/>",
        // Eyes, as buttons with a catchlight.
        "<circle cx='40' cy='46' r='5' fill='var(--iris)'/>",
        "<circle cx='60' cy='46' r='5' fill='var(--iris)'/>",
        "<circle cx='41.6' cy='44.4' r='1.6' fill='var(--pale)'/>",
        "<circle cx='61.6' cy='44.4' r='1.6' fill='var(--pale)'/>",
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
    palette: {
      main: "hsl(320 40% 92%)",
      pale: "hsl(320 40% 97%)",
      shade: "hsl(320 26% 78%)",
      iris: "hsl(320 26% 62%)",
      ink: "hsl(320 26% 52%)",
      blush: "hsl(320 40% 86%)",
    },
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
