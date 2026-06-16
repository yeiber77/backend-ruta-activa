const { supabaseAdmin } = require('../config/supabase');

const choferRoleId = Number(process.env.ROLE_CHOFER_ID || process.env.ROL_CHOFER_ID || 3);
const supervisorRoleId = Number(process.env.ROLE_SUPERVISOR_ID || process.env.ROL_SUPERVISOR_ID || 4);
const obreroRoleId = Number(process.env.ROLE_OBRERO_ID || process.env.ROL_OBRERO_ID || 6);

const ASISTENCIA_ROL_IDS = [choferRoleId, supervisorRoleId, obreroRoleId];

const ROL_ORDEN_ASISTENCIA = {
  [choferRoleId]: 0,
  [supervisorRoleId]: 1,
  [obreroRoleId]: 2,
};

const SQL_ASISTENCIA = 'backend-ruta-activa-main/sql/asistencia_trabajadores.sql';

const FECHA_RE = /^\d{4}-\d{2}-\d{2}$/;

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return typeof value === 'string' && UUID_RE.test(value);
}

function errorTablaAsistenciaFaltante(error) {
  if (!error) return false;
  const msg = String(error.message || error.details || error.hint || '').toLowerCase();
  return (
    msg.includes('asistencia_trabajadores') &&
    (msg.includes('could not find the table') ||
      msg.includes('schema cache') ||
      msg.includes('does not exist'))
  );
}

