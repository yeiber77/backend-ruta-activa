# Desplegar RutaActiva API en Render

## 1. Subir el código a GitHub

El servicio debe apuntar a la carpeta **`backend-ruta-activa-main`** (o al repo que la contenga).

## 2. Crear el Web Service en Render

1. Entra en [render.com](https://render.com) → **New** → **Web Service**.
2. Conecta tu repositorio de GitHub.
3. Configuración:

| Campo | Valor |
|--------|--------|
| **Name** | `rutaactiva-api` (o el que prefieras) |
| **Root Directory** | `backend-ruta-activa-main` *(si el repo es la carpeta padre `todo`)* |
| **Runtime** | Node |
| **Build Command** | `npm install` |
| **Start Command** | `npm start` |
| **Plan** | Free *(se duerme tras inactividad; primera petición puede tardar ~1 min)* |

4. **Health Check Path:** `/api/health`

Alternativa: **New** → **Blueprint** y selecciona el repo si incluye `render.yaml`.

## 3. Variables de entorno (Environment)

Copia los valores desde tu `.env` local y desde el panel de Supabase.

| Variable | Obligatoria | Dónde obtenerla |
|----------|-------------|-----------------|
| `NODE_ENV` | Sí | `production` |
| `SUPABASE_URL` | Sí | Supabase → Project Settings → API |
| `SUPABASE_ANON_KEY` | Sí | Misma pantalla (anon public) |
| `SUPABASE_SERVICE_ROLE_KEY` | Sí | service_role *(secreto, solo backend)* |
| `SUPABASE_JWT_SECRET` | Sí | JWT Secret en API settings |
| `GEMINI_API_KEY` | Para IA | [Google AI Studio](https://aistudio.google.com/apikey) |
| `PASSWORD_RESET_REDIRECT_URL` | Sí | `rutaactivamobile://nueva-contrasena` |

Opcionales (roles, si en tu BD no son 1–6):

- `ROLE_ADMIN_ID`, `ROLE_COORDINADOR_ID`, `ROLE_CHOFER_ID`, etc.

Render define automáticamente:

- `PORT` — no la cambies
- `RENDER_EXTERNAL_URL` — URL pública del servicio (ej. `https://rutaactiva-api.onrender.com`)

## 4. Supabase (producción)

En **Authentication → URL Configuration → Redirect URLs**, añade:

```text
rutaactivamobile://nueva-contrasena
```

(Site URL puede seguir siendo la de Supabase; lo importante es el redirect de recuperación.)

## 5. Probar el despliegue

Cuando el deploy esté **Live**:

```bash
curl https://TU-SERVICIO.onrender.com/api/health
```

Respuesta esperada: `{"ok":true,"mensaje":"RutaActiva API activa",...}`

Swagger: `https://TU-SERVICIO.onrender.com/api-ruta-activa`

## 6. App móvil (Expo)

En `ruta-activa-arduino-master/.env`:

```env
EXPO_PUBLIC_API_URL=https://TU-SERVICIO.onrender.com
```

Reinicia Metro: `npx expo start -c`

**Nota:** La app debe usar **HTTPS** hacia Render (no hace falta `adb reverse` en producción).

## 7. Plan Free — qué esperar

- Tras ~15 min sin tráfico el servicio **se duerme**.
- La primera petición tras dormir puede tardar **30–60 s**.
- Para uso real con choferes en ruta, valora el plan **Starter** (~7 USD/mes) para evitar el sleep.

## 8. Errores frecuentes

| Síntoma | Solución |
|---------|----------|
| Build falla | Revisa **Root Directory** = `backend-ruta-activa-main` |
| 502 / timeout al despertar | Normal en free; reintenta o sube de plan |
| Login 401 / JWT | Revisa `SUPABASE_JWT_SECRET` y claves anon/service |
| IA no responde | Añade `GEMINI_API_KEY` en Render y redeploy |
