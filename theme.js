// Alterna claro/oscuro. El snippet inline en <head> de cada página ya aplica
// el valor guardado antes del primer render (evita el flash); esto solo
// conecta el botón y mantiene el ícono sincronizado.
function currentTheme() {
  return document.documentElement.getAttribute('data-theme')
    || (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark');
}

function applyIcon(btn) {
  const isLight = currentTheme() === 'light';
  btn.textContent = isLight ? '🌙' : '☀️';
  btn.setAttribute('aria-label', isLight ? 'Cambiar a modo oscuro' : 'Cambiar a modo claro');
}

document.querySelectorAll('.theme-toggle').forEach((btn) => {
  applyIcon(btn);
  btn.addEventListener('click', () => {
    const next = currentTheme() === 'light' ? 'dark' : 'light';
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('theme', next);
    document.querySelectorAll('.theme-toggle').forEach(applyIcon);
  });
});
