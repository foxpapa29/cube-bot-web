<script>
  import { fly } from 'svelte/transition';

  const events = ['333', '222', '444', 'minx', 'pyram'];
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

  .card {
    box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075) !important;
    transition-duration: 0.5s;
  }
  .card:hover {
    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
    transition-duration: 0.5s;
  }
</style>

<!-- <main transition:fly={{ y: -150, duration: 3000 }}>
  <h1>Cube Competitions</h1>
  <p>Log in to discord</p>
</main> -->

<nav class="navbar navbar-dark bg-dark">
  <span class="navbar-brand">
    <img
      src="https://cdn.discordapp.com/avatars/719150209602682961/f96a59f0d56be5698a9ce5fd72ddff92.png"
      width="30"
      height="30"
      class="d-inline-block align-top mr-1 rounded-circle"
      alt=""
      loading="lazy" />
    Welcome Mano
  </span>
</nav>

<div class="container">
  <div
    class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-xl-4 text-center">
    {#each events as e}
      <div class="col mt-4">
        <div class="card">
          <img src="img/{e}.svg" class="card-img-top" alt={e} />
          <div class="card-footer bg-transparent">
            <h4 class="">{e}</h4>
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>
