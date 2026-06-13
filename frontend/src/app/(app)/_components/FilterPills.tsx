'use client';

interface FilterPillsProps<T extends string> {
  options: { value: T; label: string }[];
  selected: T;
  onSelect: (value: T) => void;
}

export default function FilterPills<T extends string>({
  options,
  selected,
  onSelect,
}: FilterPillsProps<T>) {
  return (
    <div className="flex gap-3 flex-wrap">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => onSelect(opt.value)}
          className={`px-5 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 ${
            selected === opt.value
              ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm'
              : 'bg-white text-gray-500 border border-gray-200 hover:border-emerald-200 hover:text-emerald-600'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
