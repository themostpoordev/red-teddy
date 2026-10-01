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
 * This started as a single `hue` from which everything was derived, which
 * worked for the teddy because it is one colour all over. The mermaid cannot
 * be built that way: pink hair, cream skin and gold eyes are three
 * unrelated hues, and deriving them from one would give her a monochrome
 * head. So a palette is declared per character instead.
 *
 * The names are semantic rather than numeric — `skin` rather than
 * `colour-2` — because the SVG paths reference them by name and a reader
 * needs to know what a fill is for without counting fills. A character with
 * a different set of parts just declares a different set of names; unused
 * ones are harmless, and missing ones fall back to `ink` so a typo shows up
 * as a wrong colour rather than as nothing at all.
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
    id: "mermaid",
    name: "นางเงือก",
    tag: "มาจากทะเลลึก",
    href: "/mermaid/",
    hue: 332,
    palette: {
      main: "hsl(332 76% 72%)",
      pale: "hsl(332 70% 90%)",
      shade: "hsl(332 62% 60%)",
      iris: "hsl(44 92% 62%)",
      ink: "hsl(268 42% 28%)",
      blush: "hsl(348 82% 78%)",
      skin: "hsl(30 68% 88%)",
      gold: "hsl(44 92% 62%)",
    },
    figure: {
      paths: [
        // Hair: the mass behind everything. Drawn first, wide, and reaching
        // well past the shoulders — stopping the hair at the jaw is the
        // single clearest way a character stops reading as anime.
        "<path d='M16 46c-2-19 15-32 34-32s36 13 34 32c-1 14-5 26-10 36-1-12-2-21-5-27-7 5-14 7-19 7s-12-2-19-7c-3 6-4 15-5 27-5-10-9-22-10-36z' fill='var(--shade)'/>",

        // A lighter inner layer so the mass behind the face is not one flat
        // block of colour, and the head reads as having volume.
        "<path d='M27 42c0-15 11-24 23-24s23 9 23 24c-4-8-12-13-23-13s-19 5-23 13z' fill='var(--main)'/>",

        // Face. Large and low: an anime face is a small oval inside a big
        // head mass, with the eyes sitting on its lower third.
        "<ellipse cx='50' cy='50' rx='23' ry='25' fill='var(--skin)'/>",

        // Fringe. Several overlapping locks rather than one curve — a single
        // fringe reads as a helmet. The locks are drawn from the top down so
        // each overlaps the one before, which is what gives the mass depth.
        "<path d='M26 46c1-16 11-25 24-25s23 9 24 25c-5-8-9-12-14-14-4 5-8 8-13 8-5 4-11 5-16 4-2 1-3 2-5 2z' fill='var(--main)'/>",
        "<path d='M40 24c-3 7-3 15-1 21 4-3 6-7 7-12 0-4-1-7-3-9z' fill='var(--main)'/>",
        "<path d='M60 25c3 6 4 14 3 20-4-3-6-7-7-11 0-4 1-7 3-9z' fill='var(--main)'/>",

        // Side locks framing the cheeks, reaching down to about the jaw. This
        // is what makes the face read as framed by hair rather than as a bald
        // head wearing a cap.
        "<path d='M24 42c-3 10-3 22 0 33 3-4 5-8 6-12-3-6-4-14-4-21z' fill='var(--main)'/>",
        "<path d='M76 42c3 10 3 22 0 33-3-4-5-8-6-12 3-6 4-14 4-21z' fill='var(--main)'/>",

        // The long lengths, drawn over the shoulders on both sides. They curl
        // outward at the tip rather than hanging straight, which is what
        // separates styled hair from a curtain.
        "<path d='M21 62c-2 10-1 20 3 27 1-8 0-16-1-22z' fill='var(--shade)'/>",
        "<path d='M79 62c2 10 1 20-3 27-1-8 0-16 1-22z' fill='var(--shade)'/>",

        // A few loose strands, off the head entirely. Small, and the reason
        // the silhouette is not a clean outline.
        "<path d='M17 34q-3 6-2 12' stroke='var(--main)' stroke-width='2' fill='none' stroke-linecap='round'/>",
        "<path d='M83 34q3 6 2 12' stroke='var(--main)' stroke-width='2' fill='none' stroke-linecap='round'/>",

        // Eyes. Large, low on the face, with a thick upper lash that hooks
        // up at the outer corner. Standard anime: sclera, iris, pupil, in
        // that order, so white shows at the corners.
        "<ellipse cx='42' cy='55' rx='10' ry='7.5' fill='#fff'/>",
        "<ellipse cx='58' cy='55' rx='10' ry='7.5' fill='#fff'/>",
        "<ellipse cx='42' cy='55' rx='7' ry='6.4' fill='var(--iris)'/>",
        "<ellipse cx='58' cy='55' rx='7' ry='6.4' fill='var(--iris)'/>",
        // Pupils, offset slightly inward so the gaze lands on the viewer.
        "<ellipse cx='42' cy='55' rx='3.2' ry='4.2' fill='var(--ink)'/>",
        "<ellipse cx='58' cy='55' rx='3.2' ry='4.2' fill='var(--ink)'/>",
        // Two catchlights, large and small. One alone reads as a human eye.
        "<circle cx='39.6' cy='52' r='2.2' fill='#fff'/>",
        "<circle cx='60.6' cy='52' r='2.2' fill='#fff'/>",
        "<circle cx='44' cy='57.6' r='1' fill='#fff'/>",
        "<circle cx='56' cy='57.6' r='1' fill='#fff'/>",
        // Upper lash, riding on top of the eye rather than across its middle.
        // Crossing the middle closes the eye — the line reads as a lid.
        "<path d='M32 52q5-6 10-6' stroke='var(--ink)' stroke-width='2.6' fill='none' stroke-linecap='round'/>",
        "<path d='M68 52q-5-6-10-6' stroke='var(--ink)' stroke-width='2.6' fill='none' stroke-linecap='round'/>",

        // Brows, well above the lashes and much thinner than them. At equal
        // weight a face reads as heavy rather than as drawn.
        "<path d='M35 41q5-3 9 0' stroke='var(--shade)' stroke-width='1.5' fill='none' stroke-linecap='round'/>",
        "<path d='M65 41q-5-3-9 0' stroke='var(--shade)' stroke-width='1.5' fill='none' stroke-linecap='round'/>",

        // Blush — two soft ovals, the standard anime tell.
        "<ellipse cx='32' cy='65' rx='6' ry='3' fill='var(--blush)' opacity='.85'/>",
        "<ellipse cx='68' cy='65' rx='6' ry='3' fill='var(--blush)' opacity='.85'/>",

        // Nose: a single tick, not a drawn shape.
        "<path d='M50 64v2.5' stroke='var(--ink)' stroke-width='1.3' stroke-linecap='round' opacity='.7'/>",

        // Mouth. Small and open rather than a wide grin — an anime expression
        // is a shape, not a curve, and a curve at this size reads as a smirk.
        "<path d='M47 70q3 3.4 6 0z' fill='var(--ink)'/>",

        // Earrings.
        "<circle cx='25' cy='64' r='1.7' fill='var(--gold)'/>",
        "<circle cx='75' cy='64' r='1.7' fill='var(--gold)'/>",

        // Shoulders and the top of the bodice, so the figure ends in a body
        // rather than in a cut-off neck. The gold trim is the accent: gold is
        // used where the eye lands, never as a large fill.
        "<path d='M36 78q14-6 28 0 7 7 8 16H28q1-9 8-16z' fill='var(--skin)'/>",
        "<path d='M38 84q12-5 24 0l3 10H35z' fill='var(--main)'/>",
        "<path d='M38 84q12-5 24 0' stroke='var(--gold)' stroke-width='1.6' fill='none' stroke-linecap='round'/>",
      ],
    },
  },
];