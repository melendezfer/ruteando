const { franjasSeSolapan, locationSlotsInputSchema } = require('../../src/validators/business.validators');

const base = { latitude: 4.6083, longitude: -74.2188 };
const franja = (day, startTime, endTime) => ({ ...base, day, startTime, endTime });

describe('franjasSeSolapan', () => {
  it('dos franjas del mismo día que se pisan se solapan', () => {
    expect(franjasSeSolapan(franja('monday', '08:00', '12:00'), franja('monday', '11:00', '14:00'))).toBe(true);
  });

  it('tocarse en el borde (12:00-12:00) no cuenta como solape', () => {
    expect(franjasSeSolapan(franja('monday', '08:00', '12:00'), franja('monday', '12:00', '14:00'))).toBe(false);
  });

  it('una franja nocturna del lunes pisa la madrugada del martes', () => {
    expect(franjasSeSolapan(franja('monday', '22:00', '02:00'), franja('tuesday', '01:00', '03:00'))).toBe(true);
    expect(franjasSeSolapan(franja('monday', '22:00', '02:00'), franja('tuesday', '02:00', '05:00'))).toBe(false);
  });

  it('la franja nocturna del domingo da la vuelta a la semana y pisa el lunes temprano', () => {
    expect(franjasSeSolapan(franja('sunday', '23:00', '01:00'), franja('monday', '00:30', '02:00'))).toBe(true);
  });

  it('mismo horario en días distintos no se solapa', () => {
    expect(franjasSeSolapan(franja('monday', '08:00', '12:00'), franja('tuesday', '08:00', '12:00'))).toBe(false);
  });
});

describe('locationSlotsInputSchema', () => {
  it('acepta franjas válidas sin solape (caso del tinto: mañana, mediodía, noche)', () => {
    const r = locationSlotsInputSchema.safeParse([
      franja('monday', '05:00', '09:00'),
      franja('monday', '12:00', '14:00'),
      franja('monday', '17:00', '20:00'),
    ]);
    expect(r.success).toBe(true);
  });

  it('rechaza franjas que se solapan', () => {
    expect(locationSlotsInputSchema.safeParse([franja('monday', '05:00', '09:00'), franja('monday', '08:00', '10:00')]).success).toBe(false);
  });

  it('rechaza inicio igual a fin, y coordenadas fuera de Cundinamarca', () => {
    expect(locationSlotsInputSchema.safeParse([franja('monday', '08:00', '08:00')]).success).toBe(false);
    expect(locationSlotsInputSchema.safeParse([{ ...franja('monday', '08:00', '09:00'), latitude: 10 }]).success).toBe(false);
  });
});

describe('LOCATION_SLOTS_MAX (5 por día)', () => {
  // Regresión: con el máximo anterior (21) un vendedor con 3 puntos
  // diarios todos los días (el caso que motivó la funcionalidad) no podía
  // agregar ni uno más.
  const semana = (horas) =>
    ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'].flatMap((day) =>
      horas.map(([s, e]) => franja(day, s, e)),
    );
  it('acepta 3 por día + uno más, y hasta 5 por día', () => {
    const tres = semana([['05:00', '09:00'], ['12:00', '14:00'], ['17:00', '20:00']]);
    expect(locationSlotsInputSchema.safeParse([...tres, franja('sunday', '21:00', '22:00')]).success).toBe(true);
    const cinco = semana([['05:00', '06:00'], ['07:00', '08:00'], ['09:00', '10:00'], ['11:00', '12:00'], ['13:00', '14:00']]);
    expect(cinco).toHaveLength(35);
    expect(locationSlotsInputSchema.safeParse(cinco).success).toBe(true);
    expect(locationSlotsInputSchema.safeParse([...cinco, franja('sunday', '21:00', '22:00')]).success).toBe(false);
  });
});
