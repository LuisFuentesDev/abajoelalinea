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
const loginForm = $('loginForm');
const panel = $('panel');
const logoutBtn = $('logoutBtn');

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
  return (html || '')
    .replace(/<\/p>\s*<p>/gi, '\n')
    .replace(/<\/?p>/gi, '')
    .trim();
}

function toLocalInputValue(iso) {
  const d = iso ? new Date(iso) : new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function resetForm() {
  $('articleForm').reset();
  $('articleId').value = '';
  $('author').value = "Abajo e' la Línea";
  $('status').value = 'published';
  $('publishedAt').value = toLocalInputValue();
  $('formModeLabel').textContent = 'Nueva';
  $('formError').style.display = 'none';
  $('formSuccess').style.display = 'none';
}

function fillForm(article) {
  $('articleId').value = article.id;
  $('title').value = article.title || '';
  $('slug').value = article.slug || '';
  $('category').value = article.category || 'Comunidad';
  $('summary').value = article.summary || '';
  $('content').value = htmlToLines(article.content);
  $('imageUrl').value = article.image_url || '';
  $('sourceUrl').value = article.source_url || '';
  $('author').value = article.author || "Abajo e' la Línea";
  $('status').value = article.status || 'published';
  $('publishedAt').value = toLocalInputValue(article.published_at);
  $('formModeLabel').textContent = 'Editando';
  $('formError').style.display = 'none';
  $('formSuccess').style.display = 'none';
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function loadArticles() {
  const { data, error } = await supabase
    .from('articles')
    .select('id, slug, title, category, status, published_at')
    .eq('site', SITE)
    .order('published_at', { ascending: false });

  const list = $('articleList');
  if (error) {
    list.innerHTML = `<p style="color:var(--red);">Error cargando publicaciones: ${error.message}</p>`;
    return;
  }
  if (!data.length) {
    list.innerHTML = '<p style="color:var(--cream-dim);">Todavía no hay publicaciones.</p>';
    return;
  }
  list.innerHTML = data.map((a) => `
    <div class="admin-row">
      <div>
        <strong>${a.title}</strong>
        <div class="meta">${a.category} · ${a.status} · ${new Date(a.published_at).toLocaleDateString('es-CL')}</div>
      </div>
      <div class="actions">
        <button data-edit="${a.id}">Editar</button>
        <button data-delete="${a.id}">Eliminar</button>
      </div>
    </div>
  `).join('');

  list.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const { data: full, error: e } = await supabase
        .from('articles').select('*').eq('id', btn.dataset.edit).single();
      if (!e) fillForm(full);
    });
  });
  list.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('¿Eliminar esta publicación?')) return;
      await supabase.from('articles').delete().eq('id', btn.dataset.delete);
      loadArticles();
    });
  });
}

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

$('genSlug').addEventListener('click', () => {
  $('slug').value = slugify($('title').value);
});

$('newBtn').addEventListener('click', resetForm);

$('articleForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const formError = $('formError');
  const formSuccess = $('formSuccess');
  formError.style.display = 'none';
  formSuccess.style.display = 'none';
  $('saveBtn').disabled = true;

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
      status: $('status').value,
      published_at: new Date($('publishedAt').value).toISOString(),
    };

    const id = $('articleId').value;
    const { error } = id
      ? await supabase.from('articles').update(payload).eq('id', id)
      : await supabase.from('articles').insert(payload);

    if (error) throw error;

    formSuccess.textContent = 'Guardado correctamente.';
    formSuccess.style.display = 'block';
    resetForm();
    loadArticles();
  } catch (err) {
    formError.textContent = err.message || String(err);
    formError.style.display = 'block';
  } finally {
    $('saveBtn').disabled = false;
  }
});

$('loginForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const loginError = $('loginError');
  loginError.style.display = 'none';
  const { error } = await supabase.auth.signInWithPassword({
    email: $('email').value.trim(),
    password: $('password').value,
  });
  if (error) {
    loginError.textContent = 'Correo o contraseña incorrectos.';
    loginError.style.display = 'block';
  }
});

logoutBtn.addEventListener('click', async () => {
  await supabase.auth.signOut();
});

supabase.auth.onAuthStateChange((_event, session) => {
  const loggedIn = Boolean(session);
  loginForm.style.display = loggedIn ? 'none' : 'block';
  panel.style.display = loggedIn ? 'block' : 'none';
  logoutBtn.style.display = loggedIn ? 'inline-flex' : 'none';
  if (loggedIn) {
    resetForm();
    loadArticles();
  }
});
