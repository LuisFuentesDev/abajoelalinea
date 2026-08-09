// Lista pública de programas grabados (embeds de YouTube) — mismo patrón
// que supabase-articles.js: fetch directo a la REST API, sin SDK.
const SUPABASE_URL = 'https://rogafinwshzgornhrxap.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NfKcVml8rLAlf050xgJq3g_rq557P6h';
const SITE = 'abajolalinea';
const CACHE_KEY = `programs:${SITE}`;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 min, mismo criterio que supabase-articles.js

function youtubeId(url) {
  const m = String(url || '').match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

function readCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, savedAt } = JSON.parse(raw);
    return { data, isFresh: Date.now() - savedAt < CACHE_TTL_MS };
  } catch {
    return null;
  }
}

function writeCache(data) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, savedAt: Date.now() }));
  } catch {
    // localStorage lleno o bloqueado (modo privado) — no es crítico.
  }
}

async function fetchProgramsFresh() {
  const params = new URLSearchParams({
    select: 'id,title,description,youtube_url,category,published_at',
    site: `eq.${SITE}`,
    status: 'eq.published',
    order: 'published_at.desc',
  });
  const res = await fetch(`${SUPABASE_URL}/rest/v1/programs?${params}`, {
    headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
  });
  if (!res.ok) return [];
  return res.json();
}

// Stale-while-revalidate: devuelve lo cacheado al instante (si hay) y llama a
// onFresh cuando llega la respuesta real, para actualizar sin bloquear el
// primer render.
async function fetchPrograms(onFresh) {
  const cached = readCache();
  const freshPromise = fetchProgramsFresh().then((data) => {
    writeCache(data);
    onFresh?.(data);
    return data;
  });
  return cached ? cached.data : freshPromise;
}

function programRowHtml(program) {
  const id = youtubeId(program.youtube_url);
  if (!id) return '';
  const date = program.published_at
    ? new Date(program.published_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  return `
    <div class="program-row">
      <div class="program-row-video">
        <iframe
          src="https://www.youtube.com/embed/${id}"
          title="${program.title}"
          loading="lazy"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowfullscreen
        ></iframe>
      </div>
      <div class="program-row-info">
        <h3>${program.title}</h3>
        ${program.description ? `<p>${program.description}</p>` : ''}
        ${date ? `<span class="mono">${date}</span>` : ''}
      </div>
    </div>`;
}

// Agrupa por programa (categoría) y ordena cada sección por la publicación
// más reciente de ese programa, para que el show más activo salga primero.
function groupByProgram(programs) {
  const groups = new Map();
  for (const p of programs) {
    const key = p.category || 'Otros';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(p);
  }
  return [...groups.entries()].sort(
    ([, a], [, b]) => new Date(b[0].published_at) - new Date(a[0].published_at)
  );
}

function sectionHtml(name, programs, { withHeader = true } = {}) {
  return `
    ${withHeader ? `<div class="section-subhead" style="margin-top:56px;"><span class="prog-tag" style="margin:0;">${name}</span></div>` : ''}
    <div class="program-rows" style="margin-top:${withHeader ? '24' : '0'}px;">
      ${programs.map(programRowHtml).join('')}
    </div>`;
}

// /programas/casetafemenina — sin tildes/espacios/guiones, para que la URL
// se vea limpia (ej. "Caseta Femenina" -> "casetafemenina").
function slugifyCategory(name) {
  return String(name || '')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]/g, '');
}

function categoryFromPath(groups) {
  const match = location.pathname.match(/^\/programas\/([^/]+)\/?$/);
  if (!match) return 'Todos';
  const slug = decodeURIComponent(match[1]);
  const found = groups.find(([name]) => slugifyCategory(name) === slug);
  return found ? found[0] : 'Todos';
}

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('programVideos');
  const filters = document.getElementById('programFilters');
  if (!container) return;

  let groups = [];
  let active; // undefined hasta el primer setup(): recién ahí se lee la URL

  function render() {
    if (filters) {
      filters.innerHTML = ['Todos', ...groups.map(([name]) => name)]
        .map((name) => `<button type="button" class="admin-pill ${name === active ? 'active' : ''}" data-cat="${name}">${name}</button>`)
        .join('');
      filters.querySelectorAll('[data-cat]').forEach((btn) => {
        btn.addEventListener('click', () => {
          active = btn.dataset.cat;
          const path = active === 'Todos' ? '/programas' : `/programas/${slugifyCategory(active)}`;
          history.pushState(null, '', path);
          render();
        });
      });
    }

    if (!groups.length) {
      container.innerHTML = '<p style="color:var(--cream-dim);">Todavía no hay programas subidos.</p>';
      return;
    }

    container.innerHTML = active === 'Todos'
      ? groups.map(([name, items]) => sectionHtml(name, items)).join('')
      : sectionHtml(active, groups.find(([name]) => name === active)?.[1] ?? [], { withHeader: false });
  }

  // Se llama al instante con lo cacheado (si hay) y de nuevo cuando llega
  // la respuesta fresca de Supabase, sin perder el filtro activo.
  function setup(programs) {
    groups = groupByProgram(programs);
    if (active === undefined || (active !== 'Todos' && !groups.some(([n]) => n === active))) {
      active = categoryFromPath(groups);
    }
    render();
  }

  window.addEventListener('popstate', () => {
    active = categoryFromPath(groups);
    render();
  });

  setup(await fetchPrograms(setup));
});
