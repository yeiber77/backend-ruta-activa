/** Personal de campo (información operativa del municipio). */

function emailFromNombre(nombre) {
  const base = nombre
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '.')
    .replace(/^\.+|\.+$/g, '');
  return `${base || 'usuario'}@rutaactiva.local`;
}

const CHOFERES_OPERATIVOS = [
  { nombre: 'Jean Carlos Lozano', email: 'jean.lozano@rutaactiva.local', tipo: 'chofer' },
  { nombre: 'Ernesto Peñaloza', email: 'ernesto.penaloza@rutaactiva.local', tipo: 'chofer' },
];

const OBREROS_OPERATIVOS = [
  'Darvin Díaz',
  'Arístides Peña',
  'Cristhofer Delgado',
  'Omaña Rey',
  'Leonardo Barrios',
  'Javier Escalante',
  'Yowaldo Gómez',
  'Kleiber Rivera',
  'Wilmer Nieto',
  'Julio Gutiérrez',
].map((nombre) => ({
  nombre,
  email: emailFromNombre(nombre),
  tipo: 'obrero',
}));

const EQUIPO_OPERATIVO = [...CHOFERES_OPERATIVOS, ...OBREROS_OPERATIVOS];

module.exports = {
  emailFromNombre,
  CHOFERES_OPERATIVOS,
  OBREROS_OPERATIVOS,
  EQUIPO_OPERATIVO,
};
