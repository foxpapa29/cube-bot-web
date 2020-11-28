<script>
  import "bootstrap/js/dist/dropdown";
  import * as R from "ramda";

  import { events } from "./config";

  export let userID;
  export let username;
  export let avatar;
  export let currentEvent;
</script>

<nav class="navbar navbar-expand-sm navbar-dark bg-dark ">
  <div class="container-fluid">
    <span class="navbar-brand mb-0 h1" on:click={() => (currentEvent = '')}>
      Cube Competitions
    </span>
    <button
      class="navbar-toggler"
      type="button"
      data-toggle="collapse"
      data-target="#navbarText">
      <span class="navbar-toggler-icon" />
    </button>
    <div class="collapse navbar-collapse" id="navbarText">
      <ul class="navbar-nav mr-auto mb-2 mb-lg-0" />
      <!-- For upcomming pages like rankings etc. -->
      {#if userID}
        {#if currentEvent}
          <span class="nav-item dropdown">
            <button
              class="btn btn-outline-light mr-2 dropdown-toggle"
              type="button"
              id="navbarDropdown"
              data-toggle="dropdown">
              {currentEvent}
            </button>
            <div class="dropdown-menu dropdown-menu-sm-right">
              <h6 class="dropdown-header">Event</h6>
              {#each events as e}
                {#if e !== currentEvent}
                  <button
                    class="dropdown-item"
                    href="#"
                    on:click={() => (currentEvent = e)}>{e}</button>
                {/if}
              {/each}
            </div>
          </span>
        {/if}
        <span class="nav-item dropdown">
          <button
            class="btn btn-outline-light dropdown-toggle"
            type="button"
            id="navbarDropdown"
            data-toggle="dropdown">
            {username}
            <img
              src="https://cdn.discordapp.com/avatars/{userID}/{avatar}{R.test(/^a_/, avatar) ? '.gif' : '.png'}"
              alt="discord avatar"
              height="25px"
              class="rounded-circle" />
          </button>
          <div class="dropdown-menu dropdown-menu-sm-right">
            <a
              class="dropdown-item text-reset text-decoration-none"
              href="/"
              on:click={() => localStorage.clear()}>Logout</a>
          </div>
        </span>
      {:else}
        <a
          class="btn btn-light text-reset text-decoration-none"
          href="https://discord.com/api/oauth2/authorize?client_id=476105820929654796&redirect_uri=http%3A%2F%2Flocalhost%3A8080%2F&response_type=code&scope=guilds%20identify">Log
          in</a>
      {/if}
    </div>
  </div>
</nav>
