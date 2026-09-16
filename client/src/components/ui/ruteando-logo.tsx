interface RuteandoLogoProps {
  size?: number;
  className?: string;
}

/**
 * Ícono de marca — pin de ubicación con una "R" adentro (rediseño de
 * marca, sin RF asociado, petición directa del usuario). Mismo path que
 * `client/public/icons/icon.svg` (favicon + ícono del manifest PWA) —
 * ese archivo es un asset estático servido tal cual por el navegador, sin
 * acceso a las variables CSS de la app ni a next/font, así que no puede
 * compartir código con este componente: si el diseño cambia, hay que
 * actualizar los dos a mano.
 *
 * `var(--color-terracota)`/`var(--color-surface)`, no un hex fijo — así
 * este ícono, a diferencia del SVG estático, sigue el token de marca
 * (globals.css) si vuelve a cambiar.
 */
export function RuteandoLogo({ size = 24, className }: RuteandoLogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      role="img"
      aria-label="Ruteando"
    >
      <path
        d="M50 8 C31 8 16 22.5 16 41 C16 64 50 93 50 93 C50 93 84 64 84 41 C84 22.5 69 8 50 8 Z"
        fill="var(--color-terracota)"
      />
      <circle cx="50" cy="40" r="25" fill="var(--color-surface)" />
      <text
        x="50"
        y="41"
        textAnchor="middle"
        dominantBaseline="central"
        fontFamily="var(--font-syne), sans-serif"
        fontWeight={800}
        fontSize="32"
        fill="var(--color-terracota)"
      >
        R
      </text>
    </svg>
  );
}
