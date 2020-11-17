<script>
  import { fade } from "svelte/transition";
  import * as R from "ramda";

  import Timer from "./Timer.svelte";
  import TimeList from "./TimeList.svelte";
  import { apiUrl } from "./config";
  export let currentEvent;
  export let times;
  export let userID;

  let scrambles = [];

  const newTime = (t) =>
    (times[currentTimesIndex].solves = [
      ...times[currentTimesIndex].solves,
      [t, 0],
    ]);

  $: fetch(`${apiUrl}/api/scrambles/${currentEvent}/2020-11-15`)
    .then((res) => res.json())
    .then((s) => (scrambles = s.scrambles));

  $: currentTimesIndex = R.findIndex(R.propEq("event")(currentEvent))(times);
  $: currentTimesArray = times[currentTimesIndex].solves;
  $: currentScramble = scrambles[R.length(currentTimesArray)] ?? "";
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
        bind:userID />
      <!-- <div class="row">
        <div class="col-12">
          <div id="kpuzzleSVG">
            {@html scrambleSVG}
          </div>
        </div>
      </div> -->
    </div>
  </div>
</div>
