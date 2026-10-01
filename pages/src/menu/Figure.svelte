<script lang="ts">
  /**
   * One character figure.
   *
   * The SVG is generated from the character's paths so the markup lives in
   * one place. The animation is entirely CSS — a walk cycle, a blink, and a
   * hover lift — which means the GPU does the work and the component itself
   * holds no animation state at all.
   *
   * The walk is a single `translateY` keyframe on the figure, not a set of
   * transforms on limbs. A two-legged walk cycle needs several moving parts
   * to read properly, and at the size these figures appear in the menu the
   * bob alone reads as walking; anything more would be motion that draws
   * attention away from the name.
   *
   * `soaked` characters are dashed outlines and do not walk, because a
   * character that does not exist yet should not look like it is playing.
   */
  import type { Character } from "./characters";

  let {
    character,
    index = 0,
  }: { character: Character; index?: number } = $props();

  /**
   * The palette, flattened onto the element as custom properties.
   *
   * The SVG paths reference colours as `var(--main)`, `var(--skin)` and so
   * on, so the whole palette has to reach the element as real custom
   * properties rather than being passed to the SVG some other way. `--hue`
   * is set alongside it because the card's own background and border are
   * built from the character's hue, which is separate from the colours the
   * character is drawn with.
   */
  const vars = $derived.by(() => {
    const out = [`--hue:${character.hue}`];
    for (const [name, value] of Object.entries(character.palette)) {
      if (value) out.push(`--${name}:${value}`);
    }
    return out.join(";");
  });
</script>

<a
  class="figure"
  class:soon={character.soon}
  href={character.soon ? undefined : character.href}
  style={`${vars}; --i:${index}`}
  aria-label={`${character.name} — ${character.tag}`}
>
  <span class="figure__shadow" aria-hidden="true"></span>

  <span class="figure__body" aria-hidden="true">
    <svg viewBox="0 0 100 100" role="presentation">
      {#each character.figure.paths as d}
        <!-- eslint-disable-next-line svelte/no-at-html-tags -->
        {@html d}
      {/each}
    </svg>
  </span>

  <span class="figure__name">{character.name}</span>
  <span class="figure__tag">{character.tag}</span>
</a>

<style>
  .figure {
    /* The character's own colours arrive as custom properties set inline
       from its palette, so nothing here declares them — this block is only
       the card's surface, which is built from the character's hue so the
       surroundings always harmonise with it. */
    display: grid;
    justify-items: center;
    gap: 2px;
    padding: 18px 14px 20px;
    text-decoration: none;
    color: inherit;
    border-radius: 26px;
    background: hsl(var(--hue) 60% 97%);
    border: 2.5px solid hsl(var(--hue) 45% 82%);
    position: relative;
    isolation: isolate;
    transition:
      transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1),
      border-color 0.2s,
      box-shadow 0.28s;

    /* Staggered entrance: each card arrives after the one before it, which
       reads as the group introducing itself rather than as a page loading. */
    animation: card-in 0.5s cubic-bezier(0.34, 1.4, 0.64, 1) backwards;
    animation-delay: calc(var(--i) * 90ms + 200ms);
  }

  .figure:not(.soon):hover,
  .figure:not(.soon):focus-visible {
    transform: translateY(-8px) rotate(-1.5deg);
    border-color: hsl(var(--hue) 62% 66%);
    box-shadow: 0 12px 0 -4px hsl(var(--hue) 50% 86%);
  }

  .figure:not(.soon):active {
    transform: translateY(-2px) scale(0.97);
  }

  /* The ground shadow is the cheapest possible proof that a thing is standing
     on a surface: it gives the figure a floor without drawing one. */
  .figure__shadow {
    width: 62%;
    height: 9px;
    border-radius: 50%;
    background: radial-gradient(ellipse, hsl(var(--hue) 45% 78% / 0.9), transparent 70%);
    transition: transform 0.28s cubic-bezier(0.34, 1.56, 0.64, 1);
  }

  .figure:not(.soon):hover .figure__shadow,
  .figure:not(.soon):focus-visible .figure__shadow {
    transform: scaleX(0.72);
    opacity: 0.6;
  }

  .figure__body {
    display: block;
    width: 78%;
    /* Two bob cycles over 2.4s. The `alternate` direction and the
       ease-in-out make it read as weight shifting rather than as a bounce
       loop, which is what separates a walk from a jump. */
    animation: walk 2.4s ease-in-out infinite alternate;
  }

  .soon .figure__body {
    animation: none;
  }

  .figure:not(.soon):hover .figure__body {
    animation-duration: 1.1s;
  }

  /* Defaults only. Every path that needs a colour sets its own fill, and
     the ones that do not fall back to the character's main colour — so a
     path with no fill still belongs to the character rather than coming out
     black. */
  .figure__body svg {
    display: block;
    width: 100%;
    height: auto;
    fill: var(--main);
    stroke: none;
    overflow: visible;
  }

  .figure__name {
    font-size: 15px;
    font-weight: 800;
    /* --ink is dark on every character by construction, which is what makes
       it safe for the name; the names must stay legible and the characters'
       own ink colour may not be. */
    color: hsl(var(--hue) 30% 24%);
    margin-top: 6px;
  }

  .figure__tag {
    font-size: 11.5px;
    color: hsl(var(--hue) 25% 46%);
  }

  .soon {
    cursor: default;
    background: hsl(var(--hue) 30% 97%);
    border-style: dashed;
    border-color: hsl(var(--hue) 30% 86%);
    opacity: 0.72;
  }

  .soon .figure__body svg {
    fill: transparent;
    stroke: hsl(var(--hue) 30% 30%);
  }

  @keyframes walk {
    from {
      transform: translateY(0) rotate(-1deg);
    }
    to {
      transform: translateY(-7px) rotate(1deg);
    }
  }

  @keyframes card-in {
    from {
      opacity: 0;
      transform: translateY(22px) scale(0.94);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .figure,
    .figure__body {
      animation: none;
    }
    .figure {
      transition: none;
    }
  }
</style>