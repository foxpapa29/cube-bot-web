<script>
  import { onMount } from "svelte";
  onMount(() => {
    window.setInterval(() => {
      let wait = document.getElementById("wait");
      if (wait.innerHTML.length >= 3) wait.innerHTML = ".";
      else wait.innerHTML += ".";
    }, 200);
  });
</script>

<div id="wait" class="display-1">.</div>
