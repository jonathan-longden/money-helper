import test from "node:test";
import assert from "node:assert/strict";

import { buildCalendar, escapeText, foldLine } from "./calendar.js";

const setup = {
  income: [{ id: "i1", name: "Paycheck", amount: 3000, day: 25 }],
  expenses: [
    { id: "e1", name: "Rent", amount: 950, day: 1 },
    { id: "e2", name: "Council tax", amount: 180, day: 18 },
  ],
  debts: [{ id: "d1", name: "Credit card", minPayment: 75, day: 15 }],
  setAsidePercent: 20,
  names: ["A", "B"],
};

const from = new Date(2026, 7, 10); // 10 Aug 2026
const build = (over = {}, months = 1) =>
  buildCalendar({ ...setup, ...over }, { from, months });

const bytesOf = (s) => new TextEncoder().encode(s).length;

test("emits a well-formed calendar", () => {
  const ics = build();
  assert.match(ics, /^BEGIN:VCALENDAR\r\n/);
  assert.match(ics, /END:VCALENDAR\r\n$/);
  assert.match(ics, /VERSION:2\.0/);
  assert.equal(ics.includes("\r\n"), true, "lines are CRLF terminated");
  assert.equal(/[^\r]\n/.test(ics), false, "no bare LF anywhere");
});

test("every bill gets an event with a 24-hour alarm", () => {
  const ics = build();
  assert.match(ics, /SUMMARY:Council tax — \$180 goes out/);
  assert.match(ics, /SUMMARY:Credit card — \$75 goes out/);
  assert.match(ics, /TRIGGER:-PT24H/);
  assert.match(ics, /DESCRIPTION:Tomorrow: Council tax — \$180 goes out/);
});

test("events are at 09:00 floating local time, not UTC", () => {
  const ics = build();
  assert.match(ics, /DTSTART:20260818T090000\r\n/, "18 Aug at 09:00, no Z suffix");
  assert.equal(/DTSTART:[0-9T]+Z/.test(ics), false, "DTSTART must not be UTC");
});

test("bills already past this month are skipped", () => {
  const ics = build({}, 1);
  assert.equal(
    ics.includes("bill-e1-202608"),
    false,
    "rent on the 1st has gone by the 10th"
  );
  assert.equal(ics.includes("bill-e2-202608"), true, "council tax on the 18th has not");
});

test("later months include the bills that were skipped in this one", () => {
  const ics = buildCalendar(setup, { from, months: 2 });
  assert.equal(ics.includes("bill-e1-202609"), true, "September rent is included");
});

test("a 31st bill lands on the last day of a short month", () => {
  const ics = buildCalendar(
    { ...setup, expenses: [{ id: "x", name: "Odd", amount: 10, day: 31 }] },
    { from: new Date(2026, 1, 1), months: 1 } // February 2026
  );
  assert.match(ics, /DTSTART:20260228T090000/);
});

test("one set-aside reminder per month, on payday, fired at the event", () => {
  const ics = build();
  const setAsides = ics.match(/SUMMARY:Move \$\d+ aside/g) ?? [];
  assert.equal(setAsides.length, 1);
  assert.match(ics, /SUMMARY:Move \$359 aside/, "20% of (3000-950-180-75)");
  assert.match(ics, /DTSTART:20260825T090000/);
  assert.match(ics, /TRIGGER:PT0S/);
});

test("set-aside reminder is dropped when there is no surplus", () => {
  const ics = build({ expenses: [{ id: "e", name: "Rent", amount: 5000, day: 1 }] });
  assert.equal(/SUMMARY:Move/.test(ics), false);
});

test("zero-value rows produce no events", () => {
  const ics = buildCalendar(
    {
      ...setup,
      expenses: [{ id: "z", name: "Nothing", amount: 0, day: 20 }],
      debts: [],
    },
    { from, months: 1 }
  );
  assert.equal(/SUMMARY:Nothing/.test(ics), false);
});

test("UIDs are stable so a re-export updates rather than duplicates", () => {
  assert.equal(
    build().match(/UID:bill-e2-202608@household-ledger/g).length,
    build().match(/UID:bill-e2-202608@household-ledger/g).length
  );
  assert.match(build(), /UID:bill-e2-202608@household-ledger/);
});

test("text values are escaped", () => {
  assert.equal(escapeText("a,b;c\\d"), "a\\,b\\;c\\\\d");
  assert.equal(escapeText("one\ntwo"), "one\\ntwo");

  const ics = build({
    expenses: [{ id: "e", name: "Gas, electric; both", amount: 100, day: 20 }],
  });
  assert.match(ics, /SUMMARY:Gas\\, electric\\; both/);
});

test("long lines fold to 75 octets with a leading space", () => {
  const short = "SUMMARY:hello";
  assert.equal(foldLine(short), short);

  const long = `SUMMARY:${"x".repeat(200)}`;
  const folded = foldLine(long);
  const parts = folded.split("\r\n");
  assert.ok(parts.length > 1, "it actually folded");
  assert.equal(parts[0].length <= 75, true);
  for (const p of parts.slice(1)) {
    assert.equal(p.startsWith(" "), true, "continuation starts with a space");
    assert.equal(bytesOf(p) <= 75, true);
  }
  assert.equal(folded.replace(/\r\n /g, ""), long, "unfolds back to the original");
});

test("folding never splits a multi-byte character", () => {
  const folded = foldLine(`SUMMARY:${"é".repeat(80)}`);
  for (const part of folded.split("\r\n")) {
    assert.equal(bytesOf(part) <= 75, true);
    assert.equal(part.includes("�"), false);
  }
  assert.equal(folded.replace(/\r\n /g, "").length, "SUMMARY:".length + 80);
});
