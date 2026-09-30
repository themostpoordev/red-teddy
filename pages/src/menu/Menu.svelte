<script lang="ts">
  /**
   * The menu.
   *
   * A landing page that picks a character. It is deliberately small: the whole
   * page is a title, a short line, and a row of cards, because the job of a
   * menu is to get someone to a character and nothing else.
   *
   * Svelte rather than a framework, and no router. A framework would add a
   * runtime and a build step to render a list — the teddy page is plain
   * TypeScript and three.js, and the menu should not be heavier than the
   * thing it links to. If this page ever grows state, data fetching or real
   * routing, that is when a framework earns its place; until then it does not.
   */
  import { CHARACTERS } from "./characters";
  import Figure from "./Figure.svelte";
  import Sky from "./Sky.svelte";
</script>

<Sky />

<main>
  <header class="intro">
    <h1>
      <span class="intro__mark">thd</span>
      <span class="intro__dot" aria-hidden="true"></span>
    </h1>
    <p class="intro__lede">เลือกเพื่อนของเธอ</p>
    <p class="intro__note">แตะตัวไหนก็ไปเล่นกับเขาได้เลย</p>
  </header>

  <nav aria-label="ตัวละคร">
    <ul class="cast">
      {#each CHARACTERS as character, i (character.id)}
        <li>
          <Figure {character} index={i} />
        </li>
      {/each}
    </ul>
  </nav>
</main>

<style>
  main {
    position: relative;
    /* Above the sky, which is fixed at z-index 0. */
    z-index: 1;
    min-height: 100svh;
    display: grid;
    align-content: center;
    justify-items: center;
    gap: 40px;
    padding: 48px 20px calc(48px + env(safe-area-inset-bottom));
    box-sizing: border-box;
  }

  .intro {
    text-align: center;
    animation: intro-in 0.6s cubic-bezier(0.34, 1.3, 0.64, 1) backwards;
  }

  .intro h1 {
    margin: 0;
    font-size: clamp(30px, 8vw, 46px);
    font-weight: 900;
    letter-spacing: -0.02em;
    color: var(--ink);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
  }

  .intro__dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    background: var(--accent);
    /* The dot beside the wordmark breathes slowly. It is the one piece of
       motion in the header, so it reads as the page being alive rather than
       as decoration competing with the characters below. */
    animation: pulse 2.6s ease-in-out infinite;
  }

  .intro__lede {
    margin: 10px 0 0;
    font-size: clamp(16px, 4.5vw, 20px);
    font-weight: 700;
    color: var(--ink-soft);
  }

  .intro__note {
    margin: 4px 0 0;
    font-size: 13px;
    color: var(--ink-60);
  }

  .cast {
    /* Wraps rather than scrolls. A horizontal scroller hides the second
       character behind an edge, which makes the cast look like it has one
       member. */
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 18px;
  }

  /* Wide enough that the figure is the point of the card. At 168px the bear
     was a thumbnail; the card has to sell the character before it sells the
     name. */
  .cast > li {
    width: min(208px, 46vw);
  }

  @keyframes pulse {
    0%,
    100% {
      transform: scale(1);
      opacity: 1;
    }
    50% {
      transform: scale(1.35);
      opacity: 0.65;
    }
  }

  @keyframes intro-in {
    from {
      opacity: 0;
      transform: translateY(-14px);
    }
    to {
      opacity: 1;
      transform: none;
    }
  }

  @media (prefers-reduced-motion: reduce) {
    .intro,
    .intro__dot {
      animation: none;
    }
  }
</style>