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
  update(dt: number, elapsed: number): void;
  /** Head pat: a quick tap. Hearts, a small recoil. */
  pat(): void;
  /** Belly squeeze: the belly squashes and springs back. */
  squash(): void;
  /** Hop to a world-space target on the floor. */
  hopTo(target: THREE.Vector3): void;
  /**
   * A petting stroke has been recognised. Fired once, the moment a press on
   * the head travels far enough to stop being a tap — not on the press frame,
   * which is what made a stroke read as a burst of separate taps.
   */
  petBegin(): void;
  /**
   * The stroke continues. `x` and `y` are the pointer's normalised position,
   * so the head can lean away from the touch the way a real head does under a
   * hand rather than merely following it.
   */
  petMove(x: number, y: number): void;
  /** The stroke ended. */
  petEnd(): void;
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

  /**
   * Petting.
   *
   * Four values, because the gesture has several distinct parts and
   * collapsing them is what makes a stroke read as a twitch rather than as a
   * touch being enjoyed.
   *
   *   petAmount  how engaged the character is, 0..1. Rises on recognition of
   *              the stroke and decays after it ends, so the whole body eases
   *              into and out of being petted rather than snapping.
   *   petX/petY  where the touch is, smoothed. The head turns INTO the
   *              stroke — an animal being stroked leans into the hand, and
   *              leaning away reads as a flinch, which is exactly what it
   *              looked like before this was corrected.
   *   petSpeed   how fast the hand is travelling, which the head lags behind.
   *              A head that tracks a hand perfectly is a cursor; a head
   *              that trails it and catches up has weight.
   */
  let petAmount = 0;
  let petTargetX = 0;
  let petTargetY = 0;
  let petX = 0;
  let petY = 0;
  let petHeartTimer = 0;
  /**
   * How fast the hand is currently travelling across the head, in normalised
   * units per second.
   *
   * A stroke's speed is what the body should answer to. Move the hand slowly
   * and the bear settles; move it quickly and the head lags and catches up,
   * because a heavy head does not snap to follow a fast hand. Without this the
   * head tracks the hand perfectly and reads as a cursor, not as weight.
   */
  let petSpeed = 0;
  /**
   * The head's yaw, integrated as a spring rather than eased toward a target.
   *
   * `petSpringAngle` is the value itself and `petSpringVelocity` its rate, so
   * the two carry the head's momentum between frames. An exponential damp has
   * no memory of how fast something was already going, which is why a head
   * driven by one arrives and stops dead at the hand — it looks like a servo
   * rather than like something with weight.
   *
   * Kept separate from petX on purpose: petX is where the hand IS, and the
   * head does not need to be there. Letting the two diverge for a few frames
   * is what produces the carry-past-and-settle that reads as a heavy head
   * being stroked.
   */
  let petSpringAngle = 0;
  let petSpringVelocity = 0;

  /**
   * Seconds between hearts while being petted.
   *
   * 0.45 is chosen against the heart's own lifetime of 1.5s: at this spacing
   * roughly three are alive at once, so a stroke produces a small trail
   * rather than a single pop or a solid cloud. Faster and the trail becomes
   * a wall; slower and the character stops seeming to react.
   */
  const PET_HEART_INTERVAL = 0.45;

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

    petBegin() {
      petAmount = 1;
      // Hearts, but sparingly — a tap is a single delighted reaction, a stroke
      // is a sustained one, and a heart every frame would be noise. The update
      // loop emits on a timer instead; see PET_HEART_INTERVAL.
    },

    petMove(x, y) {
      // Re-assert the level on every move, not just once at petBegin.
      //
      // This is what was making the response feel weak. The gesture was a
      // single impulse that then decayed, so the bear lit up for a moment
      // and faded over the next second and a half — but a stroke does not
      // work that way. The hand is still on the head, still moving, and the
      // character should still be responding for as long as it is. Holding
      // the level up here means the response is sustained by the contact
      // itself: pause your hand and it eases, keep stroking and it stays.
      //
      // The decay still runs, and still matters — it is what carries the
      // release once the hand leaves, and what lets a momentary gap during a
      // stroke relax rather than snap.
      petAmount = 1;
      petTargetX = x;
      petTargetY = y;
    },

    petEnd() {
      // Deliberately does nothing to petAmount. It decays on its own in the
      // update loop, so lifting the finger lets the character ease out of the
      // gesture instead of dropping out of it — a hard cut reads as the
      // touch being taken away.
    },

    hopTo(target: THREE.Vector3) {
      // Ignore a tap while already airborne, otherwise rapid taps queue jumps
      // the bear has to finish before the next one starts.
      if (hopPhase !== "idle") return;
      hopTarget = target.clone();
      hopPhase = "launch";
      hopT = 0;
    },

    update(dt, elapsed) {
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
        // A long release. 0.7 put the whole gesture out in about 1.4s, which
        // is too short for a stroke to read as sustained — the head would
        // have faded before a slow pet had finished crossing the skull. At
        // 0.3 it holds for roughly three seconds, so the character stays
        // melted for as long as the hand is on it and eases out afterwards.
        petAmount = Math.max(0, petAmount - dt * 0.3);
        // Speed falls faster than the amount, since it is derived from motion
        // and there is no motion once the hand has gone.
        petSpeed = Math.max(0, petSpeed - dt * 3);
      }

      // --- pet heartbeat -------------------------------------------------
      // Hearts on a timer while being petted, not on every frame. A stroke can
      // run for a second or more, and one heart per frame would be a solid
      // wall of them; on a timer it reads as the character reacting
      // throughout, which is the point of a sustained touch.
      if (!quiet && petAmount > 0.5) {
        petHeartTimer -= dt;
        if (petHeartTimer <= 0) {
          petHeartTimer = PET_HEART_INTERVAL;
          rig.head.getWorldPosition(scratch);
          hearts.burst(scratch, 1);
        }
      } else {
        petHeartTimer = PET_HEART_INTERVAL;
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
      // setBlink is called every frame, not only during a blink, because it
      // also carries the petting squint. Calling it only on blink frames —
      // which is what the old code did — means the squint is applied on
      // 0.14s of every few seconds and is invisible the rest of the time.
      if (quiet) {
        setBlink(0);
      } else if (blinkTimer < 0 && elapsed >= nextBlinkAt) {
        blinkTimer = 0;
      } else if (blinkTimer >= 0) {
        blinkTimer += dt;
        // 0.14s round trip: down fast, up slower.
        const p = blinkTimer / 0.14;
        setBlink(p < 0.45 ? p / 0.45 : 1 - (p - 0.45) / 0.55);
        if (p >= 1) {
          blinkTimer = -1;
          nextBlinkAt = elapsed + 1.8 + Math.random() * 3.4;
        }
      } else {
        // No blink in progress: still call it, to apply the resting squint.
        setBlink(0);
      }

      // --- breathing --------------------------------------------------
      if (!quiet) {
        const breath = Math.sin(elapsed * 1.9) * 0.5 + 0.5;
        // While being petted the breath deepens and the whole body goes
        // slightly slack — wider, a touch lower. This is the cue that sells
        // the gesture more than any of the others, because it is the only one
        // that reads as a change in the CHARACTER rather than a change in a
        // part. A head that turns and drops can be a head being looked at;
        // a body that loosens while a hand moves over it is a body relaxing.
        const melt = petAmount * 0.045;
        rig.body.scale.set(
          1 + breath * 0.022 + melt,
          1 + breath * 0.03 - melt * 0.6,
          1 + breath * 0.022 + melt,
        );
        // The ears drift out of phase with the breath so the character never
        // moves as a single rigid block — but they are set further down,
        // together with the press offset, so the whole pose is written once.
      }

      // --- head --------------------------------------------------------
      if (!quiet) {
        // The head does NOT follow the pointer. It used to, and that was the
        // single thing standing between the character and reading as a toy:
        // the head moved whether or not anyone touched it, so every reaction
        // had to compete with a constant idle motion, and a pat landed on a
        // head that was already swinging away. Nothing moves it now except a
        // touch — a pet leans it away from the hand, a belly press tips it
        // down to look, a pat recoils it. If nothing is happening, the head
        // is still, and stillness is what makes each of those read.
        //
        // The head turns TOWARD the touch, and that is the correction that
        // matters most.
        //
        // It was originally built to lean away, on the reasoning that a head
        // under a hand shifts weight away from it. That is how a head behaves
        // under a hand that is RESTING on it — but nobody pets a bear by
        // resting a hand on it. Petting is a repeated, moving touch, and an
        // animal being stroked turns INTO it. A real bear leans its head
        // into a stroke, presses up against the palm, and goes floppy and
        // heavy. Leaning away is a flinch, and it read as one: the head
        // twitched off to one side and sprang back, which looks exactly like
        // a click rather than a touch.
        //
        // So: toward, and further than the touch itself, so the muzzle ends
        // up under the hand rather than beside it.
        // Track the hand's position, and track it TIGHTLY.
        //
        // This is the ceiling on the whole gesture, and it was the reason the
        // response read as weak no matter what was added downstream: at
        // speed 9 the head sat at roughly half the hand's angle even when
        // the hand stopped moving, and no amount of stiffness in the spring
        // after it could recover a target that was itself half-sized. Raising
        // it to 22 helped but still left a third on the table. 40 puts the
        // head within a few percent of the hand in about a fifth of a
        // second, which is fast enough to feel connected and still slow
        // enough to smooth the raw event stream.
        petX = damp(petX, petTargetX, 40, dt);
        petY = damp(petY, petTargetY, 40, dt);

        // How far the head still has to travel this frame, per second. This
        // is the weight cue: on a fast stroke the head visibly trails the hand
        // and catches up after it slows, which is what a heavy head does and
        // what a directly-tracked one cannot.
        const dx = petTargetX - petX;
        const dy = petTargetY - petY;
        const rawSpeed = dt > 0 ? Math.hypot(dx, dy) / dt : 0;
        // Smoothed, because the raw figure spikes with every event and would
        // make the head twitch rather than lean.
        petSpeed = damp(petSpeed, rawSpeed, 8, dt);

        // Where the head is trying to be, this instant. The head always
        // ARRIVES here — a stroke must reach the hand no matter how fast it
        // is going.
        const follow = petX * 0.38;
        const target = petAmount > 0.01 ? follow : 0;

        // The weight, as a spring rather than as a lag.
        //
        // The first attempt at this lagged the head behind a fast hand, up to
        // half the angle. It read as heaviness in theory and as deafness in
        // practice: the faster someone petted, the further behind the head
        // fell, so a quick stroke produced a smaller response than a slow
        // one. Laying the target back and then chasing it with a spring
        // gives the arrival overshoot and settle — which is what mass looks
        // like — without ever withholding the response.
        //
        // The target drops to zero once the pet has faded, and the spring
        // carries the head home on its own momentum — which is why a release
        // eases back rather than snapping.
        //
        // Stiffness and damping are the standard pair. 26/7 is a soft,
        // floaty spring — pleasant for a one-off nudge, but it could not
        // keep up with a hand that never stopped moving, so the head
        // trailed the stroke by most of its width. 60/14 is roughly twice as
        // stiff with the damping raised in proportion, which keeps the same
        // overshoot ratio while arriving in about a third of the time. Raise
        // the first without the second and it visibly oscillates; the ratio
        // is what has to be held.
        const error = target - petSpringAngle;
        petSpringVelocity += (error * 60 - petSpringVelocity * 14) * dt;
        petSpringAngle += petSpringVelocity * dt;
        rig.head.rotation.y = petSpringAngle;
        // Recoil tilts the head back and away from the pat.
        rig.head.rotation.z = -recoil * 0.3;
        rig.head.position.y =
          HEAD_BASE_Y + patAmount * 0.06 - recoil * 0.05 - petAmount * 0.07;
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

        // Head tips DOWN and forward into the stroke, and the whole head
        // settles lower.
        //
        // This is the part that makes it read as pleasure rather than as a
        // twitch. A head that only turns is a head looking around; a head
        // that tips down and drops while the hand moves over it is a head
        // being stroked. The downward nod is small on its own, so it is
        // reinforced two more ways that a turn alone cannot fake: the head
        // sinks (see position.y above) and the eyes close further.
        rig.head.rotation.x = damp(
          rig.head.rotation.x,
          // Positive tips the face down. The petY term follows the hand up
          // and down, so a stroke travelling downward drags the muzzle along
          // with it rather than only tilting at a fixed angle.
          petAmount * (0.26 + petY * 0.14) + hugAmount * 0.24,
          5,
          dt,
        );

        // Ears flatten outward on the press, and go SOFT while being petted.
        //
        // The pet term pushes each ear past vertical and in the opposite
        // direction, so they lie back against the head rather than standing
        // at an angle. This is the single clearest whole-body signal that the
        // touch registered: an alert animal's ears go up and forward, a
        // contented one lets them drop. The press term is the opposite — ears
        // out — so the two gestures are readable as different from the ears
        // alone, without having to see the arms.
        const pet = petAmount * 0.62;
        const earL =
          EAR.rest + (quiet ? 0 : Math.sin(elapsed * 2.3) * 0.06) + hugAmount * 0.3 - pet;
        const earR =
          -EAR.rest - (quiet ? 0 : Math.sin(elapsed * 2.3 + 0.7) * 0.06) - hugAmount * 0.3 + pet;
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
    //
    // While being petted the eyes close most of the way — not a blink, but
    // the heavy half-shut look of an animal that has given up trying to stay
    // alert. It is the loudest signal in the whole gesture and the cheapest:
    // a scale on a mesh that already exists.
    //
    // 0.55 rather than something gentler, because a button eye at full size
    // is a flat black disc and reads as an eye staring at you. Closing it to
    // well under half turns the same shape into a curve, which is what a
    // contented squint looks like. It multiplies with the blink rather than
    // replacing it, so a stroke landing during a blink still shuts fully.
    const squint = 1 - petAmount * 0.55;
    const sy = Math.max(0.08, (1 - clamp(p, 0, 1)) * squint);
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
