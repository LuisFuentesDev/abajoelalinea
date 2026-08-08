// Panel de edición de Abajo e' la Línea — usa el SDK de Supabase (vía CDN, sin build)
// porque a diferencia de supabase-articles.js necesitamos sesión de usuario (login)
// para que las policies RLS de "authenticated" permitan insert/update/delete e imágenes.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = 'https://rogafinwshzgornhrxap.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_NfKcVml8rLAlf050xgJq3g_rq557P6h';
const SITE = 'abajolalinea';
const STORAGE_BUCKET = 'article-images';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const $ = (id) => document.getElementById(id);

let articles = [];
let categoryFilter = 'Todas';
let selectedId = null;

// ---------- helpers ----------

function slugify(text) {
  return text
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9\- ]+/g, '').trim()
    .replace(/\s+/g, '-').replace(/-{2,}/g, '-').replace(/^-+|-+$/g, '')
    .slice(0, 90) || 'nota';
}

function linesToHtml(text) {
  return text.split('\n').map((l) => l.trim()).filter(Boolean)
    .map((p) => `<p>${p}</p>`).join('');
}

function htmlToLines(html) {
  return (html || '').replace(/<\/p>\s*<p>/gi, '\n').replace(/<\/?p>/gi, '').trim();
}

function toLocalInputValue(iso) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fmtDate(iso) {
  return new Intl.DateTimeFormat('es-CL', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(iso));
}

// ---------- tabs ----------

document.querySelectorAll('.admin-tab').forEach((btn) => {
  btn.addEventListener('click', () => setTab(btn.dataset.tab));
});

