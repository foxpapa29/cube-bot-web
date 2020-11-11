<script>
  import { fly } from 'svelte/transition';
</script>

<style>
  main {
    text-align: center;
    position: relative;
    top: 30%;
  }

  h1 {
    text-transform: uppercase;
  }
</style>

<main in:fly={{ y: -150, duration: 3000 }}>
  <h1>Cube Competitions</h1>
  <p>You must log in to discord to continue</p>
</main>
