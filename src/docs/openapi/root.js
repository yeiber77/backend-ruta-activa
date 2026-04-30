module.exports = {
  "/": {
    "get": {
      "tags": [
        "Health"
      ],
      "summary": "Verifica que el servidor Express esta activo",
      "responses": {
        "200": {
          "description": "Servidor en marcha",
          "content": {
            "application/json": {
              "schema": {
                "type": "object",
                "properties": {
                  "mensaje": {
                    "type": "string",
                    "example": "RutaActiva API - servidor Express en marcha"
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
