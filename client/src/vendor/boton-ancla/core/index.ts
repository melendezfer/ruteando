// API pública del núcleo del botón-ancla (spec §7).
// Cada módulo se agrega aquí a medida que se implementa (ver specs/fase-1/tasks.md).
export type {
  ActionKind,
  AnchorAction,
  AnchorIcon,
  AnchorPrefs,
  AnchorScreen,
  Hand,
  Insets,
  Point,
  Rect,
} from "./types";
export { DEFAULT_PARAMS, type Desempate, type Params } from "./params";
export { ID_ATRAS, ID_CERRAR, ID_DESHACER, ID_OCULTAR_TECLADO, validateScreen } from "./validate";
export {
  anguloDesde,
  anguloParaMano,
  distancia,
  normalizarAngulo,
  puntoEnDireccion,
  reflejarAngulo,
} from "./geometry";
export {
  assignActions,
  computeAnchorPosition,
  computeFanLayout,
  layoutParaPantalla,
  orderActions,
  pantallaDeCapa,
  radioAdaptativo,
  type CapaAncla,
  type FanLayout,
  type FanSlot,
  type OrderedAction,
  type Slot,
} from "./layout";
export { resolveSelection, type Seleccion } from "./selection";
export { proximoPlazo } from "./machine/deadline";
export {
  crearGeometria,
  ESTADOS_TRANSITORIOS,
  REPOSO,
  type AnchorEvent,
  type AnchorState,
  type CancelReason,
  type Geometry,
  type Apuntado,
  type ModoDesplazar,
  type ModoEjecucion,
  type Presion,
  type Tecla,
  type TipoEstado,
} from "./machine/states";
export { mismoApuntado, transition } from "./machine/transition";
export { agrupar, pasoCentrado, pasosApuntar, resolverApuntado, zoomParaSeparar, type ObjetivoEnPantalla, type Resultado as ResultadoApuntar } from "./apuntar";
export { createAnchorMachine, type Listener, type Machine } from "./machine/machine";
export { derivarMetricas, type MetricEvent } from "./metrics";
export {
  marcarMano,
  necesitaPreguntarMano,
  BIENVENIDA_INICIAL,
  leerBienvenida,
  marcarDemostracion,
  mostrarEtiqueta,
  necesitaDemostracion,
  registrarUso,
  serializarBienvenida,
  type EstadoBienvenida,
} from "./welcome";
export {
  etiquetaOpcion,
  PISTA_BIENVENIDA,
  posicionBanda,
  radioDe,
  textoBanda,
  type PosicionBanda,
  type TextoBanda,
} from "./banda";
export {
  indicadorDesplazamiento,
  indicadorJoystick,
  posicionGuiaArriba,
  velocidadDesplazamiento,
  velocidadJoystick,
  type IndicadorDesplazamiento,
  type IndicadorJoystick,
} from "./desplazamiento";
export {
  alturaDeY,
  colocacionLibre,
  colocacionPara,
  huellaAncla,
  imanColocacion,
  orientacionDe,
  posicionesValidas,
  prefsDesdeMano,
  rangoAlturas,
  resolverColocacion,
  xDelLado,
  yDeAltura,
  type Colocacion,
  type ColocacionResuelta,
  type Direccion,
  type Entorno,
  type Intervalo,
  type Lado,
  type Orientacion,
  type PrefsAncla,
  type Zona,
} from "./espacio";
