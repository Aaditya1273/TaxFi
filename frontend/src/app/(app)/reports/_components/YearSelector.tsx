'use client';

interface YearSelectorProps {
  selectedYear: number;
  onYearChange: (year: number) => void;
}

export default function YearSelector({ selectedYear, onYearChange }: YearSelectorProps) {
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i - 1);

  return (
    <div className="bg-white border border-gray-200 rounded-3xl p-6 shadow-sm">
      <h2 className="text-lg font-bold text-gray-900 mb-4">Select Tax Year</h2>
      <div className="flex flex-wrap gap-3">
        {years.map((year) => (
          <button
            key={year}
            onClick={() => onYearChange(year)}
            className={`px-6 py-3 rounded-xl font-medium transition-all ${
              selectedYear === year
                ? 'bg-emerald-50 text-emerald-600 border border-emerald-200 shadow-sm'
                : 'bg-gray-50 text-gray-500 border border-gray-200 hover:border-emerald-200 hover:text-emerald-600'
            }`}
          >
            {year}
          </button>
        ))}
      </div>
    </div>
  );
}
