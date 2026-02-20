"use client";

export default function SchemaSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder || "Search..."}
      className="w-full mb-3 px-3 py-1.5 text-sm border border-zinc-300 dark:border-zinc-700 rounded bg-transparent placeholder:text-zinc-400"
    />
  );
}
