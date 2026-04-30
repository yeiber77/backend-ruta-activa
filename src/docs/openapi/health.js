module.exports = {
  "/api/health/supabase": {
    "get": {
      "tags": [
        "Health"
      ],
      "summary": "Verifica conectividad basica con Supabase",
      "responses": {
        "200": {
          "description": "Conexion correcta con Supabase",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "ok": {
                    "type": "boolean",
                    "example": true
                  },
                  "mensaje": {
                    "type": "string",
                    "example": "Conexion con Supabase correcta"
                  },
                  "buckets": {
                    "type": "integer",
                    "example": 2
                  }
                }
              }
            }
          }
        },
        "500": {
          "description": "Error al intentar validar la conexion con Supabase",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "ok": {
                    "type": "boolean",
                    "example": false
                  },
                  "mensaje": {
                    "type": "string",
                    "example": "No se pudo verificar Supabase"
                  },
                  "detalle": {
                    "type": "string",
                    "example": "fetch failed"
                  }
                }
              }
            }
          }
        }
      }
    }
  }
};
