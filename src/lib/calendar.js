// Builds an iCalendar (.ics) file so the phone's own calendar does the
// reminding. The app can't schedule a notification for itself while closed —
// the browser API for that never shipped — but every phone already has a
// scheduler that works offline and fires on the lock screen.
import { money } from "./format.js";
import { clampDay, occurrence, startOfDay } from "./schedule.js";

const pad = (n) => String(n).padStart(2, "0");

// UTC, for DTSTAMP only.
const utcStamp = (d) =>
  `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}T` +
  `${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}Z`;

// Floating local time — a bill goes out on its date wherever you happen to
// be, so these deliberately carry no timezone.
const floating = (d) =>
  `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}T` +
  `${pad(d.getHours())}${pad(d.getMinutes())}00`;

export const escapeText = (s) =>
  String(s)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r?\n/g, "\\n");

/**
 * RFC 5545 caps a line at 75 octets, continued by CRLF + a single space.
 * Multi-byte characters must not be split across the fold.
 */
export function foldLine(line) {
  const bytesOf = (s) => new TextEncoder().encode(s).length;
  if (bytesOf(line) <= 75) return line;

  const out = [];
  let current = "";
  let limit = 75;

  for (const ch of line) {
    if (bytesOf(current + ch) > limit) {
      out.push(current);
      current = ch;
      limit = 74; // continuation lines lose one octet to the leading space
    } else {
      current += ch;
    }
  }
  out.push(current);

  return out.join("\r\n ");
}

const event = ({ uid, start, summary, description, alarm, now }) => [
  "BEGIN:VEVENT",
  `UID:${uid}`,
  `DTSTAMP:${utcStamp(now)}`,
  `DTSTART:${floating(start)}`,
  "DURATION:PT15M",
  `SUMMARY:${escapeText(summary)}`,
  ...(description ? [`DESCRIPTION:${escapeText(description)}`] : []),
  "BEGIN:VALARM",
  `TRIGGER:${alarm.trigger}`,
  "ACTION:DISPLAY",
  `DESCRIPTION:${escapeText(alarm.text)}`,
  "END:VALARM",
  "END:VEVENT",
];

/**
 * One explicit event per occurrence rather than an RRULE. A monthly rule
 * with BYMONTHDAY=31 silently skips February, whereas this app clamps to the
 * month's last day — generating the dates directly keeps the calendar and
 * the ledger saying the same thing.
 */
export function buildCalendar(setup, { from = new Date(), months = 24, hour = 9 } = {}) {
  const now = new Date();
  const today = startOfDay(from);
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Household Ledger//Reminders//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Household Ledger",
  ];

  const bills = [
    ...setup.expenses.map((r) => ({ ...r, value: Number(r.amount) || 0 })),
    ...setup.debts.map((r) => ({ ...r, value: Number(r.minPayment) || 0 })),
  ].filter((r) => r.value > 0);

  const income = setup.income.filter((r) => (Number(r.amount) || 0) > 0);

  // The set-aside is a share of the whole month's surplus, so it gets one
  // reminder a month — on the earliest payday — not one per income source.
  const sum = (rows, field) =>
    rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);

  const leftover =
    sum(income, "amount") -
    sum(setup.expenses, "amount") -
    sum(setup.debts, "minPayment");
  const setAside =
    leftover > 0 ? Math.round((leftover * setup.setAsidePercent) / 100) : 0;
  const primaryPaydayDay = income.length
    ? Math.min(...income.map((r) => Math.max(1, Number(r.day) || 1)))
    : null;

  for (let i = 0; i < months; i += 1) {
    const base = new Date(today.getFullYear(), today.getMonth() + i, 1);
    const year = base.getFullYear();
    const month = base.getMonth() + 1;

    for (const bill of bills) {
      const date = occurrence(bill.day, year, month);
      if (date < today) continue;
      date.setHours(hour, 0, 0, 0);

      lines.push(
        ...event({
          uid: `bill-${bill.id}-${year}${pad(month)}@household-ledger`,
          start: date,
          summary: `${bill.name} — ${money(bill.value)} goes out`,
          description: `${money(bill.value)} leaves the account on the ${clampDay(
            bill.day,
            year,
            month
          )}.`,
          alarm: {
            trigger: "-PT24H",
            text: `Tomorrow: ${bill.name} — ${money(bill.value)} goes out`,
          },
          now,
        })
      );
    }

    if (primaryPaydayDay && setAside > 0) {
      const date = occurrence(primaryPaydayDay, year, month);
      if (date >= today) {
        date.setHours(hour, 0, 0, 0);
        lines.push(
          ...event({
            uid: `setaside-${year}${pad(month)}@household-ledger`,
            start: date,
            summary: `Move ${money(setAside)} aside`,
            description: `${setup.setAsidePercent}% of this month's ${money(
              Math.max(leftover, 0)
            )} left over.`,
            alarm: {
              trigger: "PT0S",
              text: `Payday — move ${money(setAside)} aside`,
            },
            now,
          })
        );
      }
    }
  }

  lines.push("END:VCALENDAR");

  return lines.map(foldLine).join("\r\n") + "\r\n";
}

export const calendarIsEmpty = (ics) => !ics.includes("BEGIN:VEVENT");
