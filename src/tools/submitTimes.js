import { parseTimesArray } from "./calculator";
import { apiUrl } from "../Components/config";

const submitEvent = (timesArray, author) => {
  const { event, solves } = parseTimesArray(timesArray);

  return fetch(`${apiUrl}/api/times`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ author, event, solves }),
  }).then((res) => res.json());
};

export { submitEvent };
