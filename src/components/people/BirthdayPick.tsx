"use client";

import { useState } from "react";
import { Select } from "@/components/Select";

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
/** Must match UNKNOWN_YEAR in lib/dates. A leap year, so 29 February survives. */
const UNKNOWN_YEAR = "1904";
const pad = (n: number) => String(n).padStart(2, "0");

function daysIn(month: number, year: number) {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * A birthday as three answers — day, month, and a year that may be left out.
 * A calendar is the wrong tool for a date forty years back; these are three
 * short lists. The value posts as one ordinary field, YYYY-MM-DD, or empty.
 */
export function BirthdayPick({ name, defaultValue }: { name: string; defaultValue: string | null }) {
  const [y0, m0, d0] = (defaultValue ?? "").split("-");
  const [day, setDay] = useState(d0 ? String(Number(d0)) : "");
  const [month, setMonth] = useState(m0 ? String(Number(m0)) : "");
  const [year, setYear] = useState(y0 && y0 !== UNKNOWN_YEAR ? y0 : "");

  const thisYear = new Date().getFullYear();
  const maxDay = daysIn(Number(month) || 1, Number(year) || Number(UNKNOWN_YEAR));
  const safeDay = Number(day) > maxDay ? String(maxDay) : day;
  const value = day && month ? `${year || UNKNOWN_YEAR}-${pad(Number(month))}-${pad(Number(safeDay))}` : "";

  return (
    <div className="bday">
      <input type="hidden" name={name} value={value} />
      <Select
        label="Birthday day"
        value={safeDay}
        block
        choices={[
          { value: "", label: "Day" },
          ...Array.from({ length: maxDay }, (_, i) => ({ value: String(i + 1), label: String(i + 1) })),
        ]}
        onChange={setDay}
      />
      <Select
        label="Birthday month"
        value={month}
        block
        choices={[{ value: "", label: "Month" }, ...MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))]}
        onChange={setMonth}
      />
      <Select
        label="Birthday year"
        value={year}
        block
        choices={[
          { value: "", label: "Year?" },
          ...Array.from({ length: thisYear - 1920 + 1 }, (_, i) => {
            const y = String(thisYear - i);
            return { value: y, label: y };
          }),
        ]}
        onChange={setYear}
      />
    </div>
  );
}
