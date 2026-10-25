"use client";

import { cx } from "./ui";

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = "md",
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex flex-wrap gap-0.5 rounded-[10px] bg-track p-[3px]">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cx(
              "rounded-lg px-3.5 text-[13px]",
              size === "sm" ? "min-h-8" : "min-h-9",
              on ? "bg-surface font-bold text-navy shadow-[0_1px_2px_rgba(20,23,31,0.08)]" : "text-sub hover:text-ink",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="ml-1 tabular text-muted">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
  label,
}: {
  options: { value: T; label: string; count?: number }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            aria-pressed={on}
            onClick={() => onChange(o.value)}
            className={cx(
              "min-h-9 rounded-full border px-3.5 text-[13px]",
              on ? "border-navy bg-navy-tint font-bold text-navy" : "border-field bg-surface text-sub hover:border-navy",
            )}
          >
            {o.label}
            {o.count !== undefined && <span className="ml-1 tabular">{o.count}</span>}
          </button>
        );
      })}
    </div>
  );
}
