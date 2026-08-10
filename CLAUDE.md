# CLAUDE.md — Abajo e' la Línea (abajoelalinea.cl)

## Qué es este proyecto

Sitio web de "Abajo e' la Línea", TV comunitaria de Temuco. **100% HTML/CSS/JS estático, sin build ni framework** — se edita directo y se pushea a GitHub, Vercel despliega solo.

## Stack

- HTML/CSS/JS planos, sin bundler ni build step.
- Reproductor en vivo: `hls.js` (CDN) apuntando a la URL de stream hardcodeada en `script.js`.
- Backend: **Supabase compartido con Winforma** (ver sección abajo). El sitio público consulta la REST API de Supabase con `fetch` directo (sin SDK), usando la anon/publishable key — mismo patrón en todos los `*.js` de fetch. El panel `/admin` sí usa `@supabase/supabase-js` (vía `esm.sh`, un `<script type="module">`, sin build) porque necesita sesión de usuario para las policies RLS de escritura.
- Deploy: Vercel, proyecto `abajoelalinea`, dominio `abajoelalinea.cl`. `vercel.json` con `cleanUrls: true` y un rewrite para `/programas/:category`.

## Estructura de archivos

| Archivo | Qué hace |
|---|---|
| `index.html` | Home: hero + video en vivo + "Quiénes somos" + "Cómo sintonizarnos" + teaser de Programas + Contacto |
| `cultura.html`, `deportes.html`, `comunidad.html` | Cada categoría, con bloque "Últimas publicaciones" (artículos reales desde Supabase vía `supabase-articles.js`) |
| `programas.html` | Videos de YouTube (tabla `programs`), agrupados por show, con pills de filtro y ruta `/programas/<categoria-sin-tildes>` (`programs.js`) |
| `articulo.html` | Detalle de un artículo por `?slug=` |
| `admin.html` + `admin.js` | Panel propio en `/admin`: login Supabase Auth + CRUD de artículos y de programas (dos tabs) |
| `supabase-articles.js` | Fetch público de `articles` (con cache 5 min en localStorage, stale-while-revalidate) |
| `programs.js` | Fetch público de `programs` (mismo patrón de cache), agrupación por show, filtro con URL |
| `theme.js` | Toggle claro/oscuro (persistido en localStorage) + menú hamburguesa mobile |
| `style.css` | Único stylesheet. Variables CSS para tema (`--ink`/`--cream`/`--line`, conmutables por `data-theme`) + variables `--fixed-*` para zonas que NO deben cambiar con el tema |

## Cómo correr el proyecto

No hay build. Para probar en local:
```bash
python3 -m http.server 8099
# abrir http://localhost:8099/index.html
```
El deploy real es automático al pushear a `main` (GitHub → Vercel).

## Backend compartido con Winforma

Mismo proyecto Supabase que usa `~/Desktop/winforma web/fresh-vibe-news-main` (ver el `CLAUDE.MD` de ese repo para el detalle completo del backend). En corto:

- Tablas `articles` y `programs` con columna `site` (`'winforma'` / `'abajolalinea'`) para separar el contenido.
- RLS de escritura acotada por `app_metadata.site` del usuario autenticado (**no** `user_metadata` — ese lo puede editar el propio usuario desde el navegador, sería un agujero de seguridad).
- Dos Edge Functions alimentan el contenido de este sitio por cron, sin intervención manual:
  - `instagram-sync` — trae posts de `@abajoelalinea.tv` (Instagram Graph API), los reescribe con OpenAI y los publica como artículo. Cada 30 min.
  - `youtube-sync` — trae videos nuevos de `@abajoelalineatv` (feed RSS de YouTube) y los publica como programa. Cada hora.
- El editor de este sitio es `abajoelalinea.tv@gmail.com` (Supabase Auth), con `app_metadata.site = "abajolalinea"`.

## Gotchas importantes

- **Rewrites en `vercel.json` + `cleanUrls`**: el destino de un rewrite nunca debe llevar `.html` — choca con la regla que redirige (308) cualquier `.html` a su versión limpia, y todo termina en 404. Destino siempre sin extensión (ej. `/programas`, no `/programas.html`).
- **Rutas con sub-path y assets relativos**: cualquier página que pueda cargar directo bajo una URL anidada (como `/programas/casetafemenina`) necesita que TODOS sus `<link>/<script>/<img>/<a>` usen rutas absolutas (`/style.css`, no `style.css`) — si no, se rompen los estilos y la navegación al refrescar ahí.
- `onAuthStateChange` de Supabase Auth dispara en más eventos que solo el login (ej. `TOKEN_REFRESHED` al volver a la pestaña) — el código de `admin.js` solo inicializa/resetea el dashboard una vez por sesión real, no en cada evento.

## Pendientes conocidos

- Caseta Femenina #12 no aparece en el canal de YouTube (puede no existir o estar oculto).
- Si el sync de Instagram deja de traer notas nuevas: revisar primero si el token venció (dura ~60 días, se autorenueva solo mientras el cron siga corriendo y la app de Meta no pierda autorización).
- No hay un endpoint tipo `api/publish.js` (como en Winforma) para publicar por token estático — la única vía de publicación manual es el panel `/admin`.
