<script>
  import * as R from "ramda";

  import Navbar from "./Components/Navbar.svelte";
  import Login from "./Components/Login.svelte";
  import Dashboard from "./Components/Dashboard.svelte";
  import Solve from "./Components/Solve.svelte";
  import Loading from "./Components/Loading.svelte";

  import { events } from "./Components/config";

  let loading = false;
  let currentEvent = "";
  let userID = localStorage.getItem("id");
  let username = localStorage.getItem("username");
  let avatar = localStorage.getItem("avatar");
  let token = localStorage.getItem("token");

  const urlParams = new URLSearchParams(window.location.search);

  const saveUserData = (id, username, avatar, token) => {
    localStorage.id = id;
    localStorage.username = username;
    localStorage.avatar = avatar;
    localStorage.token = token;
    localStorage.dscr = "👀";
  };

  const discordAuth = async () =>
    fetch(`/api/oauth/discord/${urlParams.get("code")}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.userInGuild) {
          userID = res.id;
          token = res.refresh_token;
          username = res.username;
          avatar = res.avatar;
          saveUserData(userID, username, avatar, token);
        }
      })
      .then(() => (window.location.search = ""));

  if (!username) {
    if (urlParams.has("code")) {
      loading = true;
      discordAuth();
    }
  }

  let times = R.map((event) => ({ event, solves: [] }), events);
</script>

{#if loading}
  <Loading />
{:else}
  <Navbar bind:userID bind:username bind:avatar bind:currentEvent />

  {#if userID}
    {#if !currentEvent}
      <Dashboard bind:currentEvent />
    {:else}
      <Solve bind:currentEvent bind:times />
    {/if}
  {:else}
    <Login />
  {/if}
{/if}
