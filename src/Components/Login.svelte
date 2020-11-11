<script>
  import { fly } from 'svelte/transition';
</script>

<style>
  main {
    position: relative;
    top: 30%;
  }
</style>

<main class="text-center" in:fly={{ y: -150, duration: 3000 }}>
  <h1 class="display-3">CUBE COMPETITIONS</h1>
  <p class="lead">You must log in to discord to continue</p>
</main>
