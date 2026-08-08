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
        ${program.category ? `<span class="prog-tag">${program.category}</span>` : ''}
        <h3>${program.title}</h3>
        ${program.description ? `<p>${program.description}</p>` : ''}
        ${date ? `<span class="mono">${date}</span>` : ''}
      </div>
    </div>`;
}

document.addEventListener('DOMContentLoaded', async () => {
  const container = document.getElementById('programVideos');
  if (!container) return;
  const programs = await fetchPrograms();
  container.innerHTML = programs.length
    ? programs.map(programRowHtml).join('')
    : '<p style="color:var(--cream-dim);">Todavía no hay programas subidos.</p>';
});
