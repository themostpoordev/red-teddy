<script lang="ts">
  /**
   * The sky behind the cast.
   *
   * Purely decorative and entirely CSS. It exists for one reason: the cast
   * needs something to stand against, and the flat paper of the page gives
   * a figure nowhere to sit. Clouds and a warm wash give the scene a ground
   * and a horizon without drawing a single box.
   *
   * Everything is `aria-hidden` and `pointer-events: none` — it must never
   * intercept a tap meant for a character, and a screen reader must never
   * announce a cloud.
   */
</script>

<div class="sky" aria-hidden="true">
  <span class="cloud cloud--a"></span>
  <span class="cloud cloud--b"></span>
  <span class="cloud cloud--c"></span>

  <!-- A handful of twinkles, hardcoded rather than generated. A loop over an
       array would produce the same markup with more indirection, and the count
       is small enough that the list is not worth abstracting. -->
  <span class="spark spark--a"></span>
  <span class="spark spark--b"></span>
  <span class="spark spark--c"></span>
  <span class="spark spark--d"></span>
  <span class="spark spark--e"></span>

  <span class="horizon"></span>
</div>

<style>
  .sky {
    position: fixed;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
    z-index: 0;
  }

  /* Clouds are built from one element with a box-shadow rather than from
     three overlapping divs. The shadow is the same shape repeated at offsets,
     so one border-radius draws the whole puff cluster and the markup stays
     one node per cloud. */
  .cloud {
    position: absolute;
    width: 64px;
    height: 26px;
    border-radius: 999px;
    background: hsl(28 60% 92% / 0.75);
    box-shadow:
      22px -10px 0 -4px hsl(28 60% 92% / 0.75),
      -20px -6px 0 -6px hsl(28 60% 92% / 0.75);
  }

  .cloud--a {
    top: 14%;
    left: 8%;
    transform: scale(1.05);
    animation: drift 34s linear infinite;
  }

  .cloud--b {
    top: 26%;
    right: 12%;
    transform: scale(0.8);
    opacity: 0.7;
    animation: drift 46s linear infinite reverse;
  }

  .cloud--c {
    top: 8%;
    left: 62%;
    transform: scale(0.6);
    opacity: 0.55;
    animation: drift 58s linear infinite;
  }

  /* Drifts across and wraps, so the sky is never the same twice and nothing
     ever visibly resets — the keyframe's 0% and 100% are identical, which is
     what makes the loop seamless. */
  @keyframes drift {
    from {
      translate: -18vw 0;
    }
    to {
      translate: 118vw 0;
    }
  }

  .spark {
    position: absolute;
    width: 4px;
    height: 4px;
    border-radius: 50%;
    background: hsl(40 90% 78%);
    /* Two dots per star with different sizes read as a four-point sparkle;
       one dot alone reads as dust. */
    box-shadow:
      0 0 0 1.5px transparent,
      0 0 8px 1px hsl(40 90% 78% / 0.7);
    animation: twinkle 3.2s ease-in-out infinite;
  }

  .spark--a { top: 18%; left: 22%; animation-delay: 0s; }
  .spark--b { top: 34%; left: 76%; animation-delay: 0.7s; }
  .spark--c { top: 12%; left: 84%; animation-delay: 1.4s; }
  .spark--d { top: 42%; left: 12%; animation-delay: 2.1s; }
  .spark--e { top: 22%; left: 46%; animation-delay: 2.8s; }

  /* The horizon is a soft warm band at the bottom. It gives the figures
     something to stand on without a hard edge, which would fight the
     rounded cards sitting on it. */
  .horizon {
    position: absolute;
    inset: auto 0 0;
    height: 34vh;
    background: linear-gradient(
      to top,
      hsl(24 68% 88%),
      hsl(24 68% 92% / 0.5) 45%,
      transparent
    );
  }

  @media (prefers-reduced-motion: reduce) {
    .cloud,
    .spark {
      animation: none;
    }
  }
</style>