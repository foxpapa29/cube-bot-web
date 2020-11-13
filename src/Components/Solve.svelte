<script>
  import { fade } from 'svelte/transition';

  import Timer from './Timer.svelte';

  export let currentEvent;
</script>

<div class="container-fluid" in:fade={{ duration: 250 }}>
  <h1>{currentEvent}</h1>
  <div />
</div>
