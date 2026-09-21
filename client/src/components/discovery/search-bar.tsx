"use client";

import { useState, type FormEvent } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  onSearch: (query: string) => void;
  /**
   * Redediseño de navegación global (sin RF asociado, petición directa
   * del usuario): el saludo con el nombre ya no vive en un header fijo
   * aparte — se mueve acá, al placeholder ("¿Qué buscas, {nombre}?"),
   * para que el buscador sea el único elemento personalizado por
   * contexto en vez de duplicar el nombre en dos lugares. Opcional: sin
   * nombre (ej. mientras `useAuth()` todavía resuelve la sesión), cae al
   * placeholder genérico de siempre.
   */
  userFirstName?: string;
}

/**
 * Barra de búsqueda de la pantalla de Inicio (CLAUDE.md sección 18, Épica
 * F2) — se accede a la búsqueda por texto/categoría desde acá, no como
 * destino aparte en la barra de navegación (sección 5.3.1 del Documento
 * 08). Reusada también dentro de `MapSearchSheet` (Fase B de la fusión de
 * buscadores) — mismo componente, mismo placeholder personalizado ahí.
 */
export function SearchBar({ onSearch, userFirstName }: SearchBarProps) {
  const [query, setQuery] = useState("");

  function handleSubmit(event: FormEvent) {
    event.preventDefault();
    const trimmed = query.trim();
    if (trimmed) onSearch(trimmed);
  }

  return (
    <form onSubmit={handleSubmit} className="flex items-end gap-2">
      <div className="flex-1">
        <TextField
          label="Buscar"
          placeholder={userFirstName ? `¿Qué buscas, ${userFirstName}?` : "Nombre del negocio, producto o servicio"}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
      </div>
      <Button type="submit" aria-label="Buscar">
        <MagnifyingGlass size={20} weight="bold" />
      </Button>
    </form>
  );
}
