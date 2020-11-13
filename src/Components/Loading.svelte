<script>
  window.setInterval(function () {
    let wait = document.getElementById('wait');
    if (wait.innerHTML.length >= 3) wait.innerHTML = '';
    else wait.innerHTML += '.';
  }, 200);
</script>

<style>
  div {
    position: relative;
    top: 40%;
  }
</style>

<div id="wait" class="display-1 text-center" />
