// Run with `npm test`. Uses node's built-in runner — no dependencies.
// Month arithmetic is the easiest thing here to get quietly wrong, so the
// awkward cases (short months, leap years, year rollover, windows that
// straddle a month boundary) are pinned down explicitly.
import test from "node:test";
import assert from "node:assert/strict";

import {
  clampDay,
  dueInWindow,
  monthEvents,
  nextPayday,
  startOfDay,
} from "./schedule.js";

const d = (y, m, day) => new Date(y, m - 1, day);
const iso = (x) =>
  x
    ? `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(
        x.getDate()
      ).padStart(2, "0")}`
    : null;

test("clampDay keeps a day inside its month", () => {
  assert.equal(clampDay(31, 2026, 2), 28, "31st of a 28-day February");
  assert.equal(clampDay(31, 2028, 2), 29, "leap February");
  assert.equal(clampDay(31, 2026, 4), 30, "31st of a 30-day April");
  assert.equal(clampDay(15, 2026, 2), 15, "a day that already fits");
  assert.equal(clampDay(undefined, 2026, 3), 1, "missing day falls back to 1st");
  assert.equal(clampDay(0, 2026, 3), 1, "days below 1 are pulled up");
});

test("nextPayday finds the soonest income date after today", () => {
  const income = [{ name: "Pay", amount: 3000, day: 25 }];

  assert.equal(iso(nextPayday(income, d(2026, 8, 10)).date), "2026-08-25");
  assert.equal(
    iso(nextPayday(income, d(2026, 8, 25)).date),
    "2026-09-25",
    "money arriving today has already landed, so today is not upcoming"
  );
  assert.equal(iso(nextPayday(income, d(2026, 8, 26)).date), "2026-09-25");
  assert.equal(
    iso(nextPayday(income, d(2026, 12, 26)).date),
    "2027-01-25",
    "rolls over the year"
  );
});

test("nextPayday clamps a 31st payday into a short month", () => {
  const income = [{ name: "Pay", amount: 1, day: 31 }];
  assert.equal(iso(nextPayday(income, d(2026, 1, 31)).date), "2026-02-28");
});

test("nextPayday ignores income with no amount", () => {
  assert.equal(nextPayday([{ name: "Pay", amount: 0, day: 5 }], d(2026, 8, 1)), null);
  assert.equal(nextPayday([], d(2026, 8, 1)), null);
});

test("nextPayday picks the earliest of several sources", () => {
  const income = [
    { name: "A", amount: 1, day: 28 },
    { name: "B", amount: 1, day: 15 },
  ];
  assert.equal(iso(nextPayday(income, d(2026, 8, 10)).date), "2026-08-15");
});

const bills = [
  { id: "r", name: "Rent", amount: 950, day: 1 },
  { id: "c", name: "Card", amount: 75, day: 15 },
  { id: "p", name: "Phone", amount: 35, day: 26 },
];

test("dueInWindow returns only what falls between today and payday", () => {
  const due = dueInWindow(bills, "amount", startOfDay(d(2026, 8, 10)), d(2026, 8, 25));
  assert.deepEqual(due.map((x) => x.name), ["Card"]);
});

test("dueInWindow spans a month boundary", () => {
  const due = dueInWindow(bills, "amount", startOfDay(d(2026, 8, 26)), d(2026, 9, 25));
  assert.deepEqual(
    due.map((x) => `${x.name}@${iso(x.date)}`),
    ["Phone@2026-08-26", "Rent@2026-09-01", "Card@2026-09-15"]
  );
});

test("dueInWindow includes a bill dated today but not one dated on payday", () => {
  assert.deepEqual(
    dueInWindow(bills, "amount", startOfDay(d(2026, 8, 15)), d(2026, 8, 25)).map(
      (x) => x.name
    ),
    ["Card"],
    "a bill due today still has to be covered"
  );
  assert.deepEqual(
    dueInWindow(
      [{ id: "x", name: "X", amount: 10, day: 25 }],
      "amount",
      startOfDay(d(2026, 8, 10)),
      d(2026, 8, 25)
    ),
    [],
    "a bill landing on payday is covered by that paycheck"
  );
});

test("monthEvents groups by day and carries a running total", () => {
  const setup = {
    income: [{ name: "Pay", amount: 3000, day: 25 }],
    expenses: [
      { name: "Rent", amount: 950, day: 1 },
      { name: "Gym", amount: 50, day: 1 },
    ],
    debts: [{ name: "Card", minPayment: 75, day: 15 }],
  };

  const events = monthEvents(setup, 2026, 8);
  assert.deepEqual(events.map((e) => e.day), [1, 15, 25]);
  assert.deepEqual(events[0].items.map((i) => i.name).sort(), ["Gym", "Rent"]);
  assert.deepEqual(events.map((e) => e.balance), [-1000, -1075, 1925]);
});

test("monthEvents clamps a 31st bill into February", () => {
  const events = monthEvents(
    { income: [], expenses: [{ name: "R", amount: 100, day: 31 }], debts: [] },
    2026,
    2
  );
  assert.deepEqual(events.map((e) => e.day), [28]);
});

test("monthEvents drops zero-value rows", () => {
  const events = monthEvents(
    {
      income: [{ name: "Pay", amount: 0, day: 25 }],
      expenses: [{ name: "Rent", amount: 950, day: 1 }],
      debts: [],
    },
    2026,
    8
  );
  assert.deepEqual(events.map((e) => e.day), [1]);
});
