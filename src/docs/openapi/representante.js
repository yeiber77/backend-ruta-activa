/** OpenAPI: endpoints del rol representante y gestion admin de sobre-confirmacion */
module.exports = {
  "/api/representante/reportes": {
    "get": {
      "tags": ["Representante"],
      "summary": "Reporte del representante",
      "description": "Metricas sobre rutas asignadas al representante autenticado y sus sobre-confirmaciones.",
      "security": [{ "bearerAuth": [] }],
      "responses": {
        "200": { "description": "Metricas y ultimas confirmaciones" },
        "403": { "description": "No es representante" }
      }
    }
  },
  "/api/representante/rutas": {
    "get": {
      "tags": ["Representante"],
      "summary": "Lista rutas asignadas al representante",
      "description": "Incluye la verificacion asociada por ruta cuando exista.",
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
          "schema": { "type": "string" }
        }
      ],
      "responses": {
        "200": { "description": "Lista de rutas asignadas" }
      }
    }
  },
  "/api/representante/rutas/{rutaId}/confirmacion": {
    "post": {
      "tags": ["Representante"],
      "summary": "Registra sobre-confirmacion del representante",
      "description": "Solo despues de la confirmacion principal del supervisor. Si no existe fila en verificaciones, la crea.",
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
        "required": false,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "comentario_representante": {
                  "type": "string",
                  "nullable": true
                }
              }
            }
          }
        }
      },
      "responses": {
        "200": { "description": "Confirmacion registrada" },
        "400": { "description": "Validacion de estado o datos" },
        "404": { "description": "Ruta no encontrada o no asignada" },
        "409": { "description": "Ya confirmada por representante" }
      }
    }
  },
  "/api/admin/verificaciones/{verificacionId}/representante": {
    "patch": {
      "tags": ["Verificaciones"],
      "summary": "Admin edita campos de sobre-confirmacion del representante",
      "security": [{ "bearerAuth": [] }],
      "parameters": [
        {
          "name": "verificacionId",
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
              "properties": {
                "comentario_representante": { "type": "string", "nullable": true },
                "confirmado_representante": { "type": "boolean", "nullable": true }
              }
            }
          }
        }
      },
      "responses": {
        "200": { "description": "Sobre-confirmacion actualizada" }
      }
    },
    "delete": {
      "tags": ["Verificaciones"],
      "summary": "Admin limpia la sobre-confirmacion del representante",
      "security": [{ "bearerAuth": [] }],
      "parameters": [
        {
          "name": "verificacionId",
          "in": "path",
          "required": true,
          "schema": { "type": "integer" }
        }
      ],
      "responses": {
        "200": { "description": "Sobre-confirmacion eliminada" },
        "404": { "description": "Verificacion no encontrada" }
      }
    }
  }
};
