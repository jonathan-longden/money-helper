import React from "react";
import { CalendarClock } from "lucide-react";
import { money } from "../lib/format.js";
import { dueInWindow, nextPayday, startOfDay } from "../lib/schedule.js";

const dayMonth = (d) =>
  d.toLocaleString("en-US", { day: "numeric", month: "short" });

/**
 * What's already committed between now and the next paycheck. This is a
 * different question from the set-aside slider: that one splits a month's
 * surplus, this one says how much of the money in hand is spoken for.
 */
export default function HoldBackCard({ setup, today = new Date() }) {
  const from = startOfDay(today);
  const payday = nextPayday(setup.income, from);

  if (!payday) {
    return (
      <div className="mx-5 mt-4 rounded-xl gold-card px-5 py-4">
        <div className="flex items-center gap-1.5 text-[#CBA135] lg-mono text-[10.5px] tracking-[0.2em] uppercase">
          <CalendarClock size={13} /> Hold back until payday
        </div>
        <p className="lg-sans text-[12px] text-[#8FA396] mt-2">
          Give an income source an amount and a payday under “Edit income,
          expenses &amp; debts” and this will show what's due before the next
          one lands.
        </p>
      </div>
    );
  }

  const due = [
    ...dueInWindow(setup.expenses, "amount", from, payday.date),
    ...dueInWindow(setup.debts, "minPayment", from, payday.date),
  ].sort((a, b) => a.date - b.date);

  const total = due.reduce((s, d) => s + d.amount, 0);

  return (
    <div
      className="mx-5 mt-4 rounded-xl overflow-hidden gold-card gold-frame card-hover rise-in"
      style={{ animationDelay: "120ms" }}
    >
      <div className="px-6 pt-6 pb-4">
        <div className="flex items-center gap-1.5 text-[#CBA135] lg-mono text-[10.5px] tracking-[0.2em] uppercase">
          <CalendarClock size={13} /> Hold back until {dayMonth(payday.date)}
        </div>
        <div className="lg-serif text-[40px] leading-none font-semibold mt-2 foil-text">
          {money(total)}
        </div>
        <div className="lg-sans text-[12px] text-[#B9AF98] mt-2">
          {due.length === 0
            ? `Nothing due before your next paycheck on ${dayMonth(
                payday.date
              )}.`
            : `${due.length} ${
                due.length === 1 ? "payment" : "payments"
              } due before your next paycheck on ${dayMonth(payday.date)}.`}
        </div>
      </div>

      {due.length > 0 && (
        <div className="divide-y divide-[#CBA135]/12 border-t border-[#CBA135]/15">
          {due.map((d) => (
            <div
              key={d.id}
              className="flex items-center justify-between px-6 py-2"
            >
              <div className="flex items-baseline gap-2.5 min-w-0">
                <span className="lg-mono text-[10.5px] text-[#CBA135]/80 shrink-0 w-[46px]">
                  {dayMonth(d.date)}
                </span>
                <span className="lg-sans text-[12.5px] truncate">{d.name}</span>
              </div>
              <span className="lg-mono text-[12.5px] text-[#E7B4A8] shrink-0 pl-3">
                {money(-d.amount)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
