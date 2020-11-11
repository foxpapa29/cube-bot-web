<script>
  import Navbar from './Components/Navbar.svelte';
  import Login from './Components/Login.svelte';
  import Dashboard from './Components/Dashboard.svelte';
  import Solve from './Components/Solve.svelte';

  let isLoggedin = false;
  let currentEvent = '';
</script>

<style>
  .spacing {
    height: 40px;
  }
</style>

<Navbar bind:isLoggedin bind:currentEvent />

<div class="spacing" />
{#if isLoggedin}
  {#if !currentEvent}
    <Dashboard bind:currentEvent />
  {:else}
    <Solve bind:currentEvent />
  {/if}
{:else}
  <Login />
{/if}
