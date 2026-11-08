(() => {
  const themeKey = 'linea-theme';
  const theme = document.querySelector('[data-theme-toggle]');
  function applyTheme(light) {
    document.documentElement.dataset.theme = light ? 'light' : 'dark';
    theme.textContent = light ? '☾ Тёмная' : '☀ Светлая';
    theme.setAttribute('aria-pressed', String(light));
  }
  const syncTheme = () => {
    try { applyTheme(localStorage.getItem(themeKey) === 'light'); }
    catch { applyTheme(false); }
  };
  theme.onclick = () => {
    const light = document.documentElement.dataset.theme !== 'light';
    applyTheme(light);
    try { localStorage.setItem(themeKey, light ? 'light' : 'dark'); } catch {}
  };
  addEventListener('pageshow', syncTheme);
  addEventListener('storage', e => { if (e.key === themeKey) syncTheme(); });
  syncTheme();

  const assets = new URL('.', document.currentScript.src);
  const form = document.querySelector('.site-search-form');
  const dialog = document.querySelector('#siteSearch');
  const input = dialog.querySelector('input');
  const status = dialog.querySelector('[role="status"]');
  const results = dialog.querySelector('.result-list');
  const shortcuts = [
    ['Программа курса', 'Все семь учебных разделов', 'index.html#course'],
    ['Калькуляторы чертёжника', 'Масштаб, уклон и конусность', 'laboratory.html#calculators'],
    ['Найди ошибку на чертеже', 'Тренажёр · линии, ось, штриховка', 'laboratory.html#find-error'],
    ['Чертёжная песочница', 'Линия, окружность, угол, практика', 'laboratory.html#sandbox'],
    ['Генератор рамки и основной надписи', 'Лист А4, А3, штамп, печать, PNG', 'workshop.html#sheet'],
    ['Справочник ГОСТов', '2.303 линии · 2.301 форматы · 2.302 масштабы · 2.104 надпись · 2.305 виды · 2.307 размеры', 'workshop.html#standards'],
    ['Чек-лист графической работы', 'Проверка перед сдачей чертежа', 'workshop.html#checklist'],
    ['Своя игра', 'Командная викторина по черчению', 'laboratory.html#jeopardy'],
    ['Прозрачная линейка', 'Поворот, угол, биссектриса', 'geometricheskie-postroeniya.html#virtual-ruler'],
    ['Вопрос дня', 'Ежедневная серия, циркуль, опыт XP', 'index.html#daily'],
    ['Мой кабинет', 'Галерея, сертификат, импорт и экспорт профиля', 'account.html'],
  ].map(([subtitle, title, url]) => ({ subtitle, title, url, text: '' }));
  let searchIndex;
  function loadIndex() {
    if (!searchIndex) searchIndex = new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = new URL('search-data.js', assets);
      script.onload = () => resolve(courseSearch);
      script.onerror = () => { script.remove(); searchIndex = undefined; reject(); };
      document.head.append(script);
    });
    return searchIndex;
  }
  const normalize = value => value.toLocaleLowerCase('ru').replaceAll('ё', 'е');
  function showResults(entries, query) {
    results.replaceChildren();
    status.textContent = query
      ? (entries.length ? `Найдено: ${entries.length}` : 'Ничего не найдено. Попробуй другой запрос.')
      : 'Введи термин или открой инструмент.';
    for (const entry of entries) {
      const link = document.createElement('a');
      link.className = 'source-link';
      link.href = entry.url;
      link.textContent = entry.subtitle + ' ↗';
      const caption = document.createElement('small');
      const offset = normalize(entry.text).indexOf(query);
      const excerpt = offset < 0 || !query ? '' : ' · ' + entry.text.slice(Math.max(0, offset - 38), offset + 105).trim() + '…';
      caption.textContent = entry.title + excerpt;
      link.append(caption);
      results.append(link);
    }
  }
  async function search() {
    const query = normalize(input.value.trim()).replace(/\s+/g, ' ');
    if (!query) return showResults(shortcuts, '');
    const tokens = query.split(' ');
    const matching = entries => entries.filter(({ title, subtitle, text }) => {
      const value = normalize(title + ' ' + subtitle + ' ' + text);
      return tokens.every(token => value.includes(token));
    });
    status.textContent = 'Поиск по пособию…';
    try {
      const entries = await loadIndex();
      if (query !== normalize(input.value.trim()).replace(/\s+/g, ' ')) return;
      const hits = matching(entries);
      hits.sort((a, b) => Number(normalize(b.subtitle).includes(query)) - Number(normalize(a.subtitle).includes(query)));
      showResults([...matching(shortcuts), ...hits], query);
    } catch {
      if (query !== normalize(input.value.trim()).replace(/\s+/g, ' ')) return;
      showResults(matching(shortcuts), query);
      status.textContent = 'Теория пока недоступна для поиска. Можно открыть найденные инструменты.';
    }
  }
  let debounce;
  input.oninput = () => { clearTimeout(debounce); debounce = setTimeout(search, 100); };
  const open = (query = '') => {
    if (!dialog.open) dialog.showModal();
    if (query) input.value = query;
    input.focus();
    search();
  };
  window.lineaSearch = { open };
  form.onsubmit = e => { e.preventDefault(); open(form.querySelector('input').value.trim()); };
  dialog.querySelector('[data-close-search]').onclick = () => dialog.close();
  document.addEventListener('keydown', e => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); open(); }
  });
  if (location.hash === '#search' && !document.getElementById('modal')) open();

  for (const button of document.querySelectorAll('[data-print-section]')) {
    button.onclick = () => window.print();
  }

  const terms = document.querySelectorAll('[data-definition]');
  if (!terms.length) return;
  const tip = document.createElement('div');
  tip.className = 'term-tooltip';
  tip.setAttribute('popover', 'manual');
  tip.setAttribute('role', 'tooltip');
  document.body.append(tip);
  let active;
  function hideTip() {
    if (!active) return;
    active.removeAttribute('aria-expanded');
    tip.hidePopover();
    active = undefined;
  }
  function showTip(term) {
    if (active === term) return;
    hideTip();
    active = term;
    term.setAttribute('aria-expanded', 'true');
    tip.textContent = term.dataset.definition;
    tip.showPopover();
    positionTip();
  }
  function positionTip() {
    if (!active) return;
    const anchor = active.getBoundingClientRect();
    if (anchor.bottom < 0 || anchor.top > innerHeight) return hideTip();
    const box = tip.getBoundingClientRect();
    const zoom = box.width / tip.offsetWidth || 1;
    const left = Math.max(8, Math.min(anchor.left, document.documentElement.clientWidth - box.width - 8));
    const top = anchor.bottom + box.height + 8 <= innerHeight ? anchor.bottom + 6 : anchor.top - box.height - 6;
    tip.style.left = left / zoom + 'px';
    tip.style.top = Math.max(4, top) / zoom + 'px';
  }
  if (!tip.showPopover) return;
  for (const term of terms) {
    term.removeAttribute('title');
    term.onpointerenter = e => { if (e.pointerType === 'mouse') showTip(term); };
    term.onpointerleave = () => { if (document.activeElement !== term) hideTip(); };
    term.onfocus = () => showTip(term);
    term.onblur = hideTip;
    term.onclick = () => showTip(term);
  }
  addEventListener('scroll', positionTip, { passive: true, capture: true });
  addEventListener('resize', positionTip);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') hideTip(); });
  document.addEventListener('pointerdown', e => { if (!e.target.closest('[data-definition]')) hideTip(); });
})();
