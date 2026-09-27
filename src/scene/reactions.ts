/**
 * Reactions: everything the bear does on its own or in response to a poke.
 *
 * The state model is deliberately small. Rather than an animation system with
 * named clips, each reaction is a set of scalar offsets that decay back to zero
 * every frame. The pose is always `base + offsets`, so reactions compose
 * without a timeline and interrupting one mid-flight is free — a poke during a
 * hop simply adds its offsets on top of the hop.
 *
 * Idle behaviour is layered underneath, not instead of: breathing, blinking and
 * the gaze follow the pointer run at all times, and reactions layer on top.
 */

import * as THREE from "three";
import { clamp, damp, lerp } from "../core/math";
import { ARM_PRESS, EAR } from "../bear/proportions";
import type { Bear } from "../bear";
import type { Hearts } from "./hearts";

export type Reactions = {
  update(dt: number, elapsed: number, pointerActive: boolean, pointerX: number, pointerY: number): void;
  /** Head pat: smile, hearts, a small recoil. */
  pat(): void;
  /** Belly squeeze: the belly squashes and springs back. */
  squash(): void;
  /** Hop to a world-space target on the floor. */
  hopTo(target: THREE.Vector3): void;
  /** Set by the app so reactions can honour the OS motion preference. */
  reducedMotion: boolean;
};

