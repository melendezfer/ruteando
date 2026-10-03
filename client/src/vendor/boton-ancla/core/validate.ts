import type { Params } from "./params";
import type { AnchorScreen } from "./types";

/** Id de la opción fija "Atrás" que agrega el núcleo cuando la pantalla trae `back` (D-10). */
export const ID_ATRAS = "atras";
/** Id de la opción temporal "Deshacer" que ocupa la prioridad 1 mientras hay aviso (C-03). */
export const ID_DESHACER = "deshacer";

/** Id de la opción temporal "Cerrar" que ocupa la posición de 90° mientras hay una capa abierta (HM-03). */
export const ID_CERRAR = "cerrar";

/** Id de la opción "Ocultar teclado" que el ancla agrega a 180° con un teclado abierto (HM-06, HM-08, RF-17). */
export const ID_OCULTAR_TECLADO = "ocultar-teclado";

const IDS_RESERVADOS = [ID_ATRAS, ID_DESHACER, ID_CERRAR, ID_OCULTAR_TECLADO];

/**
 * Revisa lo que el tipo AnchorScreen no puede imponer por sí solo (C-13).
 * Devuelve la lista de errores en español; vacía si la pantalla es válida.
 * El adaptador decide qué hacer con ellos (en desarrollo, lanzar un error).
 */
export function validateScreen(screen: AnchorScreen, params: Params): string[] {
  const errores: string[] = [];
  const nombre = screen.id.trim() === "" ? "(sin id)" : `"${screen.id}"`;

  if (screen.id.trim() === "") {
    errores.push("La pantalla necesita un id no vacío (se usa para detectar el cambio de sección, RF-10).");
  }
  if (screen.sectionLabel.trim() === "") {
    errores.push(`La pantalla ${nombre} necesita sectionLabel: es parte del nombre accesible del ancla (RNF-05).`);
  }

  const total = screen.actions.length + (screen.back ? 1 : 0);
  if (total > params.MAX_OPCIONES) {
    errores.push(
      `La pantalla ${nombre} tiene ${total} opciones contando "Atrás"; el máximo es ${params.MAX_OPCIONES}.`,
    );
  }

  const vistos = new Set<string>();
  for (const accion of screen.actions) {
    const etiqueta = accion.id.trim() === "" ? "(sin id)" : `"${accion.id}"`;

    if (accion.id.trim() === "") {
      errores.push(`La pantalla ${nombre} tiene una acción sin id.`);
    } else if (vistos.has(accion.id)) {
      errores.push(`La pantalla ${nombre} repite el id de acción ${etiqueta}.`);
    }
    vistos.add(accion.id);

    if (IDS_RESERVADOS.includes(accion.id)) {
      errores.push(`El id ${etiqueta} está reservado por el ancla; usa otro.`);
    }
    if (accion.label.trim() === "") {
      errores.push(`La acción ${etiqueta} necesita label: es su etiqueta y su nombre accesible (RNF-05).`);
    }
    if (accion.priority !== undefined && !(Number.isInteger(accion.priority) && accion.priority >= 1)) {
      errores.push(`La acción ${etiqueta} tiene priority ${accion.priority}; debe ser un entero desde 1.`);
    }
    if (accion.kind === "reversible" && typeof accion.onUndo !== "function") {
      errores.push(`La acción ${etiqueta} es reversible y necesita onUndo (D-14, RF-08).`);
    }
    if (accion.onSlide && accion.kind === "irreversible") {
      errores.push(`La acción ${etiqueta} es un deslizador (onSlide) y no puede ser irreversible (RF-20).`);
    }
    if (accion.moveAnchor && ((accion.kind ?? "normal") !== "normal" || accion.onSlide)) {
      errores.push(`La acción ${etiqueta} mueve el ancla (moveAnchor) y debe ser normal y sin onSlide (RF3-01).`);
    }
    if (accion.atTop && ((accion.kind ?? "normal") !== "normal" || accion.onSlide)) {
      errores.push(`La acción ${etiqueta} va en 90° (atTop) y debe ser inofensiva: normal y sin onSlide (RF-22).`);
    }
  }

  // RF-22 (HM-14): 90° es de "volver"; sin "Atrás", una acción inofensiva la ocupa.
  const arriba = screen.actions.filter((a) => a.atTop);
  if (arriba.length > 1) {
    errores.push(`La pantalla ${nombre} marca ${arriba.length} acciones con atTop; solo una puede ir en 90° (RF-22).`);
  }
  if (!screen.back && screen.actions.length >= 2 && arriba.length === 0) {
    errores.push(
      `La pantalla ${nombre} no tiene "Atrás": marca con atTop la acción inofensiva que va en 90° (RF-22). 90° es de la familia "volver".`,
    );
  }

  return errores;
}
