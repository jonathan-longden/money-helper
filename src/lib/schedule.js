// Paydays and bills repeat on the same day every month. Everything here works
// in local time on whole days — the ledger never needs sub-day precision.

export const startOfDay = (d) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate());

export const daysInMonth = (year, month) => new Date(year, month, 0).getDate();

// A bill set to the 31st still has to land in February, so every day is
// clamped to the month it's being placed in rather than rolling over.
export const clampDay = (day, year, month) =>
  Math.min(Math.max(1, Math.round(Number(day) || 1)), daysInMonth(year, month));

export const occurrence = (day, year, month) =>
  new Date(year, month - 1, clampDay(day, year, month));

// The window between today and the next payday never spans more than one
// month boundary, so two months of candidate dates always covers it.
const monthsFrom = (from, count) =>
  Array.from({ length: count }, (_, i) => {
    const b = new Date(from.getFullYear(), from.getMonth() + i, 1);
    return { year: b.getFullYear(), month: b.getMonth() + 1 };
  });

/**
 * The soonest income date strictly after today. Money arriving today has
 * already landed, so today's payday is behind you, not ahead.
 */
export function nextPayday(income, today = new Date()) {
  const t = startOfDay(today);
  let best = null;

  for (const row of income) {
    if (!(Number(row.amount) > 0)) continue;
    for (const { year, month } of monthsFrom(t, 2)) {
      const date = occurrence(row.day, year, month);
      if (date > t && (!best || date < best.date)) {
        best = { date, name: row.name, amount: Number(row.amount) || 0 };
      }
    }
  }

  return best;
}

/**
 * Everything falling due in [from, to). `from` is inclusive because a bill
 * dated today still has to come out of the money you're holding now.
 */
export function dueInWindow(items, amountField, from, to) {
  const out = [];

  for (const row of items) {
    const amount = Number(row[amountField]) || 0;
    if (amount <= 0) continue;
    for (const { year, month } of monthsFrom(from, 2)) {
      const date = occurrence(row.day, year, month);
      if (date >= from && date < to) {
        out.push({ id: `${row.id}-${date.getTime()}`, name: row.name, amount, date });
      }
    }
  }

  return out.sort((a, b) => a.date - b.date);
}

/**
 * Every dated movement in one month, grouped by day, carrying a running
 * total that starts from zero on the 1st. The point isn't the absolute
 * figure — it's whether the line dips below zero before the next payday.
 */
export function monthEvents(setup, year, month) {
  const rows = [
    ...setup.income.map((r) => ({
      name: r.name,
      day: r.day,
      amount: Number(r.amount) || 0,
    })),
    ...setup.expenses.map((r) => ({
      name: r.name,
      day: r.day,
      amount: -(Number(r.amount) || 0),
    })),
    ...setup.debts.map((r) => ({
      name: r.name,
      day: r.day,
      amount: -(Number(r.minPayment) || 0),
    })),
  ].filter((r) => r.amount !== 0);

  const byDay = new Map();
  for (const r of rows) {
    const day = clampDay(r.day, year, month);
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(r);
  }

  let balance = 0;
  return [...byDay.keys()]
    .sort((a, b) => a - b)
    .map((day) => {
      const items = byDay.get(day).sort((a, b) => b.amount - a.amount);
      const net = items.reduce((s, r) => s + r.amount, 0);
      balance += net;
      return { day, items, net, balance };
    });
}
