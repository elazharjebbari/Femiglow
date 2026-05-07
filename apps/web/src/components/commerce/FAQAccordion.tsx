import type { FAQItem } from '@/lib/schemas';

interface FAQAccordionProps {
  items: FAQItem[];
}

export function FAQAccordion({ items }: FAQAccordionProps) {
  return (
    <ul className="divide-y divide-encre/10">
      {items.map((item) => (
        <li key={item.id}>
          <details className="group py-5">
            <summary className="flex min-h-[44px] cursor-pointer list-none items-center justify-between gap-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-encre">
              <span className="font-display text-lg text-encre">{item.question}</span>
              <svg
                aria-hidden="true"
                viewBox="0 0 16 16"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.2"
                strokeLinecap="round"
                className="h-4 w-4 shrink-0 text-encre/70 transition-transform duration-base ease-out-soft group-open:rotate-45 motion-reduce:transition-none"
              >
                <path d="M8 1v14M1 8h14" />
              </svg>
            </summary>
            <p className="mt-3 max-w-prose text-encre/80">{item.answer}</p>
          </details>
        </li>
      ))}
    </ul>
  );
}
