import { cn } from "@/components/ui/cn";

export type Option = { value: string; label: string; description?: string };

/**
 * Click-to-select cards. Mirrors CheckboxGrid from components/app/inputs, but
 * handles radios too so single-choice groups read the same as multi-choice ones.
 */
export function OptionGrid({
  type,
  name,
  options,
  initial = [],
  columns = 3,
  required,
}: {
  type: "checkbox" | "radio";
  name: string;
  options: Option[];
  initial?: string[];
  columns?: 2 | 3 | 4;
  required?: boolean;
}) {
  const selected = new Set(initial);
  return (
    <div
      className={cn(
        "grid gap-2",
        columns === 2 ? "sm:grid-cols-2" : columns === 4 ? "sm:grid-cols-2 lg:grid-cols-4" : "sm:grid-cols-2 lg:grid-cols-3",
      )}
    >
      {options.map((option) => (
        <label
          key={option.value}
          className="flex cursor-pointer items-start gap-2 rounded-[8px] border border-line bg-white px-3 py-2 text-[13.5px] text-ink transition-colors hover:border-forest/40 has-[:checked]:border-forest has-[:checked]:bg-moss/50"
        >
          <input
            type={type}
            name={name}
            value={option.value}
            defaultChecked={selected.has(option.value)}
            required={required}
            className="mt-0.5 size-4 shrink-0 accent-[#1d4436]"
          />
          <span className="min-w-0">
            <span className="block">{option.label}</span>
            {option.description ? (
              <span className="mt-0.5 block text-[12px] leading-5 text-muted">{option.description}</span>
            ) : null}
          </span>
        </label>
      ))}
    </div>
  );
}
