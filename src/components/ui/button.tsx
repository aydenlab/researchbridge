import Link from "next/link";
import { cn } from "./cn";

type Variant = "primary" | "secondary" | "ghost" | "outline" | "danger" | "onDark";
type Size = "sm" | "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap font-medium transition-[transform,background-color,color,border-color] disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

const variants: Record<Variant, string> = {
  primary: "bg-ink text-white hover:bg-ink/85 hover:scale-[1.03]",
  secondary: "bg-cream text-ink border border-line-strong hover:bg-line/60",
  outline: "border border-line-strong bg-white text-ink hover:border-ink/40 hover:bg-shell",
  ghost: "text-ink hover:bg-cream",
  danger: "border border-[#e2c4c0] bg-white text-bad hover:bg-[#fbf2f1]",
  onDark: "bg-white/90 text-ink backdrop-blur-md hover:bg-white hover:scale-[1.03]",
};

const sizes: Record<Size, string> = {
  sm: "h-8 rounded-full px-3.5 text-[13px]",
  md: "h-10 rounded-full px-5 text-sm",
  lg: "h-11 rounded-full px-6 text-[15px]",
};

type CommonProps = { variant?: Variant; size?: Size; className?: string };

export function Button({
  variant = "primary",
  size = "md",
  className,
  type = "button",
  ...props
}: CommonProps & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  size = "md",
  className,
  href,
  ...props
}: CommonProps & { href: string } & Omit<React.ComponentProps<typeof Link>, "href" | "className">) {
  return <Link href={href} className={cn(base, variants[variant], sizes[size], className)} {...props} />;
}
