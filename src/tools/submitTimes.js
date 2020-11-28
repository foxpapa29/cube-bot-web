import { parseTimesArray } from "./calculator";

const submitEvent = (timesArray, token) => {
  const { event, solves } = parseTimesArray(timesArray);

  return fetch(`/api/times`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ token, event, solves }),
  })
    .then((res) => res.json())
    .then(({ result, refresh_token }) => {
      localStorage.token = refresh_token;
      return result;
    });
};

export { submitEvent };
