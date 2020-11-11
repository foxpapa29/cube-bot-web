<script>
  import dayjs from 'dayjs';

  let startTime;
  let timeout;
  let allowed = true;
  let green = false;
  let red = false;
  let running = false;
  let timerColor = 'black';
  let timerText = 'Ready';
  let waiting = false;

  const msToTime = (t) => {
    const time = Number(t);

    const min = Math.floor(time / (60 * 1000));
    let s = ((time - min * 60 * 1000) / 1000).toFixed(2);
    if (min > 0 && s.length === 4) {
      s = '0' + s;
    }

    return `${min ? min + ':' : ''}${s}`;
  };

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

    timerText = msToTime(dayjs().diff(startTime));
  };

  const timerSetReady = () => {
    waiting = false;
    timerText = '0.00';
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
    } else if (event.code === 'Space') {
      timerSetReady();
    }
    allowed = false;
  };

  const up = (event) => {
    if (!running && !waiting && event.code === 'Space') {
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
  class="display-1 text-center"
  class:green
  class:red
  on:touchstart={() => down({ code: 'Space' })}
  on:touchend={() => up({ code: 'Space' })}>
  {timerText}
</h1>
