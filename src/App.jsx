import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  TrendingDown,
  PiggyBank,
  Receipt,
  Landmark,
  Wallet,
} from "lucide-react";

import InstallBar from "./components/InstallBar.jsx";
import UpdateToast from "./components/UpdateToast.jsx";
import BackupControls from "./components/BackupControls.jsx";
import CalendarExport from "./components/CalendarExport.jsx";
import HoldBackCard from "./components/HoldBackCard.jsx";
import MonthTimeline from "./components/MonthTimeline.jsx";
import { money, ordinal } from "./lib/format.js";
import {
  SETUP_KEY,
  WHOAMI_KEY,
  readJSON,
  readText,
  spendingKey,
  storageAvailable,
  writeJSON,
  writeText,
} from "./lib/storage.js";

const uid = () => Math.random().toString(36).slice(2, 10);

const monthKey = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;

const monthLabel = (key) => {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });
};

const emptySetup = () => ({
  income: [{ id: uid(), name: "Paycheck", amount: 0, day: 1 }],
  expenses: [{ id: uid(), name: "Rent", amount: 0, day: 1 }],
  debts: [{ id: uid(), name: "Credit card", minPayment: 0, day: 1 }],
  setAsidePercent: 20,
  names: ["Partner 1", "Partner 2"],
});

// A hand-edited or half-written backup shouldn't be able to crash the app on
// boot, so anything read off disk is coerced back into the expected shape.
const normalizeSetup = (raw) => {
  const base = emptySetup();
  if (!raw || typeof raw !== "object") return base;

  const rows = (value, amountField, fallback) =>
    Array.isArray(value)
      ? value.map((r) => ({
          id: r?.id ?? uid(),
          name: typeof r?.name === "string" ? r.name : "Untitled",
          [amountField]: Number(r?.[amountField]) || 0,
          // Ledgers saved before dates existed have no day — default them to
          // the 1st rather than dropping the row.
          day: Math.min(31, Math.max(1, Math.round(Number(r?.day) || 1))),
        }))
      : fallback;

  const names = Array.isArray(raw.names)
    ? raw.names.filter((n) => typeof n === "string")
    : [];

  return {
    income: rows(raw.income, "amount", base.income),
    expenses: rows(raw.expenses, "amount", base.expenses),
    debts: rows(raw.debts, "minPayment", base.debts),
    setAsidePercent: Math.min(
      100,
      Math.max(0, Number(raw.setAsidePercent) || 0)
    ),
    names: names.length ? names : base.names,
  };
};

const normalizeSpending = (raw) =>
  Array.isArray(raw)
    ? raw
        .filter((x) => x && typeof x === "object")
        .map((x) => ({
          id: x.id ?? uid(),
          desc: String(x.desc ?? ""),
          amount: Number(x.amount) || 0,
          date: x.date ?? null,
          by: typeof x.by === "string" ? x.by : null,
        }))
    : [];

