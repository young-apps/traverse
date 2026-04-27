// DateRangePicker — Sunday to Saturday calendar
import { useState, useMemo } from "react";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toDateStr(y, m, d) {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function parseDateStr(s) {
  if (!s) return null;
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export default function DateRangePicker({ startDate, endDate, onChange }) {
  const initDate = startDate ? parseDateStr(startDate) : new Date();
  const [viewYear, setViewYear] = useState(initDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(initDate.getMonth());
  const [selecting, setSelecting] = useState(startDate && !endDate ? "end" : "start");

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(viewYear - 1); }
    else setViewMonth(viewMonth - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(viewYear + 1); }
    else setViewMonth(viewMonth + 1);
  };

  // Generate calendar grid — Sunday = 0
  const calendarDays = useMemo(() => {
    const firstDay = new Date(viewYear, viewMonth, 1);
    const lastDay = new Date(viewYear, viewMonth + 1, 0);
    const startPad = firstDay.getDay(); // Sunday = 0, already correct
    const days = [];

    const prevLast = new Date(viewYear, viewMonth, 0).getDate();
    for (let i = startPad - 1; i >= 0; i--) {
      days.push({ day: prevLast - i, inMonth: false, date: null });
    }
    for (let d = 1; d <= lastDay.getDate(); d++) {
      days.push({ day: d, inMonth: true, date: toDateStr(viewYear, viewMonth, d) });
    }
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ day: d, inMonth: false, date: null });
    }
    return days;
  }, [viewYear, viewMonth]);

  const handleDayClick = (dateStr) => {
    if (!dateStr) return;
    if (selecting === "start") {
      onChange(dateStr, "");
      setSelecting("end");
    } else {
      if (startDate && dateStr < startDate) {
        onChange(dateStr, startDate);
      } else {
        onChange(startDate, dateStr);
      }
      setSelecting("start");
    }
  };

  const getDayState = (dateStr) => {
    if (!dateStr) return "";
    if (dateStr === startDate && dateStr === endDate) return "both";
    if (dateStr === startDate) return "start";
    if (dateStr === endDate) return "end";
    if (startDate && endDate && dateStr > startDate && dateStr < endDate) return "range";
    return "";
  };

  const today = toDateStr(new Date().getFullYear(), new Date().getMonth(), new Date().getDate());

  return (
    <div style={{ background: "var(--bg-2)", border: "1px solid var(--border)", borderRadius: 14, padding: "14px 12px", marginBottom: 14 }}>
      {/* Selection indicator */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <button onClick={() => setSelecting("start")} style={{
          flex: 1, padding: "8px 10px", borderRadius: 8, textAlign: "left", cursor: "pointer",
          background: selecting === "start" ? "var(--accent-muted)" : "var(--surface)",
          border: `1px solid ${selecting === "start" ? "var(--accent-border)" : "var(--border)"}`,
          color: startDate ? "var(--text)" : "var(--text-dim)", font: "500 12px var(--font-sans)",
        }}>
          <div style={{ font: "600 9px var(--font-mono)", color: selecting === "start" ? "var(--accent)" : "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>
            Check-in {selecting === "start" ? "←" : ""}
          </div>
          {startDate ? formatDisplay(startDate) : "Select date"}
        </button>
        <div style={{ display: "flex", alignItems: "center", color: "var(--text-dim)", font: "12px var(--font-mono)" }}>→</div>
        <button onClick={() => setSelecting("end")} style={{
          flex: 1, padding: "8px 10px", borderRadius: 8, textAlign: "left", cursor: "pointer",
          background: selecting === "end" ? "var(--accent-muted)" : "var(--surface)",
          border: `1px solid ${selecting === "end" ? "var(--accent-border)" : "var(--border)"}`,
          color: endDate ? "var(--text)" : "var(--text-dim)", font: "500 12px var(--font-sans)",
        }}>
          <div style={{ font: "600 9px var(--font-mono)", color: selecting === "end" ? "var(--accent)" : "var(--text-dim)", textTransform: "uppercase", letterSpacing: 1, marginBottom: 3 }}>
            Check-out {selecting === "end" ? "←" : ""}
          </div>
          {endDate ? formatDisplay(endDate) : "Select date"}
        </button>
      </div>

      {/* Month nav */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10, padding: "0 4px" }}>
        <button onClick={prevMonth} style={navBtnStyle}>‹</button>
        <span style={{ font: "600 14px var(--font-sans)", color: "var(--text)" }}>{MONTHS[viewMonth]} {viewYear}</span>
        <button onClick={nextMonth} style={navBtnStyle}>›</button>
      </div>

      {/* Day headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 4 }}>
        {DAYS.map((d) => (
          <div key={d} style={{ textAlign: "center", font: "600 10px var(--font-mono)", color: "var(--text-dim)", padding: "4px 0" }}>{d}</div>
        ))}
      </div>

      {/* Calendar grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {calendarDays.map((cell, i) => {
          const state = getDayState(cell.date);
          const isToday = cell.date === today;
          return (
            <button key={i} onClick={() => handleDayClick(cell.date)} disabled={!cell.inMonth}
              style={{
                padding: "7px 0", border: "none", cursor: cell.inMonth ? "pointer" : "default",
                borderRadius: state === "start" ? "8px 0 0 8px" : state === "end" ? "0 8px 8px 0" : state === "both" ? "8px" : state === "range" ? "0" : "8px",
                background: (state === "start" || state === "end" || state === "both") ? "var(--accent)" : state === "range" ? "var(--accent-muted)" : "transparent",
                color: !cell.inMonth ? "var(--text-dim)" : (state === "start" || state === "end" || state === "both") ? "var(--bg)" : state === "range" ? "var(--accent)" : isToday ? "var(--accent)" : "var(--text)",
                font: `${(state === "start" || state === "end" || state === "both") ? "700" : "400"} 13px var(--font-sans)`,
                transition: "all 0.1s", opacity: cell.inMonth ? 1 : 0.25, position: "relative",
              }}>
              {cell.day}
              {isToday && !state && (
                <div style={{ position: "absolute", bottom: 2, left: "50%", transform: "translateX(-50%)", width: 3, height: 3, borderRadius: "50%", background: "var(--accent)" }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Quick jump */}
      <div style={{ display: "flex", gap: 6, marginTop: 10, flexWrap: "wrap" }}>
        {[-3, -6, -12, -24, -36].map((months) => {
          const d = new Date(); d.setMonth(d.getMonth() + months);
          const label = months === -3 ? "3mo ago" : months === -6 ? "6mo ago" : months === -12 ? "1yr ago" : months === -24 ? "2yr ago" : "3yr ago";
          return (
            <button key={months} onClick={() => { setViewYear(d.getFullYear()); setViewMonth(d.getMonth()); }}
              style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid var(--border)", background: "transparent", color: "var(--text-dim)", font: "500 10px var(--font-mono)", cursor: "pointer" }}>
              {label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function formatDisplay(dateStr) {
  if (!dateStr) return "";
  const d = parseDateStr(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const navBtnStyle = {
  width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)",
  background: "transparent", color: "var(--text-secondary)", font: "18px var(--font-sans)",
  cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
};
