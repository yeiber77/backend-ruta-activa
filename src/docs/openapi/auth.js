module.exports = {
  "/api/auth/register": {
    "post": {
      "tags": [
        "Auth"
      ],
      "summary": "Registra un usuario en Supabase Auth y crea su perfil en usuarios",
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "email",
                "password",
                "nombre"
              ],
              "properties": {
                "email": {
                  "type": "string",
                  "format": "email",
                  "example": "usuario@correo.com"
                },
                "password": {
                  "type": "string",
                  "minLength": 6,
                  "example": "123456"
                },
                "nombre": {
                  "type": "string",
                  "example": "name"
                },
                "telefono": {
                  "type": "string",
                  "example": "123456789"
                },
                "rol_id": {
                  "type": "integer",
                  "example": 3
                }
              }
            }
          }
        }
      },
      "responses": {
        "201": {
          "description": "Usuario y perfil creados correctamente",
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
                    "example": "Usuario registrado correctamente"
                  },
                  "user_id": {
                    "type": "string",
                    "format": "uuid"
                  },
                  "requiere_confirmacion": {
                    "type": "boolean",
                    "example": false
                  }
                }
              }
            }
          }
        },
        "202": {
          "description": "Usuario creado, pendiente perfil por confirmacion de correo"
        },
        "400": {
          "description": "Error de validacion o registro"
        }
      }
    }
  },
  "/api/auth/login": {
    "post": {
      "tags": [
        "Auth"
      ],
      "summary": "Inicia sesion con email y password",
      "requestBody": {
        "required": true,
        "content": {
          "application/json": {
            "schema": {
              "type": "object",
              "required": [
                "email",
                "password"
              ],
              "properties": {
                "email": {
                  "type": "string",
                  "format": "email",
                  "example": "usuario@correo.com"
                },
                "password": {
                  "type": "string",
                  "example": "12345678"
                }
              }
            }
          }
        }
      },
      "responses": {
        "200": {
          "description": "Login exitoso",
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
                    "example": "Login correcto"
                  },
                  "access_token": {
                    "type": "string"
                  },
                  "refresh_token": {
                    "type": "string"
                  },
                  "expires_in": {
                    "type": "integer",
                    "example": 3600
                  },
                  "token_type": {
                    "type": "string",
                    "example": "bearer"
                  },
                  "user": {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "string",
                        "format": "uuid"
                      },
                      "email": {
                        "type": "string",
                        "format": "email"
                      }
                    }
                  },
                  "perfil": {
                    "nullable": true,
                    "oneOf": [
                      {
                        "type": "null"
                      },
                      {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "string",
                            "format": "uuid"
                          },
                          "nombre": {
                            "type": "string"
                          },
                          "email": {
                            "type": "string",
                            "format": "email"
                          },
                          "telefono": {
                            "type": "string",
                            "nullable": true
                          },
                          "rol_id": {
                            "type": "integer",
                            "nullable": true
                          }
                        }
                      }
                    ]
                  }
                }
              }
            }
          }
        },
        "400": {
          "description": "Faltan datos obligatorios"
        },
        "401": {
          "description": "Credenciales invalidas"
        }
      }
    }
  },
  "/api/auth/profile": {
    "get": {
      "tags": [
        "Auth"
      ],
      "summary": "Perfil de un usuario",
      "description": "Autenticate como admin y envia ?user_id",
      "security": [
        {
          "adminAuth": []
        }
      ],
      "parameters": [
        {
          "name": "user_id",
          "in": "query",
          "required": true,
          "schema": {
            "type": "string",
            "format": "uuid"
          },
          "description": "UUID del usuario (mismo id que en Auth y en public.usuarios)."
        }
      ],
      "responses": {
        "200": {
          "description": "Consulta admin correcta",
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
                    "example": "Consulta admin"
                  },
                  "user": {
                    "type": "object",
                    "properties": {
                      "id": {
                        "type": "string",
                        "format": "uuid"
                      },
                      "email": {
                        "type": "string",
                        "format": "email"
                      }
                    }
                  },
                  "perfil": {
                    "nullable": true,
                    "oneOf": [
                      {
                        "type": "null"
                      },
                      {
                        "type": "object",
                        "properties": {
                          "id": {
                            "type": "string",
                            "format": "uuid"
                          },
                          "nombre": {
                            "type": "string"
                          },
                          "email": {
                            "type": "string",
                            "format": "email"
                          },
                          "telefono": {
                            "type": "string",
                            "nullable": true
                          },
                          "rol_id": {
                            "type": "integer",
                            "nullable": true
                          }
                        }
                      }
                    ]
                  }
                }
              }
            }
          }
        },
        "400": {
          "description": "Admin sin user_id en query"
        },
        "401": {
          "description": "Sin autenticacion o credenciales invalidas"
        },
        "404": {
          "description": "Usuario Auth no encontrado (modo admin)"
        },
        "503": {
          "description": "Falta service role en servidor (modo admin)"
        }
      }
    }
  },
  "/api/auth/users/{user_id}": {
    "delete": {
      "tags": [
        "Auth"
      ],
      "summary": "Elimina un usuario de public.usuarios (no borra en Authentication)",
      "description": "El solicitante debe ser administrador o coordinador (segun su fila en public.usuarios). Si el usuario a eliminar tiene rol_id de administrador (1) o coordinador (2), solo un administrador puede borrarlo; con otros roles, administrador o coordinador pueden borrarlo. Usa Authorize en Swagger (bearerAuth) con el access_token del login.",
      "security": [
        {
          "bearerAuth": []
        }
      ],
      "parameters": [
        {
          "name": "user_id",
          "in": "path",
          "required": true,
          "schema": {
            "type": "string",
            "format": "uuid"
          },
          "description": "UUID del usuario a eliminar en public.usuarios."
        }
      ],
      "responses": {
        "200": {
          "description": "Usuario eliminado de public.usuarios"
        },
        "401": {
          "description": "Token faltante, invalido o expirado"
        },
        "403": {
          "description": "Rol no autorizado, o coordinador intentando eliminar administrador/coordinador"
        },
        "404": {
          "description": "Usuario no encontrado en public.usuarios"
        },
        "503": {
          "description": "Falta SUPABASE_SERVICE_ROLE_KEY en backend"
        }
      }
    }
  }
};