function setTab(tab) {
  document.querySelectorAll('.admin-tab').forEach((b) => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('[data-panel]').forEach((p) => {
    p.style.display = p.dataset.panel === tab ? (p.dataset.panel === 'editor' ? 'block' : 'block') : 'none';
  });
}

// ---------- form ----------

function resetForm() {
  $('articleForm').reset();
  $('articleId').value = '';
  selectedId = null;
  $('author').value = "Abajo e' la Línea";
  $('status').value = 'draft';
  $('publishedAt').value = toLocalInputValue();
  $('editorTitle').textContent = 'Nueva noticia';
  $('viewLink').style.display = 'none';
  $('deleteBtn').style.display = 'none';
  $('imagePreview').style.display = 'none';
  $('formError').style.display = 'none';
  $('formSuccess').style.display = 'none';
  renderList();
}

function fillForm(article) {
  selectedId = article.id;
  $('articleId').value = article.id;
  $('title').value = article.title || '';
  $('slug').value = article.slug || '';
  $('category').value = article.category || 'Comunidad';
  $('status').value = article.status || 'draft';
  $('summary').value = article.summary || '';
  $('content').value = htmlToLines(article.content);
  $('imageUrl').value = article.image_url || '';
  $('sourceUrl').value = article.source_url || '';
  $('author').value = article.author || "Abajo e' la Línea";
  $('publishedAt').value = toLocalInputValue(article.published_at);
  $('editorTitle').textContent = 'Editar noticia';
  $('deleteBtn').style.display = 'inline-flex';
  if (article.image_url) {
    $('imagePreview').src = article.image_url;
    $('imagePreview').style.display = 'block';
  } else {
    $('imagePreview').style.display = 'none';
  }
  $('viewLink').style.display = 'inline-flex';
  $('viewLink').href = `articulo.html?slug=${encodeURIComponent(article.slug)}`;
  $('formError').style.display = 'none';
  $('formSuccess').style.display = 'none';
  setTab('editor');
  renderList();
}

// ---------- list ----------

function renderPills() {
  const cats = ['Todas', ...new Set(articles.map((a) => a.category))].sort((a, b) => a === 'Todas' ? -1 : a.localeCompare(b));
  $('categoryFilters').innerHTML = cats.map((c) =>
    `<button type="button" class="admin-pill ${c === categoryFilter ? 'active' : ''}" data-cat="${c}">${c}</button>`
  ).join('');
  $('categoryFilters').querySelectorAll('[data-cat]').forEach((btn) => {
    btn.addEventListener('click', () => { categoryFilter = btn.dataset.cat; renderList(); });
  });
}

function renderList() {
  renderPills();
  const filtered = articles.filter((a) => categoryFilter === 'Todas' || a.category === categoryFilter);
  const list = $('articleList');

  if (!filtered.length) {
    list.innerHTML = `<p style="color:var(--cream-dim); border:1px dashed var(--line); border-radius:12px; padding:24px; text-align:center;">
      ${categoryFilter === 'Todas' ? "Aún no hay noticias cargadas." : `No hay noticias en ${categoryFilter}.`}
    </p>`;
    return;
  }

  list.innerHTML = filtered.map((a) => `
    <div class="admin-item ${a.id === selectedId ? 'selected' : ''}" data-open="${a.id}">
      <span class="cat">${a.category} · ${a.status}</span>
      <h3>${a.title}</h3>
      <div class="date">${fmtDate(a.published_at)}</div>
      <div class="row-actions">
        <button type="button" data-edit="${a.id}">Editar</button>
        <button type="button" data-delete="${a.id}">Eliminar</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openArticle(btn.dataset.edit); });
  });
  list.querySelectorAll('[data-open]').forEach((el) => {
    el.addEventListener('click', () => openArticle(el.dataset.open));
  });
  list.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('¿Eliminar permanentemente esta noticia? Esta acción no se puede deshacer.')) return;
      await supabase.from('articles').delete().eq('id', btn.dataset.delete);
      await loadArticles();
    });
  });
}

async function openArticle(id) {
  const { data, error } = await supabase.from('articles').select('*').eq('id', id).single();
  if (!error) fillForm(data);
}

async function loadArticles() {
  const { data, error } = await supabase
    .from('articles')
    .select('id, slug, title, category, status, published_at')
    .eq('site', SITE)
    .order('published_at', { ascending: false });
  if (!error) articles = data;
  renderList();
}

// ---------- image upload ----------

$('imageFile').addEventListener('change', () => {
  const file = $('imageFile').files[0];
  if (!file) return;
  $('imagePreview').src = URL.createObjectURL(file);
  $('imagePreview').style.display = 'block';
  $('imageFileLabel').textContent = file.name;
});

async function uploadImageIfNeeded() {
  const file = $('imageFile').files[0];
  if (!file) return $('imageUrl').value.trim() || null;

  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `articles/${slugify($('slug').value)}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
    cacheControl: '31536000',
    upsert: true,
  });
  if (error) throw error;
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

// ---------- save / new / delete ----------

async function saveArticle(statusOverride) {
  const formError = $('formError');
  const formSuccess = $('formSuccess');
  formError.style.display = 'none';
  formSuccess.style.display = 'none';

  try {
    const imageUrl = await uploadImageIfNeeded();
    const payload = {
      slug: slugify($('slug').value),
      title: $('title').value.trim(),
      summary: $('summary').value.trim(),
      content: linesToHtml($('content').value),
      author: $('author').value.trim() || "Abajo e' la Línea",
      category: $('category').value,
      image_url: imageUrl,
      source_url: $('sourceUrl').value.trim() || null,
      site: SITE,
      status: statusOverride || $('status').value,
      published_at: new Date($('publishedAt').value).toISOString(),
    };

    const id = $('articleId').value;
    const query = id
      ? supabase.from('articles').update(payload).eq('id', id).select().single()
      : supabase.from('articles').insert(payload).select().single();
    const { data, error } = await query;
    if (error) throw error;

    formSuccess.textContent = payload.status === 'published' ? 'Noticia publicada.' : 'Cambios guardados.';
    formSuccess.style.display = 'block';
    await loadArticles();
    fillForm(data);
  } catch (err) {
    formError.textContent = err.message || String(err);
    formError.style.display = 'block';
  }
}

$('articleForm').addEventListener('submit', (e) => { e.preventDefault(); saveArticle(); });
$('saveDraftBtn').addEventListener('click', () => saveArticle('draft'));
$('publishBtn').addEventListener('click', () => saveArticle('published'));
$('genSlug').addEventListener('click', () => { $('slug').value = slugify($('title').value); });
$('newBtn').addEventListener('click', resetForm);
$('refreshBtn').addEventListener('click', loadArticles);

$('deleteBtn').addEventListener('click', async () => {
  const id = $('articleId').value;
  if (!id) return;
  if (!confirm(`¿Eliminar permanentemente "${$('title').value}"? Esta acción no se puede deshacer.`)) return;
  await supabase.from('articles').delete().eq('id', id);
  await loadArticles();
  resetForm();
});

// ---------- auth ----------

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const loginError = $('loginError');
  loginError.style.display = 'none';
  $('loginBtn').disabled = true;
  const { error } = await supabase.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('password').value,
  });
  $('loginBtn').disabled = false;
  if (error) {
    loginError.textContent = 'Correo o contraseña incorrectos.';
    loginError.style.display = 'block';
  }
});

$('logoutBtn').addEventListener('click', () => supabase.auth.signOut());

// ---------- programas (videos de YouTube) ----------

let programs = [];
let selectedProgramId = null;

