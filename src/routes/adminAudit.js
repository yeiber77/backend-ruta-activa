const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { SQL_AUDIT, errorTablaAuditFaltante } = require('../utils/auditLog');

const router = express.Router();

function rolEtiqueta(rolId) {
  switch (Number(rolId)) {
    case Number(process.env.ROLE_ADMIN_ID || process.env.ROL_ADMIN_ID || 1):
      return 'Administrador';
    case Number(process.env.ROLE_COORDINADOR_ID || process.env.ROL_COORDINADOR_ID || 2):
      return 'Coordinador';
    case Number(process.env.ROLE_CHOFER_ID || process.env.ROL_CHOFER_ID || 3):
      return 'Chofer';
    case Number(process.env.ROLE_SUPERVISOR_ID || process.env.ROL_SUPERVISOR_ID || 4):
      return 'Supervisor';
    case Number(process.env.ROLE_REPRESENTANTE_ID || process.env.ROL_REPRESENTANTE_ID || 5):
      return 'Representante';
    case Number(process.env.ROLE_OBRERO_ID || process.env.ROL_OBRERO_ID || 6):
      return 'Obrero';
    default:
      return rolId != null ? `Rol ${rolId}` : 'Sin rol';
  }
}

router.get('/', async (req, res) => {
  const limit = Math.min(Number(req.query.limit) || 80, 200);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  const eventType = req.query.event_type ? String(req.query.event_type).trim() : null;
  const entityType = req.query.entity_type ? String(req.query.entity_type).trim() : null;
  const actorId = req.query.actor_id ? String(req.query.actor_id).trim() : null;
  const desde = req.query.desde ? String(req.query.desde).trim() : null;
  const hasta = req.query.hasta ? String(req.query.hasta).trim() : null;
  const q = req.query.q ? String(req.query.q).trim().toLowerCase() : null;

  let query = supabaseAdmin
    .from('audit_log')
    .select('*', { count: 'exact' })
    .order('creado_en', { ascending: false })
    .range(offset, offset + limit - 1);

  if (eventType) query = query.eq('event_type', eventType);
  if (entityType) query = query.eq('entity_type', entityType);
  if (actorId) query = query.eq('actor_id', actorId);
  if (desde) query = query.gte('creado_en', desde);
  if (hasta) query = query.lte('creado_en', hasta);

  const { data, error, count } = await query;

  if (error) {
    if (errorTablaAuditFaltante(error)) {
      return res.status(200).json({
        ok: true,
        eventos: [],
        total: 0,
        limit,
        offset,
        aviso: `Falta crear la tabla en Supabase. Ejecuta: ${SQL_AUDIT}`,
      });
    }
    return res.status(400).json({
      ok: false,
      mensaje: 'No se pudo listar el historial',
      detalle: error.message,
    });
  }

  let eventos = (data || []).map((row) => ({
    ...row,
    actor_rol_nombre: rolEtiqueta(row.actor_rol_id),
  }));

  if (q) {
    eventos = eventos.filter(
      (e) =>
        String(e.resumen || '').toLowerCase().includes(q) ||
        String(e.event_type || '').toLowerCase().includes(q) ||
        String(e.actor_nombre || '').toLowerCase().includes(q) ||
        String(e.actor_email || '').toLowerCase().includes(q)
    );
  }

  return res.status(200).json({
    ok: true,
    eventos,
    total: count ?? eventos.length,
    limit,
    offset,
  });
});

router.get('/tipos', (_req, res) => {
  return res.status(200).json({
    ok: true,
    tipos: [
      { id: 'auth.register', label: 'Registro de usuario' },
      { id: 'auth.login', label: 'Inicio de sesión' },
      { id: 'auth.user_deleted', label: 'Usuario eliminado' },
      { id: 'auth.password_changed', label: 'Contraseña cambiada' },
      { id: 'admin.user_created', label: 'Usuario creado (admin)' },
      { id: 'admin.user_updated', label: 'Usuario actualizado (admin)' },
      { id: 'admin.worker_created', label: 'Trabajador agregado' },
      { id: 'admin.worker_dismissed', label: 'Trabajador despedido' },
      { id: 'admin.worker_reintegrated', label: 'Trabajador reintegrado' },
      { id: 'ruta.created', label: 'Ruta creada' },
      { id: 'ruta.updated', label: 'Ruta actualizada' },
      { id: 'ruta.deleted', label: 'Ruta eliminada' },
      { id: 'ruta.estado_changed', label: 'Estado de ruta cambiado' },
      { id: 'verificacion.created', label: 'Verificación creada' },
      { id: 'verificacion.updated', label: 'Verificación actualizada' },
      { id: 'verificacion.deleted', label: 'Verificación eliminada' },
      { id: 'denuncia.created', label: 'Denuncia registrada' },
      { id: 'comentario.created', label: 'Comentario publicado' },
      { id: 'comentario.responded', label: 'Comentario respondido' },
      { id: 'comentario.deleted', label: 'Comentario eliminado' },
      { id: 'anuncio.published', label: 'Anuncio publicado' },
      { id: 'anuncio.retired', label: 'Anuncio retirado' },
      { id: 'horario.updated', label: 'Horario actualizado' },
      { id: 'asistencia.created', label: 'Asistencia registrada' },
      { id: 'asistencia.updated', label: 'Asistencia actualizada' },
      { id: 'ia.feedback_created', label: 'Retroalimentación IA' },
      { id: 'ia.feedback_updated', label: 'Retroalimentación IA editada' },
      { id: 'ia.consulta_created', label: 'Consulta IA' },
      { id: 'estado.broadcast_created', label: 'Aviso de estado (coordinador)' },
      { id: 'estado.broadcast_confirmed', label: 'Aviso confirmado (chofer)' },
      { id: 'estado.chofer_finalizado', label: 'Chofer marcó finalizado' },
    ],
  });
});

module.exports = router;
