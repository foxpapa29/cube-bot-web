<script>
  import Navbar from './Components/Navbar.svelte';
  import Login from './Components/Login.svelte';
  import Dashboard from './Components/Dashboard.svelte';
  import Solve from './Components/Solve.svelte';
  import Loading from './Components/Loading.svelte';

  let loading = false;
  let currentEvent = '';
  let userID = localStorage.getItem('id');
  let username = localStorage.getItem('username');
  let avatar = localStorage.getItem('avatar');

  const urlParams = new URLSearchParams(window.location.search);

  const saveUserData = (id, username, avatar) => {
    localStorage.id = id;
    localStorage.username = username;
    localStorage.avatar = avatar;
  };

  const getUserID = async () =>
    fetch(`http://localhost:3000/?code=${urlParams.get('code')}`)
      .then((res) => res.json())
      .then((res) => {
        if (res.isInGuild) {
          userID = res.id;
          username = res.username;
          avatar = res.avatar;
          saveUserData(userID, username, avatar);
        }
      })
      .then(() => (window.location.search = ''));

  if (!userID) {
    if (urlParams.has('code')) {
      loading = true;
      getUserID();
    }
  }
</script>

<style>
  .spacing {
    height: 40px;
  }
</style>

{#if loading}
  <Loading />
{:else}
  <Navbar bind:userID bind:username bind:avatar bind:currentEvent />

  <div class="spacing" />
  {#if userID}
    {#if !currentEvent}
      <Dashboard bind:currentEvent />
    {:else}
      <Solve bind:currentEvent />
    {/if}
  {:else}
    <Login />
  {/if}
{/if}