function resetProgramForm() {
  $('programForm').reset();
  $('programId').value = '';
  selectedProgramId = null;
  $('programStatus').value = 'draft';
  $('programPublishedAt').value = toLocalInputValue();
  $('programFormTitle').textContent = 'Nuevo programa';
  $('programDeleteBtn').style.display = 'none';
  $('programFormError').style.display = 'none';
  $('programFormSuccess').style.display = 'none';
  renderProgramList();
}

function fillProgramForm(program) {
  selectedProgramId = program.id;
  $('programId').value = program.id;
  $('programTitle').value = program.title || '';
  $('programYoutubeUrl').value = program.youtube_url || '';
  $('programCategory').value = program.category || '';
  $('programStatus').value = program.status || 'draft';
  $('programPublishedAt').value = toLocalInputValue(program.published_at);
  $('programDescription').value = program.description || '';
  $('programFormTitle').textContent = 'Editar programa';
  $('programDeleteBtn').style.display = 'inline-flex';
  $('programFormError').style.display = 'none';
  $('programFormSuccess').style.display = 'none';
  renderProgramList();
}

function renderProgramList() {
  const list = $('programList');
  if (!programs.length) {
    list.innerHTML = '<p style="color:var(--cream-dim); border:1px dashed var(--line); border-radius:12px; padding:24px; text-align:center;">Aún no hay programas cargados.</p>';
    return;
  }
  list.innerHTML = programs.map((p) => `
    <div class="admin-item ${p.id === selectedProgramId ? 'selected' : ''}" data-open="${p.id}">
      <span class="cat">${p.category || 'Sin categoría'} · ${p.status}</span>
      <h3>${p.title}</h3>
      <div class="date">${fmtDate(p.published_at)}</div>
      <div class="row-actions">
        <button type="button" data-edit="${p.id}">Editar</button>
        <button type="button" data-delete="${p.id}">Eliminar</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', (e) => { e.stopPropagation(); openProgram(btn.dataset.edit); });
  });
  list.querySelectorAll('[data-open]').forEach((el) => {
    el.addEventListener('click', () => openProgram(el.dataset.open));
  });
  list.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      if (!confirm('¿Eliminar permanentemente este programa? Esta acción no se puede deshacer.')) return;
      await supabase.from('programs').delete().eq('id', btn.dataset.delete);
      await loadPrograms();
    });
  });
}

async function openProgram(id) {
  const { data, error } = await supabase.from('programs').select('*').eq('id', id).single();
  if (!error) fillProgramForm(data);
}

async function loadPrograms() {
  const { data, error } = await supabase
    .from('programs')
    .select('id, title, category, status, published_at')
    .eq('site', SITE)
    .order('published_at', { ascending: false });
  if (!error) programs = data;
  renderProgramList();
}

$('programForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formError = $('programFormError');
  const formSuccess = $('programFormSuccess');
  formError.style.display = 'none';
  formSuccess.style.display = 'none';

  try {
    const payload = {
      title: $('programTitle').value.trim(),
      youtube_url: $('programYoutubeUrl').value.trim(),
      category: $('programCategory').value.trim() || null,
      description: $('programDescription').value.trim() || null,
      site: SITE,
      status: $('programStatus').value,
      published_at: new Date($('programPublishedAt').value).toISOString(),
    };

    const id = $('programId').value;
    const query = id
      ? supabase.from('programs').update(payload).eq('id', id).select().single()
      : supabase.from('programs').insert(payload).select().single();
    const { data, error } = await query;
    if (error) throw error;

    formSuccess.textContent = 'Guardado correctamente.';
    formSuccess.style.display = 'block';
    await loadPrograms();
    fillProgramForm(data);
  } catch (err) {
    formError.textContent = err.message || String(err);
    formError.style.display = 'block';
  }
});

$('programNewBtn').addEventListener('click', resetProgramForm);

$('programDeleteBtn').addEventListener('click', async () => {
  const id = $('programId').value;
  if (!id) return;
  if (!confirm(`¿Eliminar permanentemente "${$('programTitle').value}"? Esta acción no se puede deshacer.`)) return;
  await supabase.from('programs').delete().eq('id', id);
  await loadPrograms();
  resetProgramForm();
});

// ---------- auth ----------

supabase.auth.onAuthStateChange((_event, session) => {
  const loggedIn = Boolean(session);
  $('loginScreen').style.display = loggedIn ? 'none' : 'flex';
  $('dashboard').style.display = loggedIn ? 'block' : 'none';
  if (loggedIn) {
    $('sessionEmail').textContent = session.user.email;
    setTab('list');
    resetForm();
    loadArticles();
    resetProgramForm();
    loadPrograms();
  }
});
