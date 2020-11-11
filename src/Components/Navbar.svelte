<script>
  export let isLoggedin;
  export let currentEvent;
  const events = ['333', '222', '444', 'minx'];
</script>

<nav class="navbar navbar-expand-sm navbar-dark bg-dark fixed-top">
  <div class="container-fluid">
    <div class="navbar-brand" on:click={() => (currentEvent = '')}>
      Cube Competitions
    </div>
    {#if isLoggedin}
      <button
        class="navbar-toggler"
        type="button"
        data-toggle="collapse"
        data-target="#navbarText"
        aria-controls="navbarText"
        aria-expanded="false"
        aria-label="Toggle navigation">
        <span class="navbar-toggler-icon" />
      </button>

      <div class="collapse navbar-collapse" id="navbarText">
        <div class="navbar-nav mr-auto mb-2 mb-lg-0">
          <div class="nav-link" href="#">Rankings</div>
        </div>
        {#if currentEvent}
          <span class="dropdown">
            <button
              class="btn btn-outline-light dropdown-toggle"
              type="button"
              id="navbarDropdown"
              data-toggle="dropdown"
              aria-haspopup="true"
              aria-expanded="false">
              {currentEvent}
            </button>
            <div
              class="dropdown-menu dropdown-menu-sm-right"
              aria-labelledby="navbarDropdown">
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
      </div>
    {:else}
      <a
        class="btn btn-light text-reset"
        href="#"
        on:click={() => (isLoggedin = !isLoggedin)}>Log in</a>
    {/if}
  </div>
</nav>
