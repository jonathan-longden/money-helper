import React, { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { exportAll, importAll } from "../lib/storage.js";

export default function BackupControls({ onRestored, onError }) {
  const fileRef = useRef(null);
  const [note, setNote] = useState("");

  const download = () => {
    const blob = new Blob([JSON.stringify(exportAll(), null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `household-ledger-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
    setNote("Backup saved.");
  };

  const restore = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (
      !window.confirm(
        "Restoring replaces the ledger on this device with the backup. Continue?"
      )
    ) {
      return;
    }

    try {
      importAll(JSON.parse(await file.text()));
      setNote("Backup restored.");
      onRestored?.();
    } catch (e) {
      onError?.(e.message || "Couldn't read that backup file.");
    }
  };

  return (
    <div className="mt-4">
      <div className="flex items-center gap-2">
        <button
          onClick={download}
          className="lg-sans gold-input rounded-lg px-3 py-2 text-[12px] text-[#D8CBA5] flex items-center gap-1.5"
        >
          <Download size={13} className="text-[#CBA135]" /> Save backup
        </button>
        <button
          onClick={() => fileRef.current?.click()}
          className="lg-sans gold-input rounded-lg px-3 py-2 text-[12px] text-[#D8CBA5] flex items-center gap-1.5"
        >
          <Upload size={13} className="text-[#CBA135]" /> Restore
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          onChange={restore}
          className="hidden"
        />
      </div>
      <p className="lg-sans text-[11px] text-[#8FA396] mt-2 leading-relaxed">
        {note ||
          "The ledger is stored only on this device. Save a backup before clearing browser data or moving to a new phone."}
      </p>
    </div>
  );
}
