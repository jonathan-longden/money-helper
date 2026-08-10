import React from "react";
import { money } from "../lib/format.js";
import { clampDay, monthEvents, startOfDay } from "../lib/schedule.js";

/**
 * Every dated movement across the month, in order, with a running total that
 * starts from zero on the 1st. A dip below zero means outgoings land before
 * the money that covers them — a timing problem the monthly totals hide.
 */
export default function MonthTimeline({ setup, month, today = new Date() }) {
  const [year, monthNum] = month.split("-").map(Number);
  const events = monthEvents(setup, year, monthNum);

  const now = startOfDay(today);
  const isCurrentMonth =
    now.getFullYear() === year && now.getMonth() + 1 === monthNum;
  const todayDay = isCurrentMonth ? now.getDate() : null;

  if (events.length === 0) {
    return (
      <div className="mx-5 mt-7">
        <div className="lg-mono text-[10.5px] tracking-[0.2em] text-[#CBA135]/80 uppercase mb-2">
          Month at a glance
        </div>
        <div className="rounded-xl gold-card px-4 py-4 lg-sans text-[12.5px] text-[#8FA396]">
          Add amounts and dates to your income, expenses and debts to see the
          month laid out.
        </div>
      </div>
    );
  }

  const lowest = Math.min(...events.map((e) => e.balance));

  return (
    <div className="mx-5 mt-7 rise-in" style={{ animationDelay: "150ms" }}>
      <div className="lg-mono text-[10.5px] tracking-[0.2em] text-[#CBA135]/80 uppercase mb-2">
        Month at a glance
      </div>

      <div className="rounded-xl gold-card divide-y divide-[#CBA135]/12 overflow-hidden">
        {events.map((e) => {
          const isToday = e.day === todayDay;
          const isPast = todayDay !== null && e.day < todayDay;

          return (
            <div
              key={e.day}
              className="flex gap-3 px-4 py-2.5"
              style={isPast ? { opacity: 0.5 } : undefined}
            >
              <div className="shrink-0 w-[42px] pt-0.5">
                <div
                  className="lg-mono text-[11px] tracking-wide rounded px-1.5 py-0.5 text-center"
                  style={
                    isToday
                      ? {
                          background: "linear-gradient(135deg,#E4C766,#CBA135)",
                          color: "#1A1208",
                        }
                      : { color: "#CBA135", opacity: 0.85 }
                  }
                >
                  {clampDay(e.day, year, monthNum)}
                </div>
              </div>

              <div className="flex-1 min-w-0">
                {e.items.map((it, i) => (
                  <div
                    key={`${it.name}-${i}`}
                    className="flex items-baseline justify-between gap-3"
                  >
                    <span className="lg-sans text-[12.5px] truncate">
                      {it.name}
                    </span>
                    <span
                      className="lg-mono text-[12px] shrink-0"
                      style={{ color: it.amount < 0 ? "#E7B4A8" : "#B9D6C4" }}
                    >
                      {money(it.amount)}
                    </span>
                  </div>
                ))}
              </div>

              <div className="shrink-0 w-[62px] text-right pt-0.5">
                <div
                  className="lg-mono text-[11.5px]"
                  style={{ color: e.balance < 0 ? "#E7B4A8" : "#D8CBA5" }}
                >
                  {money(e.balance)}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="lg-sans text-[11px] text-[#8FA396] mt-2 leading-relaxed">
        {lowest < 0
          ? `Running total from the 1st. It dips to ${money(
              lowest
            )} this month — money goes out before the income that covers it arrives.`
          : "Running total from the 1st, counting only dated income and bills."}
      </p>
    </div>
  );
}
