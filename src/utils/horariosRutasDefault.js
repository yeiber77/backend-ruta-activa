const HORARIOS_RUTAS_DEFAULT = [
  {
    id: 'lunes',
    dia_label: 'Lunes',
    zonas: [
      'Casco central avenida',
      'Cuchilla colinas',
      'La esmeralda',
      'Barrio nazareno',
      'La malaguera',
    ],
    nota: null,
    orden: 1,
  },
  {
    id: 'martes',
    dia_label: 'Martes',
    zonas: [
      'Monte bello',
      'Estación Santa Ana',
      'Palmar Ramireño',
      'Carrizal',
      'INAVI Centenario',
      'CDI',
    ],
    nota: null,
    orden: 2,
  },
  {
    id: 'miercoles',
    dia_label: 'Miércoles',
    zonas: [
      'Quebradita',
      'Buena vista',
      'Don José',
      'Teo Camargo',
      'Andrés Eloy',
      'Cafetal',
      'Timoteo Chacón',
      'Campín',
      'Golondrinas',
      'Sucre',
      'Santa Teresa',
    ],
    nota: null,
    orden: 3,
  },
  {
    id: 'jueves',
    dia_label: 'Jueves',
    zonas: [
      'San Joaquín',
      'Ceibones',
      'Milagros',
      'Malacate',
      'La malaguera',
      'Barrio nazareno',
      'Mercedes',
      'Libertador',
    ],
    nota: null,
    orden: 4,
  },
  {
    id: 'viernes',
    dia_label: 'Viernes',
    zonas: ['Casco central', 'Avenida completa', 'Carrizal', 'Centenario', 'INAVI', 'CDI'],
    nota: null,
    orden: 5,
  },
  {
    id: 'sabado',
    dia_label: 'Sábado',
    zonas: [],
    nota: 'Rutas rotativas por turno. Incluyen C.P.O. o cualquiera que se requiera.',
    orden: 6,
  },
];

const DIA_IDS = new Set(HORARIOS_RUTAS_DEFAULT.map((d) => d.id));

function rowToHorario(row) {
  const zonas = Array.isArray(row.zonas) ? row.zonas.filter(Boolean) : [];
  return {
    id: row.id,
    dia: row.dia_label,
    zonas,
    ...(row.nota?.trim() ? { nota: row.nota.trim() } : {}),
    actualizado_en: row.actualizado_en,
  };
}

function parseZonasInput(value) {
  if (Array.isArray(value)) {
    return value.map((z) => String(z).trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[\n,;]+/)
      .map((z) => z.trim())
      .filter(Boolean);
  }
  return [];
}

module.exports = {
  HORARIOS_RUTAS_DEFAULT,
  DIA_IDS,
  rowToHorario,
  parseZonasInput,
};
