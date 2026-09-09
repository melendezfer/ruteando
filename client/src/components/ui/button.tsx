import type { ButtonHTMLAttributes } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  loading?: boolean;
  variant?: "primary" | "secondary";
}

/**
 * Botón base (Épica F0/F1): 48px de alto (h-btn, Documento 08 5.5),
 * radio de input (rounded-input) y la utilidad tipográfica text-button
 * (15/20, Inter semibold) definidas en globals.css.
 */
export function Button({
  loading = false,
  variant = "primary",
  disabled,
  className = "",
  children,
  ...props
}: ButtonProps) {
  const variantClasses =
    variant === "primary"
      ? "bg-terracota text-white hover:bg-terracota-dark"
      : "border border-border bg-surface text-text hover:bg-background";

  return (
    <button
      type="button"
      disabled={disabled || loading}
      className={`h-btn rounded-input px-6 font-sans text-button font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${variantClasses} ${className}`}
      {...props}
    >
      {loading ? "Cargando…" : children}
    </button>
  );
}
