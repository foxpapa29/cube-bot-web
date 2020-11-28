<script>
  import { fade } from "svelte/transition";
  import { events } from "./config";

  export let currentEvent;
</script>

<style>
  .card {
    box-shadow: 0 0.125rem 0.25rem rgba(0, 0, 0, 0.075) !important;
    transition-duration: 0.5s;
  }
  .card:hover {
    box-shadow: 0 0.5rem 1rem rgba(0, 0, 0, 0.15) !important;
    transition-duration: 0.5s;
  }
</style>

<div class="container" in:fade={{ duration: 250 }}>
  <div
    class="row row-cols-1 row-cols-sm-2 row-cols-md-3 row-cols-xl-4 text-center">
    {#each events as e}
      <div class="col mt-4">
        <div class="card" on:click={() => (currentEvent = e)}>
          <img src="img/{e}.svg" class="card-img-top" alt={e} />
          <div class="card-footer bg-transparent">
            <h4 class="">{e}</h4>
          </div>
        </div>
      </div>
    {/each}
  </div>
</div>
