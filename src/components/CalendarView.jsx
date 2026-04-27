// CalendarView — shows adjacent month days, bars below date numbers
import { useState, useMemo } from "react";

const MONTHS = ["January","February","March","April","May","June","July","August","September","October","November","December"];
const DAYS = ["Su","Mo","Tu","We","Th","Fr","Sa"];
const COLORS = [
  { bg: "rgba(212,164,76,0.20)", border: "rgba(212,164,76,0.5)", text: "#D4A44C" },
  { bg: "rgba(61,214,140,0.18)", border: "rgba(61,214,140,0.45)", text: "#3DD68C" },
  { bg: "rgba(78,158,245,0.18)", border: "rgba(78,158,245,0.45)", text: "#4E9EF5" },
  { bg: "rgba(168,85,247,0.18)", border: "rgba(168,85,247,0.45)", text: "#A855F7" },
  { bg: "rgba(240,96,80,0.18)", border: "rgba(240,96,80,0.45)", text: "#F06050" },
  { bg: "rgba(6,182,212,0.18)", border: "rgba(6,182,212,0.45)", text: "#06B6D4" },
];

function dateToStr(y, m, d) { return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`; }

export default function CalendarView({ stays }) {
  const now = new Date();
  const [vy, setVY] = useState(now.getFullYear());
  const [vm, setVM] = useState(now.getMonth());

  const prev = () => { if (vm === 0) { setVM(11); setVY(vy - 1); } else setVM(vm - 1); };
  const next = () => { if (vm === 11) { setVM(0); setVY(vy + 1); } else setVM(vm + 1); };

  // Build grid INCLUDING adjacent month days (so stays spanning months are visible)
  const { weeks, allDates } = useMemo(() => {
    const first = new Date(vy, vm, 1);
    const last = new Date(vy, vm + 1, 0);
    const pad = first.getDay(); // Sunday = 0
    const totalDays = last.getDate();
    const cells = [];

    // Previous month trailing days
    const prevLast = new Date(vy, vm, 0);
    const prevMonth = vm === 0 ? 11 : vm - 1;
    const prevYear = vm === 0 ? vy - 1 : vy;
    for (let i = pad - 1; i >= 0; i--) {
      const d = prevLast.getDate() - i;
      cells.push({ day: d, date: dateToStr(prevYear, prevMonth, d), inMonth: false });
    }

    // Current month
    for (let d = 1; d <= totalDays; d++) {
      cells.push({ day: d, date: dateToStr(vy, vm, d), inMonth: true });
    }

    // Next month leading days
    const nextMonth = vm === 11 ? 0 : vm + 1;
    const nextYear = vm === 11 ? vy + 1 : vy;
    let nd = 1;
    while (cells.length % 7 !== 0) {
      cells.push({ day: nd, date: dateToStr(nextYear, nextMonth, nd), inMonth: false });
      nd++;
    }

    const weeks = [];
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7));
    const allDates = cells.map(c => c.date);
    return { weeks, allDates };
  }, [vy, vm]);

  // Find stays visible in this grid (including ones that start/end in adjacent months)
  const gridStart = allDates[0];
  const gridEnd = allDates[allDates.length - 1];

  const visibleStays = useMemo(() => {
    return stays
      .filter((s) => s.checkIn && s.checkOut && s.checkIn <= gridEnd && s.checkOut >= gridStart)
      .map((s, i) => ({
        ...s, color: COLORS[i % COLORS.length],
        visStart: s.checkIn < gridStart ? gridStart : s.checkIn,
        visEnd: s.checkOut > gridEnd ? gridEnd : s.checkOut,
      }));
  }, [stays, gridStart, gridEnd]);

  // Calculate bars per week
  const weekBars = useMemo(() => {
    return weeks.map((week) => {
      const weekDates = week.map((c) => c.date);
      const firstDate = weekDates[0];
      const lastDate = weekDates[6];

      return visibleStays
        .filter((s) => s.visStart <= lastDate && s.visEnd >= firstDate)
        .map((s) => {
          let startCol = 0, endCol = 6;
          for (let i = 0; i < 7; i++) {
            if (weekDates[i] >= s.visStart) { startCol = i; break; }
          }
          for (let i = 6; i >= 0; i--) {
            if (weekDates[i] <= s.visEnd) { endCol = i; break; }
          }
          if (endCol < startCol) endCol = startCol;
          return { ...s, startCol, endCol };
        });
    });
  }, [weeks, visibleStays]);

  const today = dateToStr(now.getFullYear(), now.getMonth(), now.getDate());

  return (
    <div style={{ padding: "0 20px 40px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <button onClick={prev} style={navBtn}>‹</button>
        <div style={{ textAlign: "center" }}>
          <div style={{ font: "600 18px var(--font-sans)", color: "var(--text)" }}>{MONTHS[vm]}</div>
          <div style={{ font: "12px var(--font-mono)", color: "var(--text-dim)" }}>{vy}</div>
        </div>
        <button onClick={next} style={navBtn}>›</button>
      </div>
      <div style={{ display: "flex", justifyContent: "center", marginBottom: 14 }}>
        <button onClick={() => { setVY(now.getFullYear()); setVM(now.getMonth()); }} style={{ padding: "4px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "none", color: "var(--accent)", font: "500 11px var(--font-mono)", cursor: "pointer" }}>Today</button>
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 16, border: "1px solid var(--border)", overflow: "hidden" }}>
        {/* Day headers */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", borderBottom: "1px solid var(--border)" }}>
          {DAYS.map((d) => <div key={d} style={{ textAlign: "center", padding: "10px 0", font: "600 11px var(--font-mono)", color: "var(--text-dim)" }}>{d}</div>)}
        </div>

        {/* Weeks */}
        {weeks.map((week, wi) => {
          const bars = weekBars[wi] || [];
          const barHeight = 20;
          const barGap = 3;
          const barsSpace = bars.length > 0 ? bars.length * (barHeight + barGap) + 4 : 0;

          return (
            <div key={wi} style={{ borderBottom: wi < weeks.length - 1 ? "1px solid var(--border)" : "none" }}>
              {/* Date numbers row */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)" }}>
                {week.map((cell, ci) => (
                  <div key={ci} style={{
                    padding: "8px 0",
                    textAlign: "center",
                    font: "13px var(--font-sans)",
                    color: cell.date === today ? "var(--accent)"
                      : cell.inMonth ? "var(--text-secondary)" : "var(--text-dim)",
                    opacity: cell.inMonth ? 1 : 0.35,
                    fontWeight: cell.date === today ? 700 : 400,
                  }}>
                    {cell.date === today ? (
                      <span style={{ background: "var(--accent)", color: "var(--bg)", width: 26, height: 26, borderRadius: "50%", display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>
                        {cell.day}
                      </span>
                    ) : cell.day}
                  </div>
                ))}
              </div>

              {/* Bars row — BELOW the dates */}
              {bars.length > 0 && (
                <div style={{ position: "relative", height: barsSpace, paddingBottom: 4 }}>
                  {bars.map((bar, bi) => {
                    const left = `${(bar.startCol / 7) * 100}%`;
                    const width = `${((bar.endCol - bar.startCol + 1) / 7) * 100}%`;
                    return (
                      <div key={bi} style={{
                        position: "absolute", left, width,
                        top: bi * (barHeight + barGap),
                        height: barHeight,
                        background: bar.color.bg,
                        borderLeft: `3px solid ${bar.color.border}`,
                        borderRadius: 4,
                        display: "flex", alignItems: "center",
                        paddingLeft: 6, paddingRight: 4, overflow: "hidden",
                      }}>
                        <span style={{
                          font: "600 10px var(--font-sans)", color: bar.color.text,
                          whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                        }}>
                          {bar.city || bar.hotel}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      {visibleStays.length > 0 && (
        <div style={{ marginTop: 14 }}>
          {visibleStays.map((s, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0", borderBottom: i < visibleStays.length - 1 ? "1px solid var(--border)" : "none" }}>
              <div style={{ width: 14, height: 14, borderRadius: 4, background: s.color.bg, border: `2px solid ${s.color.border}`, flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ font: "500 14px var(--font-sans)", color: "var(--text)" }}>{s.hotel}</div>
                <div style={{ font: "12px var(--font-mono)", color: "var(--text-dim)" }}>{s.city} · {s.nights}n</div>
              </div>
            </div>
          ))}
        </div>
      )}
      {visibleStays.length === 0 && <div style={{ marginTop: 20, textAlign: "center", font: "italic 14px var(--font-display)", color: "var(--text-dim)" }}>No stays this month</div>}
    </div>
  );
}

const navBtn = { width: 36, height: 36, borderRadius: 10, border: "1px solid var(--border)", background: "none", color: "var(--text-secondary)", font: "20px var(--font-sans)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" };
