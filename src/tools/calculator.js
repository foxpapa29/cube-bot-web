import * as R from "ramda";

const parseTimesArray = ({ event, solves }) => ({
  event,
  solves: R.map(
    R.pipe(applyPenality, (y) => msToTime(y)),
    solves
  ),
});

const applyPenality = R.cond([
  [R.pipe(R.last, R.equals(2)), R.always(Infinity)],
  [R.pipe(R.last, R.equals(1)), R.pipe(R.head, R.add(2000))],
  [R.pipe(R.last, R.equals(0)), R.head],
]);

const msToTime = (t) => {
  if (t === Infinity) return "DNF";

  const min = Math.floor(t / (60 * 1000));
  let s = ((t - min * 60 * 1000) / 1000).toFixed(2);
  if (min > 0 && s.length === 4) {
    s = "0" + s;
  }

  return `${min ? min + ":" : ""}${s}`;
};

const timeToMs = R.ifElse(
  R.equals("DNF"),
  R.always(Infinity),
  R.pipe(
    R.split(":"),
    R.reduce((acc, t) => 60 * acc + Number(t), 0),
    R.multiply(1000),
    parseInt
  )
);

const averageOfFiveCalculator = R.pipe(
  R.map(applyPenality),
  R.sort(R.subtract),
  R.slice(1, -1),
  R.sum,
  R.divide(R.__, 3)
);

export {
  msToTime,
  parseTimesArray,
  applyPenality,
  averageOfFiveCalculator,
  timeToMs,
};
