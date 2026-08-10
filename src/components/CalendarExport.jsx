import React, { useState } from "react";
import { CalendarPlus } from "lucide-react";
import { buildCalendar, calendarIsEmpty } from "../lib/calendar.js";

const FILENAME = "household-ledger-reminders.ics";

export default function CalendarExport({ setup, onError }) {
  const [note, setNote] = useState("");

  const exportReminders = async () => {
    const ics = buildCalendar(setup);

    if (calendarIsEmpty(ics)) {
      onError?.("Add an amount and a date to a bill first — there's nothing to remind you about yet.");
      return;
    }

    const file = new File([ics], FILENAME, { type: "text/calendar" });

    // A standalone iOS PWA is unreliable at plain downloads, but the share
    // sheet hands the file straight to Calendar.
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: "Household Ledger reminders" });
        setNote("Sent to your calendar app.");
        return;
      } catch (e) {
        if (e?.name === "AbortError") return; // user dismissed the sheet
        // Anything else falls through to the download path below.
      }
    }

    const url = URL.createObjectURL(file);
    const a = document.createElement("a");
    a.href = url;
    a.download = FILENAME;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setNote("Downloaded — open the file to add it to your calendar.");
  };

  return (
    <div className="mt-4">
      <button
        onClick={exportReminders}
        className="lg-sans gold-input rounded-lg px-3 py-2 text-[12px] text-[#D8CBA5] flex items-center gap-1.5"
      >
        <CalendarPlus size={13} className="text-[#CBA135]" /> Add reminders to
        calendar
      </button>
      <p className="lg-sans text-[11px] text-[#8FA396] mt-2 leading-relaxed">
        {note ||
          "Puts each bill in your calendar with an alert 24 hours before it goes out, plus a payday reminder to move your set-aside amount. Covers the next two years — export again after you change anything."}
      </p>
    </div>
  );
}
