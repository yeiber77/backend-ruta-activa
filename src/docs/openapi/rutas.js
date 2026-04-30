/** OpenAPI: public.rutas — /api/admin/rutas (admin) y /api/coordinador/rutas (coordinador) */
module.exports = {
  "/api/admin/rutas": {
    "get": {
      "tags": ["Rutas"],
      "summary": "Lista rutas",
      "description": "GET /api/admin/rutas. Requiere JWT de administrador.",
      "security": [{ "bearerAuth": [] }],
      "parameters": [
        {
          "name": "limit",
          "in": "query",
          "schema": { "type": "integer", "default": 200, "maximum": 500 }
        },
        {
          "name": "offset",
          "in": "query",
          "schema": { "type": "integer", "default": 0 }
        }
      ],
      "responses": {
        "200": { "description": "Lista de rutas" }
      }
    }
  },
  "/api/admin/rutas/{rutaId}": {
    "get": {
      "tags": ["Rutas"],
      "summary": "Obtiene una ruta por id",
      "description": "GET /api/admin/rutas/{rutaId}. Requiere JWT de administrador.",
      "security": [{ "bearerAuth": [] }],
      "parameters": [
        {
          "name": "rutaId",
          "in": "path",
          "required": true,
          "schema": { "type": "integer" }
        }
      ],
      "responses": {
        "200": { "description": "Ruta" },
        "404": { "description": "No encontrada" }
      }
    },
    "patch": {
      "tags": ["Rutas"],
      "summary": "Actualiza campos de una ruta",
      "description": "PATCH /api/admin/rutas/{rutaId}. Campos permitidos: comunidad_nombre, chofer_id, coordinador_id, estado, finalizado_en. Requiere JWT de administrador.",
      "security": [{ "bearerAuth": [] }],
      "parameters": [
        {
          "name": "rutaId",
          "in": "path",
          "required": true,
          "schema": { "type": "integer" }
        }
      ],
      "requestBody": {
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "comunidad_nombre": { "type": "string" },
                "chofer_id": { "type": "string", "format": "uuid", "nullable": true },
                "representante_id": { "type": "string", "format": "uuid", "nullable": true },
                "coordinador_id": { "type": "string", "format": "uuid", "nullable": true },
                "estado": { "type": "string" },
                "finalizado_en": { "type": "string", "format": "date-time", "nullable": true }
              }
            }
          }
        }
      },
      "responses": {
        "200": { "description": "Ruta actualizada" },
        "400": { "description": "Sin campos validos" },
        "404": { "description": "No encontrada" }
      }
    },
    "delete": {
      "tags": ["Rutas"],
      "summary": "Elimina una ruta",
      "description": "DELETE /api/admin/rutas/{rutaId}. Requiere JWT de administrador.",
      "security": [{ "bearerAuth": [] }],
      "parameters": [
        {
          "name": "rutaId",
          "in": "path",
          "required": true,
          "schema": { "type": "integer" }
        }
      ],
      "responses": {
        "200": { "description": "Eliminada" },
        "404": { "description": "No encontrada" }
      }
    }
  },
  "/api/coordinador/rutas/reportes": {
    "get": {
      "tags": ["Rutas"],
      "summary": "Reporte de rutas del coordinador",
      "description": "Resumen, conteos por estado, rutas sin chofer y ultimas rutas. Solo rutas con tu coordinador_id.",
      "security": [{ "bearerAuth": [] }],
      "responses": {
        "200": { "description": "Resumen y listas" },
        "403": { "description": "No es coordinador" }
      }
    }
  },
  "/api/coordinador/rutas": {
    "get": {
      "tags": ["Rutas"],
      "summary": "Lista tus rutas",
      "description": "GET /api/coordinador/rutas. Filtro opcional estado (se normaliza).",
      "security": [{ "bearerAuth": [] }],
      "parameters": [
        {
          "name": "limit",
          "in": "query",
          "schema": { "type": "integer", "default": 200, "maximum": 500 }
        },
        {
          "name": "offset",
          "in": "query",
          "schema": { "type": "integer", "default": 0 }
        },
        {
          "name": "estado",
          "in": "query",
          "required": false,
          "schema": { "type": "string" },
          "description": "Filtra por estado (ej. Pendiente, En Proceso)"
        }
      ],
      "responses": {
        "200": { "description": "Lista de rutas del coordinador" }
      }
    },
    "post": {
      "tags": ["Rutas"],
      "summary": "Crea una ruta",
      "description": "Insert en public.rutas con coordinador_id del token, estado por defecto Pendiente.",
      "security": [{ "bearerAuth": [] }],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": ["comunidad_nombre"],
              "properties": {
                "comunidad_nombre": { "type": "string" },
                "chofer_id": { "type": "string", "format": "uuid", "nullable": true },
                "representante_id": { "type": "string", "format": "uuid", "nullable": true },
                "estado": {
                  "type": "string",
                  "description": "Opcional; por defecto Pendiente (normalizado)"
                }
              }
            }
          }
        }
      },
      "responses": {
        "201": { "description": "Ruta creada" },
        "400": { "description": "Validacion o chofer invalido" }
      }
    }
  },
  "/api/coordinador/rutas/{rutaId}": {
    "get": {
      "tags": ["Rutas"],
      "summary": "Obtiene una de tus rutas",
      "security": [{ "bearerAuth": [] }],
      "parameters": [
        {
          "name": "rutaId",
          "in": "path",
          "required": true,
          "schema": { "type": "integer" }
        }
      ],
      "responses": {
        "200": { "description": "Ruta" },
        "404": { "description": "No encontrada o no es tuya" }
      }
    },
    "patch": {
      "tags": ["Rutas"],
      "summary": "Actualiza una de tus rutas",
      "description": "Campos: comunidad_nombre, chofer_id, estado, finalizado_en. coordinador_id no se modifica aqui.",
      "security": [{ "bearerAuth": [] }],
      "parameters": [
        {
          "name": "rutaId",
          "in": "path",
          "required": true,
          "schema": { "type": "integer" }
        }
      ],
      "requestBody": {
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "comunidad_nombre": { "type": "string" },
                "chofer_id": { "type": "string", "format": "uuid", "nullable": true },
                "representante_id": { "type": "string", "format": "uuid", "nullable": true },
                "estado": { "type": "string" },
                "finalizado_en": { "type": "string", "format": "date-time", "nullable": true }
              }
            }
          }
        }
      },
      "responses": {
        "200": { "description": "Ruta actualizada" },
        "400": { "description": "Sin campos validos" },
        "404": { "description": "No encontrada o no es tuya" }
      }
    },
    "delete": {
      "tags": ["Rutas"],
      "summary": "Elimina una de tus rutas",
      "security": [{ "bearerAuth": [] }],
      "parameters": [
        {
          "name": "rutaId",
          "in": "path",
          "required": true,
          "schema": { "type": "integer" }
        }
      ],
      "responses": {
        "200": { "description": "Eliminada" },
        "404": { "description": "No encontrada o no es tuya" }
      }
    }
  },
  "/api/chofer/rutas/reportes": {
    "get": {
      "tags": ["Chofer"],
      "summary": "Reporte de rutas asignadas al chofer",
      "description": "Resumen, por_estado, rutas sin coordinador y ultimas rutas. Solo rutas con tu chofer_id.",
      "security": [{ "bearerAuth": [] }],
      "responses": {
        "200": { "description": "Resumen y listas" },
        "403": { "description": "No es chofer" }
      }
    }
  },
  "/api/chofer/rutas": {
    "get": {
      "tags": ["Chofer"],
      "summary": "Lista rutas asignadas al chofer",
      "description": "GET /api/chofer/rutas. Filtro opcional estado (Pendiente, En Proceso, Completada).",
      "security": [{ "bearerAuth": [] }],
      "parameters": [
        {
          "name": "limit",
          "in": "query",
          "schema": { "type": "integer", "default": 200, "maximum": 500 }
        },
        {
          "name": "offset",
          "in": "query",
          "schema": { "type": "integer", "default": 0 }
        },
        {
          "name": "estado",
          "in": "query",
          "required": false,
          "schema": { "type": "string" },
          "description": "Filtra por estado; debe normalizar a Pendiente, En Proceso o Completada"
        }
      ],
      "responses": {
        "200": { "description": "Lista de rutas" },
        "400": { "description": "Filtro estado invalido" }
      }
    }
  },
  "/api/chofer/rutas/{rutaId}": {
    "get": {
      "tags": ["Chofer"],
      "summary": "Detalle de una ruta asignada",
      "security": [{ "bearerAuth": [] }],
      "parameters": [
        {
          "name": "rutaId",
          "in": "path",
          "required": true,
          "schema": { "type": "integer" }
        }
      ],
      "responses": {
        "200": { "description": "Ruta" },
        "404": { "description": "No encontrada o no asignada" }
      }
    },
    "patch": {
      "tags": ["Chofer"],
      "summary": "Actualiza solo el estado de la ruta",
      "description": "Body solo { \"estado\": \"...\" }. El chofer solo puede Pendiente o En Proceso; Completada la fija el supervisor.",
      "security": [{ "bearerAuth": [] }],
      "parameters": [
        {
          "name": "rutaId",
          "in": "path",
          "required": true,
          "schema": { "type": "integer" }
        }
      ],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": ["estado"],
              "properties": {
                "estado": {
                  "type": "string",
                  "description": "Se normaliza; permitido: Pendiente o En Proceso"
                }
              }
            }
          }
        }
      },
      "responses": {
        "200": { "description": "Estado actualizado" },
        "400": { "description": "Cuerpo invalido o estado no permitido" },
        "403": { "description": "Intento de poner Completada" },
        "404": { "description": "No encontrada o no asignada" }
      }
    }
  },
  "/api/supervisor/rutas": {
    "get": {
      "tags": ["Supervisor"],
      "summary": "Lista todas las rutas",
      "security": [{ "bearerAuth": [] }],
      "parameters": [
        {
          "name": "limit",
          "in": "query",
          "schema": { "type": "integer", "default": 200, "maximum": 500 }
        },
        {
          "name": "offset",
          "in": "query",
          "schema": { "type": "integer", "default": 0 }
        }
      ],
      "responses": {
        "200": { "description": "Lista de rutas" }
      }
    }
  },
  "/api/supervisor/rutas/{rutaId}": {
    "get": {
      "tags": ["Supervisor"],
      "summary": "Detalle de una ruta",
      "security": [{ "bearerAuth": [] }],
      "parameters": [
        {
          "name": "rutaId",
          "in": "path",
          "required": true,
          "schema": { "type": "integer" }
        }
      ],
      "responses": {
        "200": { "description": "Ruta" },
        "404": { "description": "No encontrada" }
      }
    }
  }
};
