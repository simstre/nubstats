"use client";

interface StatCardProps {
  label: string;
  value: string | number;
  subtitle?: string;
  highlight?: boolean;
}

export function StatCard({ label, value, subtitle, highlight }: StatCardProps) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? "border-yellow-500/50 bg-yellow-500/10"
          : "border-zinc-700 bg-zinc-800/50"
      }`}
    >
      <div className="text-xs uppercase tracking-wider text-zinc-400">
        {label}
      </div>
      <div
        className={`mt-1 text-2xl font-bold ${
          highlight ? "text-yellow-400" : "text-white"
        }`}
      >
        {value}
      </div>
      {subtitle && (
        <div className="mt-0.5 text-xs text-zinc-500">{subtitle}</div>
      )}
    </div>
  );
}
