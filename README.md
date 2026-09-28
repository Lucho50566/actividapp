# 📚 Actividapp

Convertí **capturas de actividades de un libro** en **ejercicios interactivos** que
resolvés en la app, y guardá tu trabajo terminado en **PDF**. Instalable (PWA),
minimalista y con modo claro/oscuro.

Sacás una foto/captura de una consigna (completar, opción múltiple, verdadero/falso,
unir con flechas, respuesta abierta) → una IA de visión la interpreta → la app arma
la interfaz para resolverla → exportás el resultado en PDF.

## ✨ Qué hace
- Subir o **sacar foto** de la actividad.
- **Interpretación con IA** → detecta el tipo de ejercicio y arma la interfaz:
  - ✏️ Completar huecos
  - 🔘 Opción múltiple (una o varias)
  - ✅ Verdadero / Falso
  - 🔗 **Unir con flechas** (líneas SVG interactivas)
  - 📝 Respuesta abierta
- **Autoguardado** local (IndexedDB) — tus actividades y respuestas quedan en tu dispositivo.
- **🧠 Corregir con IA**: revisa tus respuestas y da **retroalimentación por ejercicio**
  (correcto / casi / para revisar / sin responder) + un puntaje y un comentario general.
- **🔤 Banco de palabras inteligente**: las palabras que ya escribiste en tus respuestas se
  **tachan solas** (y podés tacharlas/desmarcar a mano tocándolas).
- **Export a PDF** del trabajo resuelto (y **compartir el PDF** por WhatsApp/Drive con el
  compartir nativo del celular).
- PWA instalable, offline para revisar/completar/exportar lo ya interpretado.

## 🧠 La IA de visión
Interpretar la *estructura* de un ejercicio (no solo el texto) requiere un modelo
multimodal. Actividapp es **provider-agnóstico**:

| Proveedor | Variable | Notas |
|---|---|---|
| **Gemini** (default) | `GEMINI_API_KEY` | Tiene capa gratuita → [conseguir key](https://aistudio.google.com/app/apikey) |
| Anthropic (Claude) | `ANTHROPIC_API_KEY` | Excelente calidad de visión |
| OpenAI | `OPENAI_API_KEY` | `gpt-4o-mini` |

Sin key configurada, la app corre en **modo demo** (carga una actividad de ejemplo),
así podés probar toda la interfaz. La imagen se envía a la IA **solo** en el momento
de interpretar; después todo es local.

## 🖥️ Abrir como app en Windows (recomendado)

Pensado para usar en la PC como si fuera una aplicación:

1. **Primera vez:** doble clic en `Instalar.bat` (instala y compila).
2. Doble clic en `Crear acceso directo.bat` → crea **Actividapp** en el Escritorio.
3. Listo: doble clic en el acceso directo del Escritorio y se abre en una
   **ventana propia** (sin barra del navegador). El servidor arranca solo, oculto.

Para cerrar el servidor por completo: `Detener Actividapp.bat`.

> El acceso directo usa Microsoft Edge (o Chrome) en modo `--app`. La app se
> abre en `http://127.0.0.1:3100`.

## 📱 Pasar la app a un teléfono (o instalarla)

En la app, tocá el botón del **teléfono** (arriba a la derecha) → se abre una hoja con:

- **Instalar app**: en Android/Chrome aparece el botón directo (ícono en la pantalla de
  inicio, pantalla completa y funciona sin conexión). En iPhone se muestran los pasos
  (Safari → Compartir → *Añadir a pantalla de inicio*).
- **QR + link**: para que otra persona la abra en su teléfono (y la instale igual).
- **Compartir enlace**: usa el compartir nativo del celular (WhatsApp, etc.).

### Demo pública (link para compartir)

Doble clic en **`Compartir demo (tunel).bat`**: levanta el servidor y abre un túnel de
Cloudflare que imprime un link tipo `https://algo-aleatorio.trycloudflare.com`.
Ese es el link para mandar. Funciona **mientras esta PC esté encendida** y la ventana abierta,
y **cambia** cada vez que lo abrís.

> Para un **link fijo 24/7** sin depender de tu PC, ver **“Publicar 24/7 (hosting)”** más abajo.

### ¿Y una app para descargar (APK)?

La forma "de fábrica" sin tiendas es la **PWA** (lo de arriba): se instala con un toque y
queda como app real. Un **APK** de Android también se puede generar con **Bubblewrap/TWA**,
pero el APK queda **atado a una URL fija** (si el link cambia, deja de funcionar). Por eso
primero hay que tener el link estable. Decime y lo armamos.

## 🚀 Uso manual (multiplataforma)

Requiere **Node ≥ 20**.

```bash
npm install
# configurá la key:
cp .env.example server/.env    # y completá GEMINI_API_KEY
npm run build
npm start                      # abre en http://<tu-ip>:3100 (muestra QR)
```

Desarrollo: `npm run dev` (web en :5273, API en :3100).

## 🌐 Publicar 24/7 (hosting, sin tu PC)

El server es un proceso Node (Fastify) + PWA estática, así que va en cualquier hosting de
Node o Docker. Ya quedó lista la config para **Render** (`render.yaml` + `Dockerfile`).

**Opción A — Render (recomendado, un clic):**
1. Subí el proyecto a un repo de **GitHub** (o usá el botón *Deploy from a Git repository*).
2. En [render.com](https://render.com) → **New → Blueprint** → elegí el repo (detecta `render.yaml`).
3. Listo: te da una URL fija tipo `https://actividapp.onrender.com`.
   - Plan **free**: se duerme a los ~15 min sin uso y despierta en ~30 s.
   - Plan **starter** (~USD 7/mes): siempre activo, 24/7 real.

**Opción B — Fly.io (Docker, siempre activo):**
```bash
fly launch --no-deploy      # detecta el Dockerfile
fly deploy
```

**Opción C — cualquier VPS / Docker:**
```bash
docker build -t actividapp .
docker run -d -p 3000:3000 --name actividapp --restart always actividapp
```

> En el hosting **no se configura ninguna API key**: la app arranca en **modo demo** y
> cada usuario carga la suya desde **Configuración → IA** (queda en *su* navegador).

## 📁 Estructura
```
actividapp/
├── shared/   Esquema de Actividad (Zod), compartido front/back
├── server/   Fastify: proxy a la IA (protege la key) + sirve la PWA + IP/QR
└── web/      PWA React + Vite + Tailwind
```

## 🔑 Login / vender la app
Podés exigir **inicio de sesión** y habilitar el acceso solo a quien te pagó (con
**Supabase**). Se inicia sesión **una sola vez** (queda la sesión guardada) y si revocás
un acceso, la app se **bloquea sola**. Paso a paso + SQL en **[SUPABASE.md](SUPABASE.md)**.
Sin configurar Supabase, la app corre **sin login** (modo abierto).

## 🔐 Privacidad
Cada usuario usa **su propia API key**, guardada **solo en su navegador** y enviada en cada
pedido; el servidor **no almacena ninguna key**. Tus actividades y respuestas se guardan
localmente en el navegador; no se suben a ningún lado (solo la imagen va al proveedor de IA
en el momento de interpretar).

## 🗺️ Próximos pasos
- Editar/corregir bloques mal detectados.
- Guardar también la imagen original dentro del PDF.
- Más tipos: ordenar, tabla, arrastrar y soltar.
- Carpetas / materias y búsqueda.