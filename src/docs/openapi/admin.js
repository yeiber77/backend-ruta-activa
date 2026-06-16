/** OpenAPI: gestion de usuarios admin bajo /api/admin/usuarios */
module.exports = {
  "/api/admin/usuarios": {
    "get": {
      "tags": ["Admin"],
      "summary": "Lista usuarios (perfil en public.usuarios)",
      "description": "Requiere JWT de un usuario con rol Administrador.",
      "security": [{ "bearerAuth": [] }],
      "parameters": [
        {
          "name": "limit",
          "in": "query",
          "schema": { "type": "integer", "default": 100, "maximum": 500 }
        },
        {
          "name": "offset",
          "in": "query",
          "schema": { "type": "integer", "default": 0 }
        }
      ],
      "responses": {
        "200": { "description": "Lista de usuarios" },
        "401": { "description": "Sin token o token invalido" },
        "403": { "description": "No es administrador" },
        "503": { "description": "Falta service role en servidor" }
      }
    },
    "post": {
      "tags": ["Admin"],
      "summary": "Crea usuario en Auth y en public.usuarios",
      "security": [{ "bearerAuth": [] }],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": ["email", "password", "nombre"],
              "properties": {
                "email": { "type": "string", "format": "email" },
                "password": { "type": "string" },
                "nombre": { "type": "string" },
                "telefono": { "type": "string", "nullable": true },
                "rol_id": { "type": "integer", "nullable": true }
              }
            }
          }
        }
      },
      "responses": {
        "201": { "description": "Usuario creado" },
        "400": { "description": "Validacion o error de Supabase" },
        "401": { "description": "Sin token o token invalido" },
        "403": { "description": "No es administrador" }
      }
    }
  },
  "/api/admin/usuarios/{userId}": {
    "get": {
      "tags": ["Admin"],
      "summary": "Detalle de usuario (Auth + perfil)",
      "security": [{ "bearerAuth": [] }],
      "parameters": [
        {
          "name": "userId",
          "in": "path",
          "required": true,
          "schema": { "type": "string", "format": "uuid" }
        }
      ],
      "responses": {
        "200": { "description": "Usuario y perfil" },
        "400": { "description": "UUID invalido" },
        "404": { "description": "No existe en Auth" }
      }
    },
    "patch": {
      "tags": ["Admin"],
      "summary": "Actualiza perfil y/o credenciales en Auth",
      "description": "Si envias email o password, se actualiza Supabase Auth y el email en public.usuarios cuando aplica.",
      "security": [{ "bearerAuth": [] }],
      "parameters": [
        {
          "name": "userId",
          "in": "path",
          "required": true,
          "schema": { "type": "string", "format": "uuid" }
        }
      ],
      "requestBody": {
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "nombre": { "type": "string" },
                "telefono": { "type": "string", "nullable": true },
                "rol_id": { "type": "integer", "nullable": true },
                "email": { "type": "string", "format": "email" },
                "password": { "type": "string" }
              }
            }
          }
        }
      },
      "responses": {
        "200": { "description": "Actualizado" },
        "400": { "description": "Nada que actualizar o error" },
        "404": { "description": "Sin fila en usuarios" }
      }
    }
  },
  '/api/admin/asistencia': {
    get: {
      tags: ['Admin'],
      summary: 'Lista trabajadores y registros de asistencia por fecha (solo lectura)',
      description:
        'GET /api/admin/asistencia?fecha=YYYY-MM-DD. Misma respuesta que coordinador GET; sin escritura en v1.',
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
        403: { description: 'No es administrador' },
      },
    },
  },
};
