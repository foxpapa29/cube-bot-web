<script>
  import * as R from "ramda";
  import { onMount } from "svelte";

  import { applyPenality, msToTime, timeToMs } from "../tools/calculator";
  import { submitEvent } from "../tools/submitTimes";

  export let times;
  export let currentTimesArray;
  export let currentTimesIndex;

  const updatePenality = (i, j, a) => {
    times[i].solves[j] = [times[i].solves[j][0], a];
  };

  const modifyTime = (i, j) => (times[i].solves[j] = [inputTime, 0]);

  const addTime = () => {
    times[currentTimesIndex].solves = [
      ...times[currentTimesIndex].solves,
      [timeToMs(inputTime), 0],
    ];
    inputTime = "";
  };

  const deleteLastTime = () =>
    (times[currentTimesIndex].solves = R.init(times[currentTimesIndex].solves));

  let inputTime = "";
  $: isValidInput = R.test(/^(?:([0-5]?\d):)?[0-5]?\d(\.\d+)?$/, inputTime);

  let isModalShown;
  export let displayScrambles;

  $: displayScrambles ? (localStorage.dscr = "👀") : (localStorage.dscr = "🙈");
  onMount(() => {
    const modal = document.getElementById("submitTimesConfirmation");
    modal.addEventListener("hide.bs.modal", () => (isModalShown = false));
    modal.addEventListener("show.bs.modal", () => (isModalShown = true));
  });
</script>

<div class="row">
  <div class="col-12">
    <table class="table">
      <thead>
        <tr>
          <th scope="col">#</th>
          <th scope="col">Time</th>
          <th scope="col">Edit</th>
        </tr>
      </thead>
      <tbody>
        {#each R.times(R.identity, 5) as i}
          <tr>
            <th scope="row">{i + 1}</th>
            {#if R.nth(i, currentTimesArray)}
              <td>
                {R.pipe(R.nth, applyPenality, msToTime)(i, currentTimesArray) + (currentTimesArray[i][1] === 1 ? '+' : '')}
              </td>
              <td>
                <div class="btn-group" role="group">
                  {#each ['OK', '+2', 'DNF'] as penality, j}
                    <button
                      class="btn btn-outline-dark btn-sm pb-0 pt-0 {currentTimesArray[i][1] === j ? 'active' : ''}"
                      on:click={updatePenality(currentTimesIndex, i, j)}>{penality}</button>
                  {/each}
                  <!-- <button
                    class="btn btn-outline-dark btn-sm pb-0 pt-0"
                    data-toggle="modal"
                    data-target="#addTimeModal"><svg
                      width="1em"
                      height="1em"
                      viewBox="0 0 16 16"
                      class="bi bi-pencil-square"
                      fill="currentColor"
                      xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M15.502 1.94a.5.5 0 0 1 0 .706L14.459 3.69l-2-2L13.502.646a.5.5 0 0 1 .707 0l1.293 1.293zm-1.75 2.456l-2-2L4.939 9.21a.5.5 0 0 0-.121.196l-.805 2.414a.25.25 0 0 0 .316.316l2.414-.805a.5.5 0 0 0 .196-.12l6.813-6.814z" />
                      <path
                        fill-rule="evenodd"
                        d="M1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z" />
                    </svg></button> -->
                  {#if R.equals(i + 1, R.length(currentTimesArray))}
                    <button
                      class="btn btn-outline-dark btn-sm pb-0 pt-0"
                      on:click={deleteLastTime}>X</button>
                  {/if}
                </div>
              </td>
            {:else}
              <td />
              <td />
            {/if}
          </tr>
        {/each}
      </tbody>
    </table>
  </div>
</div>
<div class="row">
  <div class="col-12 p-2">
    <button
      class="btn btn-outline-dark btn-sm {R.equals(5, R.length(currentTimesArray)) ? '' : 'disabled'}"
      data-toggle="modal"
      data-target="#submitTimesConfirmation">Submit times</button>
    <button
      class="btn btn-outline-dark btn-sm {R.equals(5, R.length(currentTimesArray)) ? 'disabled' : ''}"
      data-toggle="modal"
      data-target="#addTimeModal">Add time</button>
    <div class="form-check-inline">
      <input
        class="form-check-input btn-check"
        type="checkbox"
        value=""
        id="flexCheckDefault"
        bind:checked={displayScrambles} />
      <label class="btn btn-outline-dark btn-sm" for="flexCheckDefault">
        Display Scrambles
      </label>
    </div>
  </div>
</div>

<div class="modal fade" id="addTimeModal" tabindex="-1">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="exampleModalLabel">Enter time</h5>
        <button type="button" class="btn-close" data-dismiss="modal" />
      </div>
      <div class="modal-body">
        <div class="input-group mb-3">
          <input
            type="text"
            bind:value={inputTime}
            class="form-control"
            placeholder="1:23.456" />
        </div>
      </div>
      <div class="modal-footer pt-1 pb-1">
        {#if isValidInput}
          <button
            type="button"
            class="btn btn-dark"
            data-dismiss="modal"
            on:click={addTime}>Save</button>
        {:else}
          <button type="button" class="btn btn-dark disabled">Save</button>
        {/if}
      </div>
    </div>
  </div>
</div>

<div class="modal fade" id="submitTimesConfirmation" tabindex="-1">
  <div class="modal-dialog modal-dialog-centered">
    <div class="modal-content">
      <div class="modal-header">
        <h5 class="modal-title" id="exampleModalLabel">Résultats</h5>
        <button
          type="button"
          class="btn-close"
          data-dismiss="modal"
          aria-label="Close" />
      </div>
      <div class="modal-body">
        {#if isModalShown}
          {#await submitEvent(times[currentTimesIndex], localStorage.token)}
            ...
          {:then response}
            {response}
          {/await}
        {/if}
      </div>
      <div class="modal-footer pt-1 pb-1">
        <button
          type="button"
          class="btn btn-dark"
          data-dismiss="modal">Ok</button>
      </div>
    </div>
  </div>
</div>
