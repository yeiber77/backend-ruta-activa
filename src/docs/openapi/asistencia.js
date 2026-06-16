/** OpenAPI: asistencia diaria de trabajadores (coordinador) */
module.exports = {
  '/api/coordinador/asistencia': {
    get: {
      tags: ['Coordinador'],
      summary: 'Lista trabajadores y registros de asistencia por fecha',
      description:
        'GET /api/coordinador/asistencia?fecha=YYYY-MM-DD. Trabajadores con rol chofer, supervisor u obrero.',
      security: [{ bearerAuth: [] }],
      parameters: [
        {
          name: 'fecha',
          in: 'query',
          required: true,
          schema: { type: 'string', format: 'date', example: '2026-06-14' },
        },
      ],
      responses: {
        200: { description: 'Trabajadores y registros del día' },
        400: { description: 'fecha inválida o error de consulta' },
        401: { description: 'Sin token o token inválido' },
        403: { description: 'No es coordinador' },
      },
    },
    patch: {
      tags: ['Coordinador'],
      summary: 'Registra o actualiza asistencia de un trabajador',
      description: 'UPSERT por (trabajador_id, fecha). Solo coordinador.',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['fecha', 'trabajador_id', 'entrada', 'salida'],
              properties: {
                fecha: { type: 'string', format: 'date', example: '2026-06-14' },
                trabajador_id: { type: 'string', format: 'uuid' },
                entrada: { type: 'boolean' },
                salida: { type: 'boolean' },
                entrada_en: { type: 'string', format: 'date-time', nullable: true },
                salida_en: { type: 'string', format: 'date-time', nullable: true },
                detalles: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Registro guardado' },
        400: { description: 'Validación o error de Supabase' },
        404: { description: 'Trabajador no encontrado' },
        503: { description: 'Tabla asistencia_trabajadores no configurada' },
      },
    },
    put: {
      tags: ['Coordinador'],
      summary: 'Alias de PATCH para guardar asistencia',
      security: [{ bearerAuth: [] }],
      requestBody: {
        required: true,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              required: ['fecha', 'trabajador_id', 'entrada', 'salida'],
              properties: {
                fecha: { type: 'string', format: 'date' },
                trabajador_id: { type: 'string', format: 'uuid' },
                entrada: { type: 'boolean' },
                salida: { type: 'boolean' },
                entrada_en: { type: 'string', format: 'date-time', nullable: true },
                salida_en: { type: 'string', format: 'date-time', nullable: true },
                detalles: { type: 'string', nullable: true },
              },
            },
          },
        },
      },
      responses: {
        200: { description: 'Registro guardado' },
      },
    },
  },
};
