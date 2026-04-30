/** OpenAPI: endpoints de public.verificaciones bajo /api/admin/verificaciones */
module.exports = {
  "/api/admin/verificaciones": {
    "get": {
      "tags": ["Verificaciones"],
      "summary": "Lista verificaciones",
      "description": "GET /api/admin/verificaciones. Requiere JWT de administrador.",
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
        "200": { "description": "Lista" }
      }
    }
  },
  "/api/admin/verificaciones/{verificacionId}": {
    "get": {
      "tags": ["Verificaciones"],
      "summary": "Obtiene una verificacion por id",
      "description": "GET /api/admin/verificaciones/{verificacionId}. Requiere JWT de administrador.",
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
        "200": { "description": "Verificacion" },
        "404": { "description": "No encontrada" }
      }
    },
    "delete": {
      "tags": ["Verificaciones"],
      "summary": "Elimina una verificacion",
      "description": "DELETE /api/admin/verificaciones/{verificacionId}. Requiere JWT de administrador.",
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
        "200": { "description": "Eliminada" },
        "404": { "description": "No encontrada" }
      }
    }
  },
  "/api/supervisor/verificaciones/reportes": {
    "get": {
      "tags": ["Verificaciones"],
      "summary": "Reporte de verificaciones del supervisor",
      "description": "Resumen y ultimas verificaciones donde verificador_id es el usuario logueado.",
      "security": [{ "bearerAuth": [] }],
      "responses": {
        "200": { "description": "Resumen y ultimas" }
      }
    }
  },
  "/api/supervisor/verificaciones": {
    "get": {
      "tags": ["Verificaciones"],
      "summary": "Lista tus verificaciones",
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
          "name": "ruta_id",
          "in": "query",
          "schema": { "type": "integer" },
          "description": "Filtrar por ruta"
        }
      ],
      "responses": {
        "200": { "description": "Lista" }
      }
    },
    "post": {
      "tags": ["Verificaciones"],
      "summary": "Crea verificacion (una por ruta)",
      "description": "Si confirmado=true, la ruta debe estar En Proceso y pasa a Completada. comentario obligatorio (puede ser vacio).",
      "security": [{ "bearerAuth": [] }],
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": ["ruta_id", "confirmado", "comentario"],
              "properties": {
                "ruta_id": { "type": "integer" },
                "confirmado": { "type": "boolean" },
                "comentario": { "type": "string" }
              }
            }
          }
        }
      },
      "responses": {
        "201": { "description": "Creada" },
        "400": { "description": "Validacion" },
        "409": { "description": "Ya existe verificacion para esa ruta" }
      }
    }
  },
  "/api/supervisor/verificaciones/{verificacionId}": {
    "get": {
      "tags": ["Verificaciones"],
      "summary": "Detalle de una verificacion tuya",
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
        "200": { "description": "Verificacion" },
        "404": { "description": "No encontrada" }
      }
    },
    "patch": {
      "tags": ["Verificaciones"],
      "summary": "Actualiza confirmado y/o comentario",
      "description": "Al poner confirmado=true con ruta En Proceso, la ruta pasa a Completada.",
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
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "properties": {
                "confirmado": { "type": "boolean" },
                "comentario": { "type": "string" }
              }
            }
          }
        }
      },
      "responses": {
        "200": { "description": "Actualizada" },
        "400": { "description": "Validacion" },
        "404": { "description": "No encontrada" }
      }
    }
  }
};
