const {
  diaAnterior,
  estaAbiertoAhora,
  momentoActualBogota,
} = require('../../src/services/disponibilidad.service');

describe('diaAnterior', () => {
  it('el día anterior a lunes es domingo (wraparound, no un índice negativo)', () => {
    expect(diaAnterior('lunes')).toBe('domingo');
  });

  it('el día anterior a domingo es sabado', () => {
    expect(diaAnterior('domingo')).toBe('sabado');
  });

  it('el día anterior a martes es lunes', () => {
    expect(diaAnterior('martes')).toBe('lunes');
  });
});

describe('estaAbiertoAhora', () => {
  it('caso normal: dentro del rango de hoy → abierto', () => {
    const horarios = [
      { dia: 'lunes', hora_apertura: '08:00', hora_cierre: '18:00', cerrado: false },
    ];
    expect(estaAbiertoAhora({ hoyDb: 'lunes', horaActual: '12:00', horarios })).toBe(true);
  });

  it('caso normal: fuera del rango de hoy → cerrado', () => {
    const horarios = [
      { dia: 'lunes', hora_apertura: '08:00', hora_cierre: '18:00', cerrado: false },
    ];
    expect(estaAbiertoAhora({ hoyDb: 'lunes', horaActual: '20:00', horarios })).toBe(false);
  });

  it('sin ninguna fila de horario → cerrado (no "siempre abierto" por defecto)', () => {
    expect(estaAbiertoAhora({ hoyDb: 'lunes', horaActual: '12:00', horarios: [] })).toBe(false);
  });

  it('marcado cerrado=true ese día → cerrado, aunque hora_apertura/cierre digan lo contrario', () => {
    const horarios = [
      { dia: 'lunes', hora_apertura: '08:00', hora_cierre: '18:00', cerrado: true },
    ];
    expect(estaAbiertoAhora({ hoyDb: 'lunes', horaActual: '12:00', horarios })).toBe(false);
  });

  it('nocturno que cruza medianoche, consultado antes de medianoche (mismo día del turno) → abierto', () => {
    const horarios = [
      { dia: 'viernes', hora_apertura: '18:00', hora_cierre: '02:00', cerrado: false },
    ];
    expect(estaAbiertoAhora({ hoyDb: 'viernes', horaActual: '23:00', horarios })).toBe(true);
  });

  it('nocturno que cruza medianoche, consultado después de medianoche (día siguiente, vía la fila de ayer) → abierto', () => {
    const horarios = [
      { dia: 'viernes', hora_apertura: '18:00', hora_cierre: '02:00', cerrado: false },
    ];
    expect(estaAbiertoAhora({ hoyDb: 'sabado', horaActual: '01:00', horarios })).toBe(true);
  });

  it('nocturno que cruza medianoche, consultado bien pasado el cierre del día siguiente → cerrado', () => {
    const horarios = [
      { dia: 'viernes', hora_apertura: '18:00', hora_cierre: '02:00', cerrado: false },
    ];
    expect(estaAbiertoAhora({ hoyDb: 'sabado', horaActual: '10:00', horarios })).toBe(false);
  });

  // Regresión: la fórmula ingenua "ahora >= apertura O ahora <= cierre"
  // aplicada completa contra una sola fila (la de "hoy") daba un falso
  // positivo aquí — ver el comentario en disponibilidad.service.js.
  it('regresión: negocio cerrado el jueves, turno nocturno SOLO el viernes (18:00-02:00), consultado el viernes a las 01:00 → cerrado', () => {
    const horarios = [
      // sin fila para jueves, equivalente a "cerrado ese día"
      { dia: 'viernes', hora_apertura: '18:00', hora_cierre: '02:00', cerrado: false },
    ];

    const resultado = estaAbiertoAhora({ hoyDb: 'viernes', horaActual: '01:00', horarios });

    expect(resultado).toBe(false);
  });

  it('mismo horario, consultado el sábado a las 01:00 (ahora sí es "ayer" el viernes nocturno) → abierto', () => {
    const horarios = [
      { dia: 'viernes', hora_apertura: '18:00', hora_cierre: '02:00', cerrado: false },
    ];
    expect(estaAbiertoAhora({ hoyDb: 'sabado', horaActual: '01:00', horarios })).toBe(true);
  });

  it('jueves explícitamente cerrado=true + viernes nocturno, consultado el viernes a las 01:00 → cerrado', () => {
    const horarios = [
      { dia: 'jueves', hora_apertura: null, hora_cierre: null, cerrado: true },
      { dia: 'viernes', hora_apertura: '18:00', hora_cierre: '02:00', cerrado: false },
    ];
    expect(estaAbiertoAhora({ hoyDb: 'viernes', horaActual: '01:00', horarios })).toBe(false);
  });
});

describe('momentoActualBogota', () => {
  it('convierte un instante UTC a día/hora de Bogotá (UTC-5, sin horario de verano)', () => {
    expect(momentoActualBogota(new Date('2026-09-08T14:30:00.000Z'))).toEqual({
      hoyDb: 'martes',
      horaActual: '09:30',
    });
  });

  it('cruza correctamente la medianoche al convertir de UTC a Bogotá (cambia el día)', () => {
    // 2026-09-09T03:30Z y 05:30Z son el mismo día UTC pero caen en días
    // distintos de Bogotá (UTC-5): 22:30 del martes y 00:30 del miércoles.
    expect(momentoActualBogota(new Date('2026-09-09T03:30:00.000Z'))).toEqual({
      hoyDb: 'martes',
      horaActual: '22:30',
    });
    expect(momentoActualBogota(new Date('2026-09-09T05:30:00.000Z'))).toEqual({
      hoyDb: 'miercoles',
      horaActual: '00:30',
    });
  });

  it('medianoche exacta en Bogotá da "00:00", no "24:00"', () => {
    expect(momentoActualBogota(new Date('2026-09-08T05:00:00.000Z')).horaActual).toBe('00:00');
  });
});
