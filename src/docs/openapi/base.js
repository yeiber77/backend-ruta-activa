module.exports = {
  "openapi": "3.0.0",
  "info": {
    "title": "RutaActiva API",
    "version": "1.0.0",
    "description": "Documentacion de la API del backend RutaActiva"
  },
  "servers": [
    {
      "url": "http://localhost:3000"
    }
  ],
  "tags": [
    {
      "name": "Health",
      "description": "Endpoints de verificacion del sistema"
    },
    {
      "name": "Auth",
      "description": "Registro y autenticacion de usuarios"
    },
    {
      "name": "Admin",
      "description": "Gestion de usuarios como administrador: GET/POST/PATCH bajo /api/admin/usuarios (JWT de rol Administrador)"
    },
    {
      "name": "Rutas",
      "description": "Tabla public.rutas: admin, coordinador, chofer (solo Pendiente/En Proceso en PATCH), supervisor (lectura de todas)"
    },
    {
      "name": "Chofer",
      "description": "Rol Chofer: /api/chofer — PATCH de estado sin Completada (solo supervisor completa la ruta)"
    },
    {
      "name": "Supervisor",
      "description": "Rol Supervisor: /api/supervisor — rutas (lectura) y verificaciones"
    },
    {
      "name": "Coordinador",
      "description": "Endpoints del rol Coordinador bajo /api/coordinador (JWT de coordinador)"
    },
    {
      "name": "Representante",
      "description": "Endpoints del rol Representante bajo /api/representante (lectura de rutas asignadas y sobre-confirmacion)"
    },
    {
      "name": "Verificaciones",
      "description": "Tabla public.verificaciones: /api/admin/verificaciones (admin) y /api/supervisor/verificaciones (supervisor)"
    }
  ],
  "components": {
    "securitySchemes": {
      "adminAuth": {
        "type": "http",
        "scheme": "basic",
        "description": "Credenciales admin (usuario y contraseña admin)"
      },
      "bearerAuth": {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Token de acceso de POST /api/auth/login (campo access_token). En Swagger usa el boton Authorize y pega solo el JWT, sin escribir Bearer."
      }
    }
  }
};
