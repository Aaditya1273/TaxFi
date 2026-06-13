'use client';

import type { FAQItem } from '../data';

interface FAQAccordionProps {
  item: FAQItem;
  isOpen: boolean;
  onClick: () => void;
}

export default function FAQAccordion({ item, isOpen, onClick }: FAQAccordionProps) {
  return (
    <div className="border-b border-gray-200 last:border-0">
      <button
        onClick={onClick}
        className="w-full flex items-center justify-between py-6 text-left group"
      >
        <span className="text-lg font-medium text-gray-800 group-hover:text-gray-900 transition-colors">
          {item.q}
        </span>
        <span
          className={`text-emerald-400 transition-transform duration-300 text-xl ml-4 ${
            isOpen ? 'rotate-45' : ''
          }`}
        >
          +
        </span>
      </button>
      <div
        className={`overflow-hidden transition-all duration-300 ${
          isOpen ? 'max-h-96 pb-6 opacity-100' : 'max-h-0 opacity-0'
        }`}
      >
        <p className="text-gray-600 leading-relaxed">{item.a}</p>
      </div>
    </div>
  );
}
