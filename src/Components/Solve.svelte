<script>
  import { fade } from "svelte/transition";
  import * as R from "ramda";
  import dayjs from "dayjs";
  import confetti from "canvas-confetti";

  import Timer from "./Timer.svelte";
  import TimeList from "./TimeList.svelte";
  import { averageOfFiveCalculator, msToTime } from "../tools/calculator";

  export let currentEvent;
  export let times;

  let scrambles = [];
  let displayScrambles = localStorage.dscr === "👀";

  const newTime = (t) =>
    (times[currentTimesIndex].solves = [
      ...times[currentTimesIndex].solves,
      [t, 0],
    ]);

  $: fetch(`/api/scrambles/${currentEvent}/${dayjs().format("YYYY-MM-DD")}`)
    .then((res) => res.json())
    .then((s) => (scrambles = s.scrambles));

  $: currentTimesIndex = R.findIndex(R.propEq("event")(currentEvent))(times);
  $: currentTimesArray = times[currentTimesIndex].solves;
  $: currentScramble =
    scrambles[R.length(currentTimesArray)]?.scrambleString ?? "";
  $: currentSVG = scrambles[R.length(currentTimesArray)]?.svg ?? "";

  var count = 400;
  var defaults = {
    origin: { y: 0.7 },
  };

  function fire(particleRatio, opts) {
    confetti(
      Object.assign({}, defaults, opts, {
        particleCount: Math.floor(count * particleRatio),
      })
    );
  }

  fire(0.25, {
    spread: 26,
    startVelocity: 55,
  });
  fire(0.2, {
    spread: 60,
  });
  fire(0.35, {
    spread: 100,
    decay: 0.91,
    scalar: 0.8,
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 25,
    decay: 0.92,
    scalar: 1.2,
  });
  fire(0.1, {
    spread: 120,
    startVelocity: 45,
  });
</script>

<style>
  h1 {
    min-height: 200px;
  }

  .timer {
    min-height: 500px;
  }
</style>

<div class="container-fluid" in:fade={{ duration: 250 }}>
  <div class="row">
    <div class="col-sm-8">
      <div class="row">
        <div class="col-12 text-center">
          {#await currentScramble}
            <p>Waiting for scrambles</p>
          {:then x}
            <h1 class="display-5">{currentScramble}</h1>
          {/await}
        </div>
      </div>
      <div class="row">
        <div class="col-12">
          <div class="timer text-center">
            {#if R.equals(5, R.length(currentTimesArray))}
              <h1 class="display-1">Veuillez soumettre vos temps</h1>
            {:else}
              <Timer on:newTime={(e) => newTime(e.detail.time)} />
            {/if}
          </div>
        </div>
      </div>
    </div>
    <div class="col-sm-4">
      <TimeList
        bind:times
        bind:currentTimesArray
        bind:currentTimesIndex
        bind:displayScrambles />
      {#if R.equals(5, R.length(currentTimesArray))}
        <p>ao5: {msToTime(averageOfFiveCalculator(currentTimesArray))}</p>
      {:else if displayScrambles}
        <div class="row">
          <div class="col" id="svg">
            {@html currentSVG}
          </div>
        </div>
      {/if}
    </div>
  </div>
</div>
