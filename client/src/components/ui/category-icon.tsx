"use client";

import { CATEGORY_ICON_BY_NAME, DEFAULT_CATEGORY_COLOR, DEFAULT_CATEGORY_ICON } from "@/lib/icons/category-icons";
import { useCategoriesById } from "@/lib/categories/use-categories";

/**
 * EL ícono de una categoría en cualquier pantalla que no sea el pin del
 * mapa (banner, hoja filtrada, perfil, tarjetas, resultados, chips) — PR 3
 * de 3. Lee `Category.icon`/`Category.color` (guardados en la base) desde
 * la caché compartida de categorías; ningún componente decide por su
 * cuenta qué ícono o qué color le toca a una categoría.
 *
 * Siempre la misma forma: círculo del color de la categoría con el ícono
 * en blanco, peso `fill` — la misma lectura que el pin del mapa (gota del
 * color de la categoría con el ícono blanco adentro). Tamaños fijos
 * (antes cada pantalla usaba el suyo y un peso distinto: fill 18px en las
 * filas, duotone 64px gris en la portada, bold 12px en las insignias).
 */
const SIZES = {
  xs: { circle: "h-4 w-4", icon: 10 },
  sm: { circle: "h-6 w-6", icon: 14 },
  md: { circle: "h-9 w-9", icon: 18 },
  xl: { circle: "h-24 w-24", icon: 48 },
} as const;

interface CategoryIconProps {
  categoryId: number | null | undefined;
  size?: keyof typeof SIZES;
  className?: string;
}

export function CategoryIcon({ categoryId, size = "md", className = "" }: CategoryIconProps) {
  const categoriesById = useCategoriesById();
  const category = categoryId != null ? categoriesById.get(categoryId) : undefined;
  // Lookup directo contra la tabla (no una llamada a función): la regla
  // react-hooks/static-components lo exige en el cuerpo de un componente.
  const Icon = (category?.icon && CATEGORY_ICON_BY_NAME[category.icon]) || DEFAULT_CATEGORY_ICON;
  const color = category?.color ?? DEFAULT_CATEGORY_COLOR;
  const { circle, icon } = SIZES[size];

  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full text-white ${circle} ${className}`}
      style={{ backgroundColor: color }}
      aria-hidden="true"
    >
      <Icon size={icon} weight="fill" />
    </span>
  );
}