function useCountUp(target, duration = 700) {
  const [value, setValue] = useState(target);
  const prevRef = useRef(target);

  useEffect(() => {
    const from = prevRef.current;
    const to = target;
    if (from === to) return;

    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (to - from) * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
      else prevRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);

  return value;
}

export default function App() {
  // localStorage is synchronous, so the ledger is on screen from the first
  // paint — there is nothing to wait for.
  const [setup, setSetup] = useState(() =>
    normalizeSetup(readJSON(SETUP_KEY, null))
  );
  const [month, setMonth] = useState(() => monthKey());
  const [spending, setSpending] = useState(() =>
    normalizeSpending(readJSON(spendingKey(monthKey()), []))
  );
  const [whoAmI, setWhoAmI] = useState(() => readText(WHOAMI_KEY));
  const [newSpend, setNewSpend] = useState({ desc: "", amount: "" });
  const [editing, setEditing] = useState(false);
  const [err, setErr] = useState(
    storageAvailable
      ? ""
      : "This browser is blocking local storage, so nothing will be saved."
  );

  // An installed app can sit open across midnight on the 1st; re-checking on
  // focus rolls it into the new month instead of logging into the old one.
  useEffect(() => {
    const sync = () => setMonth(monthKey());
    document.addEventListener("visibilitychange", sync);
    window.addEventListener("focus", sync);
    return () => {
      document.removeEventListener("visibilitychange", sync);
      window.removeEventListener("focus", sync);
    };
  }, []);

  useEffect(() => {
    setSpending(normalizeSpending(readJSON(spendingKey(month), [])));
  }, [month]);

  // Whoever was picked last may have been renamed or removed since.
  useEffect(() => {
    if (!setup.names.includes(whoAmI)) setWhoAmI(setup.names[0] ?? null);
  }, [setup.names, whoAmI]);

  const saveSetup = useCallback((next) => {
    setSetup(next);
    try {
      writeJSON(SETUP_KEY, next);
    } catch {
      setErr("Couldn't save your changes. Try again.");
    }
  }, []);

  const saveSpending = useCallback(
    (next) => {
      setSpending(next);
      try {
        writeJSON(spendingKey(month), next);
      } catch {
        setErr("Couldn't save that entry. Try again.");
      }
    },
    [month]
  );

  const chooseWhoAmI = useCallback((name) => {
    setWhoAmI(name);
    try {
      writeText(WHOAMI_KEY, name);
    } catch {
      // Per-device convenience only — not worth surfacing.
    }
  }, []);

  const reloadFromStorage = useCallback(() => {
    setSetup(normalizeSetup(readJSON(SETUP_KEY, null)));
    setSpending(normalizeSpending(readJSON(spendingKey(monthKey()), [])));
    setWhoAmI(readText(WHOAMI_KEY));
    setMonth(monthKey());
    setErr("");
  }, []);

  const totalIncome = setup.income.reduce(
    (s, i) => s + (Number(i.amount) || 0),
    0
  );
  const totalExpenses = setup.expenses.reduce(
    (s, e) => s + (Number(e.amount) || 0),
    0
  );
  const totalDebt = setup.debts.reduce(
    (s, d) => s + (Number(d.minPayment) || 0),
    0
  );
  const committed = totalExpenses + totalDebt;
  const leftover = totalIncome - committed;
  const setAsideAmount =
    leftover > 0 ? Math.round((leftover * setup.setAsidePercent) / 100) : 0;
  const discretionary = leftover - setAsideAmount;
  const spentSoFar = spending.reduce((s, x) => s + (Number(x.amount) || 0), 0);
  const remaining = discretionary - spentSoFar;

  let status = "ok";
  if (leftover < 0) status = "deficit";
  else if (remaining < 0) status = "overspent";
  else if (discretionary > 0 && remaining / discretionary < 0.2)
    status = "close";

  const statusMap = {
    deficit: {
      icon: TrendingDown,
      ink: "#E7B4A8",
      bg: "rgba(124,45,45,0.28)",
      border: "#7C2D2D",
      title: `Short ${money(Math.abs(leftover))} this month`,
      body: "Fixed costs and minimum debt payments already exceed income. Trim a bill or add income by this much to keep new debt off the books.",
    },
    overspent: {
      icon: AlertTriangle,
      ink: "#E7B4A8",
      bg: "rgba(124,45,45,0.28)",
      border: "#7C2D2D",
      title: `${money(Math.abs(remaining))} over the safe-to-spend line`,
      body: "Spending this month has passed what was set aside. The next purchase likely goes on credit.",
    },
    close: {
      icon: AlertTriangle,
      ink: "#E9CE8C",
      bg: "rgba(203,161,53,0.14)",
      border: "#CBA135",
      title: `${money(remaining)} left to spend safely`,
      body: "Getting close to the line for this month — worth slowing discretionary spending.",
    },
    ok: {
      icon: CheckCircle2,
      ink: "#B9D6C4",
      bg: "rgba(47,92,70,0.28)",
      border: "#3E7A5C",
      title: `${money(remaining)} left to spend safely`,
      body: "On track. Set-aside amount is covered before anything else moves.",
    },
  };
  const s = statusMap[status];
  const StatusIcon = s.icon;

  const updateRow = (section, id, field, value) =>
    saveSetup({
      ...setup,
      [section]: setup[section].map((r) =>
        r.id === id ? { ...r, [field]: value } : r
      ),
    });

  const addRow = (section, blank) =>
    saveSetup({ ...setup, [section]: [...setup[section], { id: uid(), ...blank }] });

  const removeRow = (section, id) =>
    saveSetup({
      ...setup,
      [section]: setup[section].filter((r) => r.id !== id),
    });

  const addSpend = () => {
    const amt = Number(newSpend.amount);
    if (!newSpend.desc.trim() || !amt || amt <= 0) return;
    saveSpending([
      ...spending,
      {
        id: uid(),
        desc: newSpend.desc.trim(),
        amount: amt,
        date: new Date().toISOString(),
        by: whoAmI,
      },
    ]);
    setNewSpend({ desc: "", amount: "" });
  };

  const removeSpend = (id) => saveSpending(spending.filter((x) => x.id !== id));

  return (
    <div className="min-h-screen bg-[#0E1712] text-[#F3EEDF] safe-bottom velvet-grain">
      {/* Header */}
      <div className="px-5 safe-top pb-6 border-b border-[#CBA135]/20 rise-in">
        <div className="flex items-baseline justify-between gap-3">
          <h1 className="lg-serif text-[27px] italic font-medium tracking-tight foil-text">
            Household Ledger
          </h1>
          <span className="lg-mono text-[10.5px] tracking-[0.2em] text-[#CBA135]/80 uppercase shrink-0">
            {monthLabel(month)}
          </span>
        </div>
        <div className="accent-underline mt-2.5 mb-2.5" />
        <p className="lg-sans text-[13px] text-[#B9AF98]">
          What's committed, what's left, what to set aside.
        </p>
        <div className="flex items-center gap-1.5 mt-4 flex-wrap">
          <span className="lg-sans text-[11px] text-[#8FA396] tracking-wide">
            You are
          </span>
          {setup.names.map((n) => (
            <button
              key={n}
              onClick={() => chooseWhoAmI(n)}
              className="lg-sans text-[11.5px] px-2.5 py-1 rounded-full border transition-colors"
              style={
                whoAmI === n
                  ? {
                      background: "linear-gradient(135deg,#E4C766,#CBA135)",
                      color: "#1A1208",
                      borderColor: "#CBA135",
                    }
                  : {
                      background: "transparent",
                      color: "#D8CBA5",
                      borderColor: "rgba(203,161,53,0.3)",
                    }
              }
            >
              {n}
            </button>
          ))}
        </div>
      </div>

      <InstallBar />

      {err && (
        <button
          onClick={() => setErr("")}
          className="block w-[calc(100%-2.5rem)] text-left mx-5 mt-4 text-[12px] lg-sans text-[#E7B4A8] bg-[rgba(124,45,45,0.22)] border border-[#7C2D2D]/40 rounded-lg px-3 py-2"
        >
          {err}
        </button>
      )}

      {/* The two halves of what's left over. Both sliders drive the same
          split, so dragging either one moves the other. */}
      <BucketCard
        icon={<PiggyBank size={13} />}
        label="Set aside this month"
        amount={setAsideAmount}
        percent={setup.setAsidePercent}
        onPercentChange={(pct) => saveSetup({ ...setup, setAsidePercent: pct })}
        sliderLabel="Percent of leftover money to set aside"
        note={`${setup.setAsidePercent}% of ${money(
          Math.max(leftover, 0)
        )} left over after fixed costs and debt minimums`}
        seal={status === "ok"}
        animationDelay="60ms"
        spacing="mt-6"
      />

      <BucketCard
        icon={<Wallet size={13} />}
        label="Spending money this month"
        amount={discretionary}
        percent={100 - setup.setAsidePercent}
        onPercentChange={(pct) =>
          saveSetup({ ...setup, setAsidePercent: 100 - pct })
        }
        sliderLabel="Percent of leftover money to keep as spending money"
        note={`${100 - setup.setAsidePercent}% of ${money(
          Math.max(leftover, 0)
        )} left over — ${money(spentSoFar)} spent so far`}
        animationDelay="90ms"
      />

      {/* Status banner */}
      <div
        key={status}
        className="mx-5 mt-4 rounded-xl px-4 py-4 flex gap-3 border-l-[3px] rise-in gold-card"
        style={{ background: s.bg, borderColor: s.border }}
      >
        <StatusIcon
          size={19}
          style={{ color: s.ink }}
          className="shrink-0 mt-0.5 seal-pop"
        />
        <div>
          <div className="lg-sans font-semibold text-[14px]" style={{ color: s.ink }}>
            {s.title}
          </div>
          <div className="lg-sans text-[12.5px] mt-0.5 text-[#D8CBA5]/90">{s.body}</div>
        </div>
      </div>

      <HoldBackCard setup={setup} />

      <MonthTimeline setup={setup} month={month} />

      {/* Breakdown */}
      <div className="mx-5 mt-7 rise-in" style={{ animationDelay: "120ms" }}>
        <div className="lg-mono text-[10.5px] tracking-[0.2em] text-[#CBA135]/80 uppercase mb-2">
          Monthly breakdown
        </div>
        <div className="rounded-xl gold-card divide-y divide-[#CBA135]/12 card-hover overflow-hidden">
          <Row label="Income" value={totalIncome} bold />
          <Row label="Fixed expenses" value={-totalExpenses} />
          <Row label="Debt minimums" value={-totalDebt} />
          <Row label="Left over" value={leftover} bold line />
          <Row label="Set aside" value={-setAsideAmount} />
          <Row label="Safe to spend" value={discretionary} bold />
        </div>
      </div>

      {/* Editable setup */}
      <div className="mx-5 mt-7">
        <button
          onClick={() => setEditing((v) => !v)}
          className="lg-sans text-[12.5px] font-medium text-[#CBA135] underline underline-offset-4 decoration-[#CBA135]/40"
        >
          {editing ? "Done editing" : "Edit income, expenses & debts"}
        </button>

        {editing && (
          <div className="mt-4 space-y-5">
            <div>
              <div className="lg-sans text-[12px] font-semibold text-[#D8CBA5] mb-1.5 tracking-wide">
                Names
              </div>
              <div className="rounded-xl gold-card divide-y divide-[#CBA135]/12 overflow-hidden">
                {setup.names.map((n, i) => (
                  <div key={i} className="flex items-center gap-2 px-3.5 py-2.5">
                    <input
                      value={n}
                      onChange={(e) => {
                        const names = [...setup.names];
                        names[i] = e.target.value;
                        const wasSelected = whoAmI === setup.names[i];
                        saveSetup({ ...setup, names });
                        if (wasSelected) chooseWhoAmI(e.target.value);
                      }}
                      aria-label={`Name ${i + 1}`}
                      className="lg-sans flex-1 min-w-0 bg-transparent text-[13px] outline-none text-[#F3EEDF]"
                    />
                  </div>
                ))}
              </div>
            </div>

            <EditSection
              icon={<Landmark size={13} />}
              title="Income"
              rows={setup.income}
              amountField="amount"
              dayLabel="Arrives on the"
              onChange={(id, f, v) => updateRow("income", id, f, v)}
              onAdd={() =>
                addRow("income", { name: "New source", amount: 0, day: 1 })
              }
              onRemove={(id) => removeRow("income", id)}
            />
            <EditSection
              icon={<Receipt size={13} />}
              title="Fixed expenses"
              rows={setup.expenses}
              amountField="amount"
              dayLabel="Goes out on the"
              onChange={(id, f, v) => updateRow("expenses", id, f, v)}
              onAdd={() =>
                addRow("expenses", { name: "New expense", amount: 0, day: 1 })
              }
              onRemove={(id) => removeRow("expenses", id)}
            />
            <EditSection
              icon={<AlertTriangle size={13} />}
              title="Debt minimum payments"
              rows={setup.debts}
              amountField="minPayment"
              dayLabel="Goes out on the"
              onChange={(id, f, v) => updateRow("debts", id, f, v)}
              onAdd={() =>
                addRow("debts", { name: "New debt", minPayment: 0, day: 1 })
              }
              onRemove={(id) => removeRow("debts", id)}
            />

            <div>
              <div className="lg-sans text-[12px] font-semibold text-[#D8CBA5] mb-1.5 tracking-wide">
                Reminders
              </div>
              <CalendarExport setup={setup} onError={setErr} />
            </div>

            <div>
              <div className="lg-sans text-[12px] font-semibold text-[#D8CBA5] mb-1.5 tracking-wide">
                Backup
              </div>
              <BackupControls onRestored={reloadFromStorage} onError={setErr} />
            </div>
          </div>
        )}
      </div>

      {/* Spending log */}
      <div className="mx-5 mt-8 rise-in" style={{ animationDelay: "180ms" }}>
        <div className="lg-mono text-[10.5px] tracking-[0.2em] text-[#CBA135]/80 uppercase mb-2">
          Spending this month · {money(spentSoFar)} of{" "}
          {money(Math.max(discretionary, 0))}
        </div>
        <div className="h-[6px] rounded-full bg-[rgba(203,161,53,0.12)] border border-[#CBA135]/15 overflow-hidden mb-3.5">
          <div
            className="relative h-full rounded-full transition-all duration-500 ease-out shimmer overflow-hidden"
            style={{
              width: `${
                discretionary > 0
                  ? Math.min(100, (spentSoFar / discretionary) * 100)
                  : 100
              }%`,
              background:
                status === "ok"
                  ? "linear-gradient(90deg,#3E7A5C,#5FAE84)"
                  : status === "close"
                  ? "linear-gradient(90deg,#CBA135,#E4C766)"
                  : "linear-gradient(90deg,#7C2D2D,#A8453F)",
            }}
          />
        </div>

        <div className="rounded-xl gold-card divide-y divide-[#CBA135]/12 mb-3.5 card-hover overflow-hidden">
          {spending.length === 0 && (
            <div className="px-4 py-4 lg-sans text-[12.5px] text-[#8FA396]">
              Nothing logged yet this month.
            </div>
          )}
          {spending.map((x) => (
            <div key={x.id} className="flex items-center justify-between px-4 py-2.5">
              <div className="flex flex-col min-w-0">
                <span className="lg-sans text-[13px] truncate">{x.desc}</span>
                {x.by && (
                  <span className="lg-mono text-[9.5px] text-[#CBA135]/70 uppercase tracking-wide">
                    {x.by}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3 shrink-0 pl-3">
                <span className="lg-mono text-[13px]">{money(x.amount)}</span>
                <button
                  onClick={() => removeSpend(x.id)}
                  aria-label={`Remove ${x.desc}`}
                  className="text-[#E7B4A8]/60 hover:text-[#E7B4A8]"
                >
                  <Trash2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            addSpend();
          }}
        >
          <input
            value={newSpend.desc}
            onChange={(e) => setNewSpend((v) => ({ ...v, desc: e.target.value }))}
            placeholder="What was it"
            aria-label="What was it"
            className="gold-input lg-sans flex-1 min-w-0 rounded-lg px-3 py-2.5 text-[13px] text-[#F3EEDF] placeholder:text-[#8FA396]"
          />
          <input
            value={newSpend.amount}
            onChange={(e) => setNewSpend((v) => ({ ...v, amount: e.target.value }))}
            placeholder="$"
            inputMode="decimal"
            aria-label="Amount"
            className="gold-input lg-mono w-20 rounded-lg px-3 py-2.5 text-[13px] text-[#F3EEDF] placeholder:text-[#8FA396]"
          />
          <button
            type="submit"
            className="shrink-0 rounded-lg px-3.5 flex items-center justify-center"
            style={{ background: "linear-gradient(135deg,#E4C766,#CBA135)", color: "#1A1208" }}
            aria-label="Add spending entry"
          >
            <Plus size={16} />
          </button>
        </form>
      </div>

      <div className="hairline mx-10 mt-9" />
      <p
        className="lg-sans text-[11px] text-[#8FA396] text-center mt-4 px-8 rise-in"
        style={{ animationDelay: "240ms" }}
      >
        Everything stays on this device — no account, no sync, works offline.
        Install it on each phone that needs it and use Backup to move the ledger
        between them.
      </p>

      <UpdateToast />
    </div>
  );
}

/**
 * One half of the leftover money, as a headline figure with the slider that
 * sizes it. Both cards share the single setAsidePercent split, so each one
 * reports its own side of it.
 */
function BucketCard({
  icon,
  label,
  amount,
  percent,
  onPercentChange,
  sliderLabel,
  note,
  seal,
  animationDelay,
  spacing = "mt-4",
}) {
  const animated = useCountUp(amount);

  return (
    <div
      className={`relative mx-5 ${spacing} rounded-xl overflow-hidden gold-card gold-frame card-hover rise-in`}
      style={{ animationDelay }}
    >
      {seal && (
        <div
          className="seal-pop absolute top-4 right-4 w-12 h-12 rounded-full flex items-center justify-center"
          style={{
            animationDelay: "550ms",
            background:
              "radial-gradient(circle at 35% 30%, #F6E7B0, #CBA135 65%, #8A6A1F 100%)",
            boxShadow:
              "0 3px 10px rgba(0,0,0,0.45), inset 0 1px 1px rgba(255,255,255,0.4)",
          }}
        >
          <span className="lg-serif italic text-[13px] text-[#1A1208] leading-none">
            HL
          </span>
        </div>
      )}
      <div className="px-6 pt-7 pb-3">
        <div className="flex items-center gap-1.5 text-[#CBA135] lg-mono text-[10.5px] tracking-[0.2em] uppercase">
          {icon} {label}
        </div>
        <div className="lg-serif text-[46px] leading-none font-semibold mt-2 figure-transition foil-text">
          {money(animated)}
        </div>
        <div className="lg-sans text-[12px] text-[#B9AF98] mt-2">{note}</div>
      </div>
      <div className="px-6 pb-6 pt-2">
        <input
          type="range"
          min="0"
          max="100"
          value={percent}
          onChange={(e) => onPercentChange(Number(e.target.value))}
          aria-label={sliderLabel}
          className="gold-slider w-full"
        />
      </div>
    </div>
  );
}

function Row({ label, value, bold, line }) {
  return (
    <div
      className={`flex items-center justify-between px-4 py-2.5 ${
        line ? "border-t border-[#CBA135]/25" : ""
      }`}
    >
      <span
        className={`lg-sans text-[13px] ${
          bold ? "font-semibold text-[#F3EEDF]" : "text-[#B9AF98]"
        }`}
      >
        {label}
      </span>
      <span
        className={`lg-mono text-[13.5px] ${bold ? "font-semibold" : ""}`}
        style={{ color: value < 0 ? "#E7B4A8" : "#F3EEDF" }}
      >
        {money(value)}
      </span>
    </div>
  );
}

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

function EditSection({
  icon,
  title,
  rows,
  amountField,
  dayLabel,
  onChange,
  onAdd,
  onRemove,
}) {
  return (
    <div>
      <div className="flex items-center gap-1.5 lg-sans text-[12px] font-semibold text-[#D8CBA5] mb-1.5 tracking-wide">
        <span className="text-[#CBA135]">{icon}</span> {title}
      </div>
      <div className="rounded-xl gold-card divide-y divide-[#CBA135]/12 overflow-hidden">
        {rows.map((r) => (
          <div key={r.id} className="px-3.5 py-2.5">
            <div className="flex items-center gap-2">
              <input
                value={r.name}
                onChange={(e) => onChange(r.id, "name", e.target.value)}
                aria-label={`${title} name`}
                className="lg-sans flex-1 min-w-0 bg-transparent text-[13px] outline-none text-[#F3EEDF]"
              />
              <input
                value={r[amountField]}
                onChange={(e) =>
                  onChange(
                    r.id,
                    amountField,
                    e.target.value === "" ? 0 : Number(e.target.value)
                  )
                }
                inputMode="decimal"
                aria-label={`${title} amount`}
                className="lg-mono w-16 bg-transparent text-[13px] text-right outline-none text-[#F3EEDF]"
              />
              <button
                onClick={() => onRemove(r.id)}
                aria-label={`Remove ${r.name}`}
                className="text-[#E7B4A8]/60 hover:text-[#E7B4A8]"
              >
                <Trash2 size={13} />
              </button>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <span className="lg-sans text-[11px] text-[#8FA396]">
                {dayLabel}
              </span>
              <select
                value={r.day ?? 1}
                onChange={(e) => onChange(r.id, "day", Number(e.target.value))}
                aria-label={`${title} — ${dayLabel}`}
                className="gold-input lg-mono text-[11px] text-[#D8CBA5] rounded px-1.5 py-0.5"
              >
                {DAYS.map((d) => (
                  <option key={d} value={d}>
                    {ordinal(d)}
                  </option>
                ))}
              </select>
              {r.day > 28 && (
                <span className="lg-sans text-[10.5px] text-[#8FA396]">
                  (or the last day, in shorter months)
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
      <button
        onClick={onAdd}
        className="lg-sans text-[11.5px] text-[#CBA135] mt-1.5 flex items-center gap-1"
      >
        <Plus size={12} /> Add
      </button>
    </div>
  );
}
