// Next (y cualquier empaquetador) reemplaza process.env.NODE_ENV al compilar.
// Se declara solo esto para no traer todos los tipos de Node al adaptador.
declare const process: { env: { NODE_ENV?: string } };
