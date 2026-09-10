"use client";

import { useState, type FormEvent } from "react";
import { MagnifyingGlass } from "@phosphor-icons/react/dist/ssr";
import { TextField } from "@/components/ui/text-field";
import { Button } from "@/components/ui/button";

interface SearchBarProps {
  onSearch: (query: string) => void;
}

/**
 * Barra de búsqueda de la pantalla de Inicio (CLAUDE.md sección 18, Épica
 * F2) — se accede a la búsqueda por texto/categoría desde acá, no como
 * destino aparte en la barra de navegación (sección 5.3.1 del Documento
 * 08).
 */
export function SearchBar({ onSearch }: SearchBarProps) {
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
          placeholder="Nombre del negocio o tipo de comida"
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
