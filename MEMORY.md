# MEMORY.md — Abajo e' la Línea

> Bitácora de decisiones y contexto de trabajo en este sitio. Complementa `CLAUDE.md`
> (qué es el proyecto) con el por qué de las decisiones y el estado actual de las cosas.

## Migración de sitio estático simple a sitio con backend

El sitio partió siendo 100% estático sin ningún dato dinámico (secciones con texto de relleno). Se conectó al backend compartido de Winforma (mismo Supabase) para traer noticias reales generadas desde Instagram (`@abajoelalinea.tv`, cuenta propia, separada de la de Winforma) y videos reales desde YouTube (`@abajoelalineatv`). Una vez que hubo contenido real, se sacaron todas las tarjetas de relleno.

## Decisiones de diseño

- El sitio se mantiene deliberadamente **sin build/bundler** — es rápido de editar y desplegar, y el volumen de páginas no justifica meter un framework.
- El panel admin (`/admin`) se construyó a mano (HTML/JS + `@supabase/supabase-js` vía CDN) en vez de reusar el dashboard React de Winforma, porque se quería identidad visual propia para este sitio.
- Modo claro/oscuro: variables CSS conmutables por `data-theme`, pero el video en vivo, el marco del reproductor, la tarjeta "Quiénes somos" y el bloque verde de redes se dejaron con colores **fijos** (no siguen el tema) porque su contraste depende de un fondo que nunca cambia (video siempre oscuro, tarjeta siempre clara, verde siempre verde).
- Programas (YouTube) se separó en su propia sección con filtro por programa (pills) y rutas "bonitas" (`/programas/casetafemenina`) en vez de solo un query param.

## Categorización de contenido

- **Noticias** (`articles.category`): Deportes / Cultura / Comunidad — distinto del set de Winforma (Regional/Nacional/Internacional/Deportes). El heurístico de keywords vive en `instagram-sync/index.ts` del repo de Winforma, sección `SITE_CATEGORY_KEYWORDS.abajolalinea`.
- **Programas** (`programs.category`): nombre del show si se detecta en el título (Caseta Femenina, Ágora, Cine Club, Desde el Pueblo) o Deportes/Cultura/Comunidad como fallback general. Heurístico en `youtube-sync/index.ts` (mismo repo de Winforma).

## Backfill inicial de contenido (agosto 2026)

Para no lanzar el sitio vacío se importó contenido histórico a mano:

- **Artículos**: se corrió el sync de Instagram manualmente varias veces seguidas hasta vaciar el backlog de posts elegibles.
- **Programas**: el feed RSS de YouTube solo da los últimos 15 videos del canal *completo* (mezclando todos los programas), así que se perdían episodios viejos de Caseta Femenina tapados por Ágora/Cine Club. Hubo que paginar el listado real de la pestaña "Videos" del canal (leyendo el HTML server-renderizado + pidiendo la siguiente página con el continuation token que usa YouTube internamente) para recuperar Caseta Femenina completo del #1 al #18 (falta el #12, que no existe/no aparece en el canal).
- Desde que se activó `youtube-sync` (cron cada hora) y se activó de verdad el cron de `instagram-sync`, esto ya no debería volver a hacer falta a mano.

## Bugs resueltos (para no repetir el diagnóstico si vuelven a aparecer)

- **404 en `/programas/<categoria>` al refrescar**: el rewrite de `vercel.json` apuntaba a `/programas.html`; con `cleanUrls:true` esa ruta con extensión se redirige (308) a la limpia, y el rewrite terminaba chocando contra esa redirección en vez de resolver a un archivo real. Fix: destino sin extensión (`/programas`).
- **Perdía estilos al refrescar en `/programas/<categoria>`**: las rutas relativas (`style.css`, `logo.png`, los links de la nav) resuelven relativo a la URL actual, no a la raíz — bajo un sub-path se rompen. Fix: todas las rutas de `programas.html` pasaron a absolutas (`/style.css`, etc.).
- **El dashboard (`/admin`) se resetaba al cambiar de pestaña del navegador**: `supabase.auth.onAuthStateChange` dispara también en `TOKEN_REFRESHED` (no solo al loguearse), y el código reseteaba todo el estado (tab activo, formulario) en cada evento. Fix: flag `dashboardInitialized`, el dashboard solo se inicializa una vez por sesión real.
- **RLS insegura**: las policies de `articles`/`programs` comparaban contra `user_metadata.site`, que el propio usuario puede editar desde el cliente — un editor podía en teoría auto-otorgarse acceso al sitio del otro. Fix: usar `app_metadata.site` (solo editable con la service role key, nunca desde el navegador).
- **Instagram no se sincronizaba solo**: el cron nunca se activó de verdad — el archivo `schedule_instagram_sync.sql` quedó con placeholders (`TU_PROJECT_URL`/`TU_SERVICE_ROLE_KEY`) sin completar nunca a mano en el SQL editor de Supabase. Se activó con los valores reales vía migración.

## Pendiente / a revisar si algo falla

- **Token de Instagram**: se autorenueva solo mientras el cron siga corriendo y la app de Meta no pierda autorización. Si el sync deja de traer notas nuevas, revisar eso primero (regenerar desde Meta for Developers si hace falta).
- **Caseta Femenina #12**: no existe en el canal de YouTube, no es un bug de nuestro lado.
- No hay un endpoint de publicación manual por token estático (como `api/publish.js` en Winforma) — la única vía es el panel `/admin`.