function parseFechaISO(fecha) {
  if (typeof fecha !== 'string' || !FECHA_RE.test(fecha.trim())) {
    return null;
  }
  const value = fecha.trim();
  const d = new Date(`${value}T12:00:00.000Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value) {
    return null;
  }
  return value;
}

function parseTimestampISO(value) {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value !== 'string' || !value.trim()) {
    return { ok: false, mensaje: 'entrada_en y salida_en deben ser string ISO o null' };
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) {
    return { ok: false, mensaje: 'entrada_en o salida_en no es una fecha ISO válida' };
  }
  return { ok: true, value: d.toISOString() };
}

function ordenarTrabajadores(rows) {
  return [...(rows || [])].sort((a, b) => {
    const oa = ROL_ORDEN_ASISTENCIA[Number(a.rol_id)] ?? 99;
    const ob = ROL_ORDEN_ASISTENCIA[Number(b.rol_id)] ?? 99;
    if (oa !== ob) return oa - ob;
    return String(a.nombre || '').localeCompare(String(b.nombre || ''), 'es', { sensitivity: 'base' });
  });
}

async function fetchTrabajadoresAsistencia() {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id, nombre, email, telefono, rol_id')
    .in('rol_id', ASISTENCIA_ROL_IDS);

  if (error) {
    throw error;
  }

  return ordenarTrabajadores(data || []);
}

async function fetchRegistrosPorFecha(fecha) {
  const { data, error } = await supabaseAdmin
    .from('asistencia_trabajadores')
    .select('*')
    .eq('fecha', fecha)
    .order('id', { ascending: true });

  if (error) {
    throw error;
  }

  return data || [];
}

async function fetchAsistenciaDiaria(fecha) {
  let trabajadores;
  try {
    trabajadores = await fetchTrabajadoresAsistencia();
  } catch (error) {
    return {
      ok: false,
      status: 400,
      mensaje: 'No se pudo listar trabajadores para asistencia',
      detalle: error.message,
    };
  }

  let registros;
  try {
    registros = await fetchRegistrosPorFecha(fecha);
  } catch (error) {
    if (errorTablaAsistenciaFaltante(error)) {
      return {
        ok: true,
        fecha,
        trabajadores,
        registros: [],
        aviso: `Falta crear la tabla en Supabase. Ejecuta: ${SQL_ASISTENCIA}`,
      };
    }
    return {
      ok: false,
      status: 400,
      mensaje: 'No se pudo listar registros de asistencia',
      detalle: error.message,
    };
  }

  return {
    ok: true,
    fecha,
    trabajadores,
    registros,
  };
}

async function validarTrabajadorAsistencia(trabajadorId) {
  const { data, error } = await supabaseAdmin
    .from('usuarios')
    .select('id, nombre, email, telefono, rol_id')
    .eq('id', trabajadorId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 400,
      mensaje: 'No se pudo validar el trabajador',
      detalle: error.message,
    };
  }

  if (!data) {
    return { ok: false, status: 404, mensaje: 'Trabajador no encontrado' };
  }

  if (!ASISTENCIA_ROL_IDS.includes(Number(data.rol_id))) {
    return {
      ok: false,
      status: 400,
      mensaje: 'El usuario no es un trabajador habilitado para asistencia (chofer, supervisor u obrero)',
    };
  }

  return { ok: true, trabajador: data };
}

function validarPayloadAsistencia(body) {
  const fecha = parseFechaISO(body?.fecha);
  if (!fecha) {
    return { ok: false, status: 400, mensaje: 'fecha es obligatoria y debe tener formato YYYY-MM-DD' };
  }

  const trabajadorId = body?.trabajador_id;
  if (!isUuid(trabajadorId)) {
    return { ok: false, status: 400, mensaje: 'trabajador_id debe ser un UUID válido' };
  }

  if (typeof body?.entrada !== 'boolean') {
    return { ok: false, status: 400, mensaje: 'entrada es obligatoria y debe ser boolean' };
  }

  if (typeof body?.salida !== 'boolean') {
    return { ok: false, status: 400, mensaje: 'salida es obligatoria y debe ser boolean' };
  }

  let entradaEn = null;
  if (body.entrada) {
    if (body.entrada_en === undefined || body.entrada_en === null) {
      entradaEn = new Date().toISOString();
    } else {
      const parsed = parseTimestampISO(body.entrada_en);
      if (!parsed.ok) {
        return { ok: false, status: 400, mensaje: parsed.mensaje };
      }
      entradaEn = parsed.value;
    }
  } else if (body.entrada_en != null) {
    return {
      ok: false,
      status: 400,
      mensaje: 'Si entrada es false, entrada_en debe ser null',
    };
  }

  let salidaEn = null;
  if (body.salida) {
    if (body.salida_en === undefined || body.salida_en === null) {
      salidaEn = new Date().toISOString();
    } else {
      const parsed = parseTimestampISO(body.salida_en);
      if (!parsed.ok) {
        return { ok: false, status: 400, mensaje: parsed.mensaje };
      }
      salidaEn = parsed.value;
    }
  } else if (body.salida_en != null) {
    return {
      ok: false,
      status: 400,
      mensaje: 'Si salida es false, salida_en debe ser null',
    };
  }

  let detalles = null;
  if (body.detalles !== undefined && body.detalles !== null) {
    if (typeof body.detalles !== 'string') {
      return { ok: false, status: 400, mensaje: 'detalles debe ser string o null' };
    }
    const trimmed = body.detalles.trim();
    detalles = trimmed.length ? trimmed : null;
  }

  return {
    ok: true,
    payload: {
      fecha,
      trabajador_id: trabajadorId,
      entrada: body.entrada,
      salida: body.salida,
      entrada_en: entradaEn,
      salida_en: salidaEn,
      detalles,
    },
  };
}

async function upsertRegistroAsistencia(payload, registradoPorId) {
  const { data: existente, error: readErr } = await supabaseAdmin
    .from('asistencia_trabajadores')
    .select('id')
    .eq('trabajador_id', payload.trabajador_id)
    .eq('fecha', payload.fecha)
    .maybeSingle();

  if (readErr) {
    if (errorTablaAsistenciaFaltante(readErr)) {
      return {
        ok: false,
        status: 503,
        mensaje: 'Asistencia no disponible hasta ejecutar el SQL en Supabase',
        detalle: SQL_ASISTENCIA,
      };
    }
    return {
      ok: false,
      status: 400,
      mensaje: 'No se pudo comprobar registros existentes',
      detalle: readErr.message,
    };
  }

  const row = {
    ...payload,
    registrado_por: registradoPorId,
  };

  const { data, error } = await supabaseAdmin
    .from('asistencia_trabajadores')
    .upsert(row, { onConflict: 'trabajador_id,fecha' })
    .select('*')
    .maybeSingle();

  if (error) {
    if (errorTablaAsistenciaFaltante(error)) {
      return {
        ok: false,
        status: 503,
        mensaje: 'Asistencia no disponible hasta ejecutar el SQL en Supabase',
        detalle: SQL_ASISTENCIA,
      };
    }
    return {
      ok: false,
      status: 400,
      mensaje: 'No se pudo guardar la asistencia',
      detalle: error.message,
    };
  }

  return {
    ok: true,
    registro: data,
    esCreacion: !existente,
  };
}

module.exports = {
  SQL_ASISTENCIA,
  ASISTENCIA_ROL_IDS,
  errorTablaAsistenciaFaltante,
  parseFechaISO,
  fetchAsistenciaDiaria,
  validarTrabajadorAsistencia,
  validarPayloadAsistencia,
  upsertRegistroAsistencia,
};
