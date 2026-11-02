"use client";

// Context tags — optional, one tap, saved with the meal. This is what makes
// insights honest ("Missing: stress data") instead of hand-wavy.

export interface ContextTag {
  id: string;
  label: string;
}

export interface ContextTagsProps {
  tags: ContextTag[];
  selected: string[];
  onToggle: (id: string) => void;
}

export function ContextTags({ tags, selected, onToggle }: ContextTagsProps) {
  return (
    <div className="rounded-xl border border-neutral-200 bg-white p-4 sm:p-5">
      <h3 className="text-sm font-semibold text-neutral-900">How’s today going?</h3>
      <p className="mt-0.5 text-xs text-neutral-500">
        Optional — saved with this meal to sharpen your insights.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {tags.map((t) => {
          const on = selected.includes(t.id);
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => onToggle(t.id)}
              aria-pressed={on}
              className={`h-10 rounded-full border px-4 text-sm transition-colors ${
                on
                  ? "border-[#0a8e5f] bg-[#0a8e5f] text-white"
                  : "border-neutral-300 bg-white text-neutral-700 hover:border-neutral-400"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
