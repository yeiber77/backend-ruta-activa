/** OpenAPI: otros endpoints /api/coordinador (no rutas) */
module.exports = {
  "/api/coordinador/choferes": {
    "get": {
      "tags": ["Coordinador"],
      "summary": "Lista usuarios con rol Chofer",
      "description": "GET /api/coordinador/choferes. Para asignar chofer_id al crear o editar rutas.",
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
        "200": { "description": "Lista de choferes" }
      }
    }
  }
};
