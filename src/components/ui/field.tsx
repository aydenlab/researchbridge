import { cn } from "./cn";

export function Field({
  label,
  htmlFor,
  hint,
  error,
  required,
  className,
  children,
}: {
  label: string;
  htmlFor: string;
  hint?: string;
  error?: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const hintId = hint ? `${htmlFor}-hint` : undefined;
  const errorId = error ? `${htmlFor}-error` : undefined;
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <label htmlFor={htmlFor} className="text-[13px] font-medium text-ink">
        {label}
        {required ? <span className="ml-1 text-clay">*</span> : <span className="ml-1.5 text-[11.5px] font-normal text-subtle">Optional</span>}
      </label>
      {hint ? (
        <p id={hintId} className="text-[12.5px] leading-5 text-muted">
          {hint}
        </p>
      ) : null}
      {children}
      {error ? (
        <p id={errorId} role="alert" className="text-[12.5px] text-bad">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const control =
  "w-full rounded-[8px] border border-line-strong bg-white px-3 py-2 text-[14px] text-ink placeholder:text-subtle transition-colors hover:border-ink/25 focus:border-forest disabled:bg-shell disabled:text-muted";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(control, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(control, "min-h-[110px] leading-6", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(control, "appearance-none bg-white pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function CheckboxRow({
  id,
  name,
  value,
  label,
  description,
  defaultChecked,
  className,
}: {
  id: string;
  name: string;
  value?: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
  className?: string;
}) {
  return (
    <label
      htmlFor={id}
      className={cn(
        "flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-white px-3 py-2.5 transition-colors hover:border-ink/25",
        className,
      )}
    >
      <input
        id={id}
        name={name}
        value={value}
        type="checkbox"
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 shrink-0 accent-[#1d4436]"
      />
      <span className="min-w-0">
        <span className="block text-[13.5px] text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-[12px] leading-5 text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function RadioRow({
  id,
  name,
  value,
  label,
  description,
  defaultChecked,
}: {
  id: string;
  name: string;
  value: string;
  label: string;
  description?: string;
  defaultChecked?: boolean;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-start gap-2.5 rounded-[8px] border border-line bg-white px-3 py-2.5 transition-colors hover:border-ink/25"
    >
      <input
        id={id}
        name={name}
        value={value}
        type="radio"
        defaultChecked={defaultChecked}
        className="mt-0.5 size-4 shrink-0 accent-[#1d4436]"
      />
      <span className="min-w-0">
        <span className="block text-[13.5px] text-ink">{label}</span>
        {description ? <span className="mt-0.5 block text-[12px] leading-5 text-muted">{description}</span> : null}
      </span>
    </label>
  );
}

export function FormError({ children }: { children?: string | null }) {
  if (!children) return null;
  return (
    <div role="alert" className="rounded-[8px] border border-[#e8cdc9] bg-[#f9ecea] px-3 py-2.5 text-[13px] text-bad">
      {children}
    </div>
  );
}

export function FormNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] border border-line bg-shell px-3 py-2.5 text-[12.5px] leading-5 text-muted">
      {children}
    </div>
  );
}