export function createReactions(bear: Bear, hearts: Hearts): Reactions {
  const { rig } = bear;

  // --- reactive offsets, all decay to 0 --------------------------------
  let patAmount = 0;
  let squashAmount = 0;
  let recoil = 0;

  /**
   * How far the arms have travelled toward the hug, tracked separately from
   * how squashed the belly is.
   *
   * They cannot be the same value. The belly has to spring back fast or the
   * deformation lingers and reads as damage, but the arms were originally
   * driven off that same number — and because the arms damp toward their
   * target, they were still in transit when the belly had already recovered.
   * Traced, they peaked at 8% of the travel and turned around, so the hug
   * never happened at all. The arms need a slower release than the belly has.
   */
  let hugAmount = 0;

  // --- blink ----------------------------------------------------------
  // Blinks land on a randomised schedule rather than a fixed period, which is
  // what stops the loop from feeling mechanical.
  let nextBlinkAt = 2.4;
  let blinkTimer = -1;

  // --- hop ------------------------------------------------------------
  let hopTarget: THREE.Vector3 | null = null;
  let hopPhase: "idle" | "launch" | "air" | "land" = "idle";
  let hopT = 0;
  const HOP_UP = 0.55;
  const HOP_TIME = 0.62;

  // Scratch vectors, reused every frame — allocating here would be the one
  // place the render loop creates garbage.
  const scratch = new THREE.Vector3();

  /** Resting height of the head node. Kept here so the rig stays the only
   *  place the character's proportions are defined. */
  const HEAD_BASE_Y = rig.head.position.y;

  /**
   * Resting outward angle of each arm, read from the rig rather than
   * re-declared here. The rig already sets an angle that clears the torso,
   * derived from the body's actual dimensions; hardcoding a second copy in
   * the animation would silently drift out of sync the moment either side is
   * tuned, and the arm would sink back into the body.
   */
  const ARM_BASE_Z = Math.abs(rig.armR.rotation.z);

  const self: Reactions = {
    reducedMotion: false,

    pat() {
      patAmount = 1;
      recoil = 0.35;
      // Hearts come from just above the head, in world space.
      rig.head.getWorldPosition(scratch);
      hearts.burst(scratch, self.reducedMotion ? 3 : 6);
    },

    squash() {
      squashAmount = 1;
      // The arms commit on the same frame. See hugAmount for why this is a
      // separate value and not just the belly's amount reused.
      hugAmount = 1;
    },

    hopTo(target: THREE.Vector3) {
      // Ignore a tap while already airborne, otherwise rapid taps queue jumps
      // the bear has to finish before the next one starts.
      if (hopPhase !== "idle") return;
      hopTarget = target.clone();
      hopPhase = "launch";
      hopT = 0;
    },

    update(dt, elapsed, pointerActive, pointerX, pointerY) {
      const quiet = self.reducedMotion;

      // --- decay ------------------------------------------------------
      // patAmount lifts the head and raises the arms; it should linger
      // slightly longer than the recoil it triggers.
      //
      // hugAmount rises instantly on the press — the arms should commit to the
      // gesture, not drift into it — and falls at roughly a third of the
      // belly's rate, so they hold long enough to arrive and then let go
      // slowly. The mismatch is deliberate; see the declaration.
      if (!quiet) {
        patAmount = Math.max(0, patAmount - dt * 0.8);
        squashAmount = Math.max(0, squashAmount - dt * 2.6);
        recoil = Math.max(0, recoil - dt * 3.2);
        hugAmount = Math.max(0, hugAmount - dt * 0.85);
      }

      // --- gaze -------------------------------------------------------
      // The eyes do not move at all. An earlier version rotated the eyeball
      // and slid the iris within it; the iris sits offset from the eyeball's
      // centre, so the two motions compounded and the dark spot travelled
      // much further than either — the gaze visibly drifted across the face
      // instead of reading as a look. A cartoon eye is a fixed drawing.
      //
      // The sense that the character is following you comes entirely from the
      // head turn below, which is slower and lands correctly. The eyes only
      // ever blink.

      // --- blink ------------------------------------------------------
      if (quiet) {
        setBlink(0);
      } else {
        if (blinkTimer < 0 && elapsed >= nextBlinkAt) {
          blinkTimer = 0;
        }
        if (blinkTimer >= 0) {
          blinkTimer += dt;
          // 0.14s round trip: down fast, up slower.
          const p = blinkTimer / 0.14;
          setBlink(p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55);
          if (p >= 1) {
            blinkTimer = -1;
            nextBlinkAt = elapsed + 1.8 + Math.random() * 3.4;
          }
        }
      }

      // --- breathing --------------------------------------------------
      if (!quiet) {
        const breath = Math.sin(elapsed * 1.9) * 0.5 + 0.5;
        rig.body.scale.set(
          1 + breath * 0.022,
          1 + breath * 0.03,
          1 + breath * 0.022,
        );
        // The ears drift out of phase with the breath so the character never
        // moves as a single rigid block — but they are set further down,
        // together with the press offset, so the whole pose is written once.
      }

      // --- head follow ------------------------------------------------
      if (!quiet) {
        // The head is the only thing that tracks the pointer now. Keeping the
        // angle modest is what keeps it reading as a look rather than the
        // whole character swivelling at the cursor. The belly-press tip is
        // added to this further down, where the arms are set up.
        rig.head.rotation.y = damp(rig.head.rotation.y, pointerActive ? pointerX * 0.32 : 0, 5, dt);
        // Recoil tilts the head back and away from the pat.
        rig.head.rotation.z = -recoil * 0.3;
        rig.head.position.y = HEAD_BASE_Y + patAmount * 0.06 - recoil * 0.05;
      }

      // --- mouth ------------------------------------------------------
      // Nothing. The mouth is a single fixed mesh and never changes size,
      // shape or visibility.
      //
      // Earlier versions swapped to a larger mouth on a pat, which read as
      // the face distorting rather than as an expression. The pat is already
      // carried by the hearts, the raised arms and the head tilt; the mouth
      // does not need to join in, and a feature that stays put is what makes
      // the rest of the reactions legible.

      // --- belly squash ------------------------------------------------
      // Resting scale must match the rig, otherwise the belly visibly snaps
      // when the squash decays back to zero.
      const BELLY_REST: [number, number, number] = [0.5, 0.58, 0.34];
      if (!quiet && squashAmount > 0) {
        // Overshoot on the way out: a pure exponential decay back to rest
        // looks like a deflating balloon rather than a spring.
        const s = squashAmount;
        rig.belly.scale.set(
          BELLY_REST[0] * (1 + s * 0.22),
          BELLY_REST[1] * (1 - s * 0.3),
          BELLY_REST[2] * (1 + s * 0.28),
        );
      } else {
        rig.belly.scale.set(...BELLY_REST);
      }

      // --- hop --------------------------------------------------------
      updateHop(dt);

      // --- arms -------------------------------------------------------
      if (!quiet) {
        // Sign check, because getting this backwards is invisible in code and
        // obvious on screen. A limb hanging at (0, -d) from its pivot swings
        // toward +x under a positive rotation.z. So the LEFT arm, which sits
        // at negative x, needs a NEGATIVE angle to move further left
        // (outward) — and the right arm the mirror of that. Assigning both by
        // screen position instead of by swing direction folds the arms into
        // the torso, which is what they did.
        //
        // The rest angle is the rig's own, chosen so the paw clears the torso.
        // A second hardcoded rest value here would drift out of sync with the
        // rig the moment either side is retuned, and the paw would sink back
        // into the body.
        //
        // Sign discipline, because getting this backwards is invisible in the
        // code and obvious on screen — the user saw the arms fold into each
        // other. A limb hanging at (0, -d) from its pivot swings toward +x
        // under a positive rotation.z, and again toward +z under a positive
        // rotation.x. So for any signed swing s:
        //
        //   armL (at negative x) needs  -s  to go further left / further out
        //   armR (at positive x) needs  +s  to go further right / further out
        //
        // setArm() owns the mirror so no call site can get it wrong, and the
        // breathing swing is applied with the correct sign per side. The old
        // code pushed the same `swing` into both arms and then negated the
        // whole sum for the left, which meant the two arms swung in OPPOSITE
        // directions at all times — the bear was permanently shimmying.
        const swing = Math.sin(elapsed * 1.9) * 0.03;

        // A belly press is a different gesture from a head pat, so it moves
        // the arms the opposite way: the pat throws them UP, the press folds
        // them INWARD until the paws rest on the belly. Both decay to zero, so
        // whichever is active simply wins and the other blends out.
        //
        // The press angles are SOLVED, not tuned by eye — see ARM_PRESS. A paw
        // is 0.66 from the shoulder but the front of the belly is 0.87 away,
        // so a head-on hug is impossible; the solution lands the paws on the
        // belly's side. Writing the angles here instead of importing them
        // would put these numbers back to being guesses.
        //
        // hugAmount, not squashAmount — see its declaration. Driving the arms
        // off the belly's amount meant they were still travelling when the
        // belly had already sprung back, so they never arrived.
        const lift = patAmount * 0.85;
        const breathe = swing * (1 - hugAmount);

        // Lerp between the loose and firm solutions rather than snapping to
        // one, so the paws settle onto the belly instead of arriving there.
        const hugOut = lerp(ARM_PRESS.outLoose, ARM_PRESS.out, hugAmount);
        const hugReach = lerp(ARM_PRESS.reachLoose, ARM_PRESS.reach, hugAmount);

        // Resting pose. A downward limb swings toward +x under a positive z
        // rotation, so the right arm's outward swing is positive and the left
        // is its mirror.
        const out = lerp(ARM_BASE_Z, hugOut, hugAmount) + breathe + lift * 0.9;
        const reach = lerp(0, hugReach, hugAmount) - lift * 0.7;

        setArm(rig.armL, -out, reach, dt);
        setArm(rig.armR, out, reach, dt);

        // Head tips down to look at the belly it just had squashed. A
        // positive rotation.x moves the crown toward +z, i.e. the face tips
        // downward, which is the reading we want. Modest, so it stays a
        // glance rather than a nod. Driven off hugAmount for the same reason
        // the arms are — it has to hold for as long as they do.
        rig.head.rotation.x = damp(
          rig.head.rotation.x,
          (quiet ? 0 : pointerActive ? -pointerY * 0.16 : 0) + hugAmount * 0.24,
          5,
          dt,
        );

        // Ears flatten outward on the press. Unlike the eyes and blush, ears
        // are spheres seen edge-on rather than flat plates laid on the skull,
        // so a plain rotation is enough here — no surface normal to match.
        // Driven off hugAmount, matching the arms and the head, so the whole
        // pose arrives and leaves as one thing.
        const earL = EAR.rest + (quiet ? 0 : Math.sin(elapsed * 2.3) * 0.06) + hugAmount * 0.3;
        const earR = -EAR.rest - (quiet ? 0 : Math.sin(elapsed * 2.3 + 0.7) * 0.06) - hugAmount * 0.3;
        rig.earL.rotation.z = damp(rig.earL.rotation.z, earL, 6, dt);
        rig.earR.rotation.z = damp(rig.earR.rotation.z, earR, 6, dt);
      }
    },
  };

  /**
   * Resting size of the eye dome, read from the rig so the blink can scale
   *  it back to exactly what it was. Hardcoding a second copy would drift the
   *  moment the eye is retuned. */
  const DOME = rig.eyeL.dome.scale.clone();

  /**
   * Aims one arm. The z angle is the outward swing and the x angle the forward
   * reach, both passed in already signed for THIS side.
   *
   * Kept as one function so the two arms cannot drift apart: every call site
   * supplies the magnitude and the helper owns the mirror, rather than each
   * call site writing its own negation and one of them being wrong. That is
   * exactly how the arms came to fold into each other — the two sides were
   * spelled out independently and one sign was inverted.
   */
  function setArm(
    arm: THREE.Group,
    outZ: number,
    reachX: number,
    dt: number,
  ): void {
    arm.rotation.z = damp(arm.rotation.z, outZ, 7, dt);
    arm.rotation.x = damp(arm.rotation.x, reachX, 7, dt);
  }

  function setBlink(p: number): void {
    // Squashing the dome vertically closes the eye, the way a drawn eyelid
    // does. There is no iris to hide any more — the button eye is a single
    // form, so the whole thing squashing to a line is the blink.
    const sy = Math.max(0.08, 1 - clamp(p, 0, 1));
    rig.eyeL.dome.scale.set(DOME.x, DOME.y * sy, DOME.z);
    rig.eyeR.dome.scale.set(DOME.x, DOME.y * sy, DOME.z);
    // The catchlight goes with it. Left at full size it would sit on the
    // closed lid as a bright speck, which reads as a glitch.
    rig.eyeL.spark.visible = sy > 0.4;
    rig.eyeR.spark.visible = sy > 0.4;
  }

  function updateHop(dt: number): void {
    if (hopPhase === "idle") {
      bear.height = damp(bear.height, 0, 14, dt);
      rig.root.position.y = bear.height;
      return;
    }

    hopT += dt / HOP_TIME;

    if (hopPhase === "launch") {
      // Anticipation: compress before leaving the ground. Skipping it makes
      // the jump read as a teleport upward rather than a jump.
      if (hopT < 0.18) {
        const p = hopT / 0.18;
        rig.body.scale.set(1 + p * 0.1, 1 - p * 0.14, 1 + p * 0.1);
        return;
      }
      hopPhase = "air";
      hopT = 0;
    }

    if (hopPhase === "air") {
      // Parabola plus a slight overshoot on the way down, so the bear settles
      // rather than stopping dead at the apex.
      const p = clamp(hopT, 0, 1);
      bear.height = Math.sin(p * Math.PI) * HOP_UP + Math.max(0, (p - 0.86) / 0.14) * 0.09;
      rig.root.position.y = bear.height;
      // Stretch on the way up, squash on the way down.
      const stretch = Math.sin(p * Math.PI) * 0.12;
      rig.body.scale.set(1 - stretch * 0.6, 1 + stretch, 1 - stretch * 0.6);
      // Glide toward the target in both axes rather than only vertical.
      if (hopTarget) {
        rig.root.position.x = damp(rig.root.position.x, hopTarget.x, 6, dt);
        rig.root.position.z = damp(rig.root.position.z, hopTarget.z, 6, dt);
      }
      if (hopT >= 1) {
        hopPhase = "land";
        hopT = 0;
      }
      return;
    }

    if (hopPhase === "land") {
      // Impact compression, then release.
      const p = clamp(hopT / 0.32, 0, 1);
      const impact = Math.sin(p * Math.PI) * 0.16;
      rig.body.scale.set(1 + impact, 1 - impact, 1 + impact);
      rig.root.position.y = damp(rig.root.position.y, 0, 18, dt);
      bear.height = rig.root.position.y;
      if (p >= 1) {
        hopPhase = "idle";
        rig.body.scale.set(1, 1, 1);
      }
    }
  }

  return self;
}
