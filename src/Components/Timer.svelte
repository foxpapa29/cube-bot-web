<script>
  import dayjs from "dayjs";
  import { createEventDispatcher } from "svelte";

  import { msToTime } from "../tools/calculator";
  const dispatch = createEventDispatcher();
  const updateTimesArray = (time) => dispatch("newTime", { time });

  let startTime;
  let timeout;
  let allowed = true;
  let green = false;
  let red = false;
  let running = false;
  let timerText = "Ready";
  let finalTime;
  let waiting = false;

  const displayTime = () => (timerText = msToTime(dayjs().diff(startTime)));

  const startTimer = () => {
    running = true;
    timeout = setInterval(displayTime, 10);
    startTime = dayjs();
    green = false;
  };

  const stopTimer = () => {
    running = false;
    waiting = true;
    red = true;
    clearTimeout(timeout);

    finalTime = dayjs().diff(startTime);
    timerText = msToTime(finalTime);
    updateTimesArray(finalTime);
  };

  const timerSetReady = () => {
    waiting = false;
    timerText = "0.00";
    green = true;
  };

  const timerAfterStop = () => {
    red = false;
  };

  const down = (event) => {
    if (!allowed) {
      return;
    }
    if (running) {
      stopTimer();
    } else if (event.code === "Space") {
      timerSetReady();
    }
    allowed = false;
  };

  const up = (event) => {
    if (!running && !waiting && event.code === "Space") {
      startTimer();
    } else {
      timerAfterStop();
    }
    allowed = true;
  };
</script>

<style>
  .red {
    color: red;
  }

  .green {
    color: green;
  }
</style>

<svelte:window on:keydown={down} on:keyup={up} />

<h1
  class="display-1"
  class:green
  class:red
  on:touchstart={() => down({ code: 'Space' })}
  on:touchend={() => up({ code: 'Space' })}>
  {timerText}
</h1>
