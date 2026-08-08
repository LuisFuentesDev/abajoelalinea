// Lista pública de programas grabados (embeds de YouTube) — mismo patrón
// que supabase-articles.js: fetch directo a la REST API, sin SDK.
const SUPABASE_URL = 'https://rogafinwshzgornhrxap.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NfKcVml8rLAlf050xgJq3g_rq557P6h';
const SITE = 'abajolalinea';

function youtubeId(url) {
  const m = String(url || '').match(
    /(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([A-Za-z0-9_-]{11})/
  );
  return m ? m[1] : null;
}

async function fetchPrograms() {
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

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('programVideos');
  const filters = document.getElementById('programFilters');
  if (!container) return;

  const programs = await fetchPrograms();
  if (!programs.length) {
    container.innerHTML = '<p style="color:var(--cream-dim);">Todavía no hay programas subidos.</p>';
    return;
  }

  const groups = groupByProgram(programs);
  let active = 'Todos';

  function render() {
    if (filters) {
      filters.innerHTML = ['Todos', ...groups.map(([name]) => name)]
        .map((name) => `<button type="button" class="admin-pill ${name === active ? 'active' : ''}" data-cat="${name}">${name}</button>`)
        .join('');
      filters.querySelectorAll('[data-cat]').forEach((btn) => {
        btn.addEventListener('click', () => { active = btn.dataset.cat; render(); });
      });
    }

    container.innerHTML = active === 'Todos'
      ? groups.map(([name, items]) => sectionHtml(name, items)).join('')
      : sectionHtml(active, groups.find(([name]) => name === active)[1], { withHeader: false });
  }

  render();
});
