import { useId, type InputHTMLAttributes } from "react";

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
}

/**
 * Input con etiqueta siempre visible (Documento 08, sección 5.5.5) — la
 * etiqueta va arriba del campo, nunca solo como placeholder ni como
 * "floating label" que empieza oculta. El mensaje de error, si lo hay,
 * también queda siempre visible debajo (en lenguaje simple, ya traducido
 * por quien llama — ver src/lib/api/error-messages.ts).
 */
export function TextField({ label, error, id, className = "", ...props }: TextFieldProps) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="font-sans text-body-sm font-medium text-text">
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={`rounded-input border px-4 py-3 font-sans text-body text-text outline-none focus:ring-2 focus:ring-terracota/40 ${
          error ? "border-rojo" : "border-border"
        } ${className}`}
        {...props}
      />
      {error && (
        <p id={errorId} className="font-sans text-body-sm text-rojo">
          {error}
        </p>
      )}
    </div>
  );
}
