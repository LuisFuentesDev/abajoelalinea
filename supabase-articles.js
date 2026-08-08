// Lee artículos publicados (generados desde Instagram vía el backend compartido con Winforma)
// directo desde la REST API de Supabase, sin SDK — mismo patrón que hls.js: un <script> plano.
const SUPABASE_URL = 'https://rogafinwshzgornhrxap.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NfKcVml8rLAlf050xgJq3g_rq557P6h';
const SITE = 'abajolalinea';

async function fetchArticles({ category, limit = 6, slug } = {}) {
  const params = new URLSearchParams({
    select: 'slug,title,summary,content,author,category,image_url,source_url,published_at',
    site: `eq.${SITE}`,
    status: 'eq.published',
    order: 'published_at.desc',
  });
  if (category) params.set('category', `eq.${category}`);
  if (slug) params.set('slug', `eq.${slug}`);
  if (limit) params.set('limit', String(limit));

  const res = await fetch(`${SUPABASE_URL}/rest/v1/articles?${params}`, {
    headers: {
      apikey: SUPABASE_ANON_KEY,
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
  });
  if (!res.ok) return [];
  return res.json();
}

function articleCardHtml(article) {
  const date = article.published_at
    ? new Date(article.published_at).toLocaleDateString('es-CL', { day: 'numeric', month: 'long' })
    : '';
  return `
    <a class="prog-card" href="articulo.html?slug=${encodeURIComponent(article.slug)}">
      ${article.image_url ? `<img src="${article.image_url}" alt="" style="border-radius:6px; margin-bottom:12px; aspect-ratio:16/9; object-fit:cover;">` : ''}
      <span class="prog-tag">${article.category || ''}</span>
      <h3>${article.title}</h3>
      <p>${article.summary || ''}</p>
      ${date ? `<span class="mono" style="font-size:0.75rem; opacity:0.7;">${date}</span>` : ''}
    </a>`;
}

// Cada contenedor con [data-articles-category] se llena solo al cargar la página.
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('[data-articles-category]').forEach(async (container) => {
    const category = container.getAttribute('data-articles-category');
    const articles = await fetchArticles({ category });
    container.innerHTML = articles.length
      ? articles.map(articleCardHtml).join('')
      : '<p style="color:var(--cream-dim);">Todavía no hay publicaciones en esta categoría.</p>';
  });
});
