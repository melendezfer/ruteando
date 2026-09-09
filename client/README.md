# Ruteando — Frontend

Next.js (App Router, TypeScript) — ver `CLAUDE.md` (secciones 12-19) en la
raíz del repo para el contexto completo de arquitectura y decisiones.

## Desarrollo

```bash
npm install
cp .env.example .env.local   # ajustar NEXT_PUBLIC_API_BASE_URL si hace falta
npm run dev
```

Corre en [http://localhost:3001](http://localhost:3001) — **no** 3000, para
no chocar con el backend (`../`, que sí usa 3000 por defecto).

## Cliente de API tipado

`npm run dev`/`npm run build` regeneran automáticamente
`src/lib/api/schema.ts` a partir de `../openapi.yaml` (vía
`openapi-typescript`) — ese archivo generado no se comitea (ver
`.gitignore`). Para regenerarlo a mano: `npm run generate:api`.

Uso:

```ts
import { api } from "@/lib/api/client";

const { data, error } = await api.GET("/businesses/nearby", {
  params: { query: { lat: 4.578, lng: -74.217, radiusKm: 2 } },
});
```

## Estado

Solo la base de la Épica F0 (CLAUDE.md sección 18) — tokens de diseño, PWA,
tipografías, Phosphor Icons y el cliente de API. Sin pantallas todavía.
