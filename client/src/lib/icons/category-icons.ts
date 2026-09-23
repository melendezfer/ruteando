import type { Icon } from "@phosphor-icons/react";
import {
  Bread,
  Cake,
  Carrot,
  ChalkboardTeacher,
  Coffee,
  CookingPot,
  DotsThreeCircle,
  Flame,
  Hamburger,
  IceCream,
  OrangeSlice,
  Pill,
  Scales,
  Scissors,
  Yarn,
} from "@phosphor-icons/react/dist/ssr";
import type { components } from "@/lib/api/schema";

type Category = components["schemas"]["Category"];

/**
 * Ícono y color de una CATEGORÍA — única fuente del frontend (rehacer
 * íconos/colores/modalidad, PR 2 de 3). Ambos vienen guardados en la base
 * (`Category.icon`/`Category.color`, migración categorias-icono-color); acá
 * solo se traduce el nombre kebab-case de Phosphor a su componente. Nada
 * se deduce por `Category.type` ni se calcula por hash del id.
 *
 * Agregar una categoría con un ícono que no está en este mapa: sumarlo
 * acá (el import de arriba). Mientras no esté, la categoría se dibuja con
 * el ícono de respaldo — nunca rompe. Estos íconos NO deben reusar ninguno
 * de lib/icons/semantic-icons.ts (cada ícono, un solo significado).
 */
export const CATEGORY_ICON_BY_NAME: Record<string, Icon> = {
  bread: Bread,
  hamburger: Hamburger,
  flame: Flame,
  "cooking-pot": CookingPot,
  cake: Cake,
  "ice-cream": IceCream,
  "orange-slice": OrangeSlice,
  carrot: Carrot,
  coffee: Coffee,
  scissors: Scissors,
  scales: Scales,
  "chalkboard-teacher": ChalkboardTeacher,
  yarn: Yarn,
  pill: Pill,
};

/** Categoría sin ícono asignado todavía (o todavía sin cargar). */
export const DEFAULT_CATEGORY_ICON: Icon = DotsThreeCircle;

/** Mismo gris neutro que el DEFAULT de la columna `categorias.color`. */
export const DEFAULT_CATEGORY_COLOR = "#6b7280";

export interface CategoryVisual {
  Icon: Icon;
  color: string;
}

/**
 * Para usar dentro de un callback (`.map()`) o fuera de un componente —
 * en el cuerpo de un componente, la regla `react-hooks/static-components`
 * no acepta asignar a una variable con mayúscula el resultado de una
 * llamada; ahí usar `CATEGORY_ICON_BY_NAME` directo (ver components/ui/category-icon.tsx).
 */
export function resolveCategoryVisual(category: Category | null | undefined): CategoryVisual {
  return {
    Icon: (category?.icon && CATEGORY_ICON_BY_NAME[category.icon]) || DEFAULT_CATEGORY_ICON,
    color: category?.color ?? DEFAULT_CATEGORY_COLOR,
  };
}
