(() => {
  const { groups, exercises } = exerciseCatalogue;
  const byId = new Map(exercises.map(entry => [entry.id, entry]));
  const modes = {
    quiz: 'Короткое задание', drawing: 'Построение или разбор',
    sheet: 'Графическая работа', project: 'Проект', extra: 'Вводное пособие',
  };
  const key = 'linea-exercises-v1';
  const get = id => document.getElementById(id);
  if (get('exerciseProgress')) {
    const showProgress = () => {
      let saved;
      try { saved = JSON.parse(localStorage.getItem(key)); } catch {}
      const done = exercises.filter(entry => saved?.done?.[entry.id]).length;
      get('exerciseProgressText').textContent = 'Выполнено: ' + done + ' из ' + exercises.length;
      const control = get('exerciseProgressLink');
      if (byId.has(saved?.last)) {
        control.href = 'exercises.html#' + encodeURIComponent(saved.last);
        control.textContent = 'Продолжить ' + saved.last + ' ↗';
      } else {
        control.href = 'exercises.html';
        control.textContent = 'Открыть упражнения ↗';
      }
    };
    showProgress();
    addEventListener('pageshow', showProgress);
    addEventListener('storage', event => { if (event.key === key) showProgress(); });
    return;
  }
  const browser = get('exerciseBrowser');
  const detail = get('exerciseDetail');
  const list = get('exerciseList');
  const topic = get('exerciseTopic');
  const mode = get('exerciseMode');
  const search = get('exerciseSearch');
  const printArea = get('printExercise');
  const zoom = get('exerciseZoom');
  const heading = (tag, text) => Object.assign(document.createElement(tag), { textContent: text });
  const link = (text, href, className = '') => Object.assign(heading('a', text), { href, className });
  const paragraph = (text, className) => Object.assign(heading('p', text), { className });
  const normalize = value => value.toLocaleLowerCase('ru').replaceAll('ё', 'е');
  const hasTopic = (entry, block, anchor) => entry.anchors.some(([id, name]) => id === block && name === anchor);
  let block = 0;
  let limit = 24;
  let progress = {};

  function readProgress() {
    try {
      const saved = JSON.parse(localStorage.getItem(key));
      if (saved && typeof saved === 'object' && !Array.isArray(saved)) progress = saved;
    } catch {}
  }
  function saveProgress(update) {
    readProgress();
    progress = { ...progress, ...update };
    try { localStorage.setItem(key, JSON.stringify(progress)); } catch {}
    const resume = byId.get(progress.last);
    const control = get('resumeExercise');
    control.hidden = !resume;
    if (resume) control.href = 'exercises.html#' + encodeURIComponent(resume.id);
  }
  function url(anchor = '') {
    const params = new URLSearchParams();
    if (block) params.set('block', block);
    if (topic.value) params.set('topic', topic.value);
    if (mode.value) params.set('format', mode.value);
    if (search.value.trim()) params.set('q', search.value.trim());
    return 'exercises.html' + (params.size ? '?' + params : '') + (anchor ? '#' + encodeURIComponent(anchor) : '');
  }
  function populateTopics(selected) {
    topic.replaceChildren(new Option('Все темы', ''));
    topic.disabled = !block;
    if (!block) return;
    for (const [id, label] of Object.entries(groups[block - 1].topics)) {
      if (exercises.some(entry => hasTopic(entry, block, id))) topic.add(new Option(label, id));
    }
    topic.value = [...topic.options].some(option => option.value === selected) ? selected : '';
  }
  function buildBlocks() {
    const nav = get('exerciseBlocks');
    nav.replaceChildren();
    for (const group of [{ id: 0, title: 'Все разделы' }, ...groups]) {
      const href = group.id ? 'exercises.html?block=' + group.id : 'exercises.html';
      const anchor = link(group.title, href, 'exercise-block');
      if (group.id === block) anchor.setAttribute('aria-current', 'true');
      if (group.id) anchor.append(heading('span', String(exercises.filter(e => e.group === group.id).length)));
      nav.append(anchor);
    }
  }
  function renderList() {
    const tokens = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    const matching = exercises.filter(entry => {
      if (topic.value ? !hasTopic(entry, block, topic.value) : block && entry.group !== block) return false;
      if (mode.value && mode.value !== entry.mode) return false;
      const haystack = normalize([entry.id, entry.title, entry.topic, groups[entry.group - 1].title].join(' '));
      return tokens.every(token => haystack.includes(token));
    });
    get('exerciseCount').textContent = matching.length ? 'Найдено: ' + matching.length : 'По этим фильтрам упражнений нет.';
    const cards = matching.slice(0, limit).map(entry => {
      const card = link('', url(entry.id), 'exercise-card');
      const meta = [entry.topic, modes[entry.mode]];
      if (progress.done?.[entry.id]) meta.push('✓ Выполнено');
      card.append(Object.assign(heading('span', entry.id), { className: 'exercise-id' }),
        heading('strong', entry.title), paragraph(meta.join(' · '), 'exercise-meta'));
      return card;
    });
    list.replaceChildren(...cards);
    get('moreExercises').hidden = matching.length <= limit;
  }
  function image(plate, alt) {
    return Object.assign(document.createElement('img'), { src: plate.src, alt });
  }
  function printPages(entry, plates) {
    printArea.replaceChildren(...plates.map(plate => {
      const page = document.createElement('div');
      page.className = 'exercise-print-page';
      const label = plate.variant ? 'Вариант ' + plate.variant + ' · ' : '';
      page.append(heading('h1', entry.id + ' · ' + label + entry.title),
        heading('p', 'Линия · Имя _______________________  Дата __________  · PDF, стр. ' + plate.page));
      if (plate.variant && entry.id === '05-021') {
        page.append(heading('p', 'На листе А4 построй главный вид детали и целесообразные сечения. Нанеси размеры.'));
      }
      if (plate.variant && entry.id === '05-006') {
        page.append(heading('p', 'Выбери номер правильно выполненного сечения. Ответ: ______'));
      }
      page.append(image(plate, 'Условие и схемы, страница ' + plate.page));
      return page;
    }));
  }
  async function print(entry, plates, button, restore) {
    button.disabled = true;
    printPages(entry, plates);
    try {
      await Promise.all([...printArea.querySelectorAll('img')].map(img => img.decode()));
      if (restore) addEventListener('afterprint', restore, { once: true });
      window.print();
    } catch {
      get('exercisePrintStatus').textContent = 'Схема не загрузилась. Открой исходный PDF или попробуй ещё раз.';
    } finally {
      button.disabled = false;
    }
  }
  const checks = {
    quiz: ['Сверь обозначения и единицы с условием.', 'Объясни, какое правило подтверждает твой ответ.'],
    drawing: ['Сохрани исходные размеры и положение опорных элементов.', 'Сверь типы линий и порядок построения с теорией.'],
    sheet: ['Проверь компоновку листа, контуры и проекционные связи.', 'Сверь размеры и обозначения. Заполни основную надпись, если она требуется.'],
    project: ['Проверь, что решение выполняет все условия.', 'Если вариантов несколько, объясни, чем различаются решения.'],
    extra: ['Сверь термины и ответы с соответствующим параграфом.'],
  };
  function orderQuiz() {
    const form = document.createElement('form');
    form.className = 'exercise-guidance exercise-quiz';
    form.append(heading('h3', 'Проверь порядок построения'));
    const steps = ['Построить точки сопряжения', 'Провести дугу сопряжения', 'Построить центр сопряжения'];
    const inputs = steps.map(step => {
      const label = heading('label', step + ' ');
      const select = document.createElement('select');
      select.required = true;
      select.add(new Option('Шаг', ''));
      for (let i = 1; i <= 3; i++) select.add(new Option(i, i));
      label.append(select);
      form.append(label);
      return select;
    });
    const feedback = paragraph('', 'exercise-meta');
    feedback.setAttribute('role', 'status');
    form.append(Object.assign(heading('button', 'Проверить'), { type: 'submit', className: 'primary' }), feedback);
    form.onsubmit = event => {
      event.preventDefault();
      const choices = inputs.map(input => input.value);
      const correct = choices.join('') === '231';
      feedback.textContent = correct
        ? 'Верно. Сначала находят центр, затем точки касания и только потом проводят дугу.'
        : new Set(choices).size < 3 ? 'Каждый номер шага используй один раз.'
        : 'Проверь, какие элементы уже должны быть известны, чтобы провести дугу.';
      window.lineaAnswerFeedback?.setOutcome(feedback, correct);
      if (correct) form.dispatchEvent(new Event('exercise-solved', { bubbles: true }));
    };
    return form;
  }
  function renderEntry(entry) {
    saveProgress({ last: entry.id });
    const content = get('exerciseContent');
    const title = heading('h2', entry.title);
    title.tabIndex = -1;
    const actions = document.createElement('div');
    actions.className = 'exercise-actions';
    const printButton = Object.assign(heading('button', 'Распечатать упражнение'), { type: 'button', className: 'primary' });
    let currentPlates = entry.plates;
    printButton.onclick = () => print(entry, currentPlates, printButton);
    const source = 'source-' + entry.book + '.pdf#page=';
    actions.append(printButton, link('Открыть исходный PDF ↗', source + entry.pages[0], 'secondary'));
    if (entry.mode === 'sheet') actions.append(link('Шаблон листа А4 ↗', 'workshop.html#sheet', 'secondary'));
    const done = Object.assign(heading('button', ''), { type: 'button', className: 'secondary' });
    function updateDone() {
      const complete = Boolean(progress.done?.[entry.id]);
      done.textContent = complete ? '✓ Выполнено · отменить' : 'Отметить выполненным';
      done.setAttribute('aria-pressed', String(complete));
    }
    done.onclick = () => {
      readProgress();
      saveProgress({ done: { ...progress.done, [entry.id]: !progress.done?.[entry.id] } });
      updateDone();
    };
    updateDone();
    actions.append(done);
    const status = paragraph('', 'exercise-meta');
    status.id = 'exercisePrintStatus';
    status.setAttribute('role', 'status');
    const theory = paragraph('Теория · ', 'exercise-meta');
    entry.anchors.forEach(([group, anchor], index) => {
      if (index) theory.append(' · ');
      const chapter = groups[group - 1];
      theory.append(link(chapter.topics[anchor], chapter.url + '#topic-' + anchor));
    });
    content.replaceChildren(paragraph(entry.id + ' / ' + groups[entry.group - 1].title, 'exercise-id'),
      title, theory, actions, status);
    if (entry.needs.length) {
      const dependencies = paragraph('Связанные задания · ', 'exercise-meta');
      entry.needs.forEach((id, index) => {
        if (index) dependencies.append(', ');
        dependencies.append(link(id, url(id)));
      });
      content.append(dependencies);
    }
    const figures = document.createElement('div');
    function renderFigures() {
      figures.replaceChildren(...currentPlates.map(plate => makeFigure(plate)));
      printPages(entry, currentPlates);
    }
    function makeFigure(plate) {
      const figure = document.createElement('figure');
      figure.className = 'exercise-figure';
      const alt = 'Условие и схемы упражнения ' + entry.id + ', PDF-страница ' + plate.page;
      const button = Object.assign(document.createElement('button'), { type: 'button' });
      button.setAttribute('aria-label', 'Увеличить · страница ' + plate.page);
      button.append(image(plate, alt));
      button.onclick = () => {
        const large = zoom.querySelector('img');
        large.src = plate.src;
        large.alt = alt;
        zoom.showModal();
      };
      const caption = heading('figcaption', '');
      caption.className = 'exercise-meta';
      caption.append(link('PDF, стр. ' + plate.page, source + plate.page));
      if (currentPlates.length > 1) {
        caption.append(' · ');
        const single = Object.assign(heading('button', 'Распечатать эту страницу'), { type: 'button', className: 'secondary' });
        single.onclick = () => print(entry, [plate], single, () => printPages(entry, currentPlates));
        caption.append(single);
      }
      figure.append(button, caption);
      return figure;
    }
    if (entry.variants) {
      const label = heading('label', 'Вариант ');
      label.className = 'exercise-variant';
      const variants = document.createElement('select');
      variants.add(new Option('Все варианты', ''));
      entry.variants.forEach((_, index) => variants.add(new Option('Вариант ' + (index + 1), index)));
      variants.value = progress.variants?.[entry.id] ?? '';
      const pick = () => {
        currentPlates = entry.variants[variants.value] ? [entry.variants[variants.value]] : entry.plates;
        renderFigures();
      };
      variants.onchange = () => {
        readProgress();
        saveProgress({ variants: { ...progress.variants, [entry.id]: variants.value } });
        pick();
      };
      label.append(variants);
      content.append(label);
      pick();
    } else {
      renderFigures();
    }
    content.append(figures);
    if (entry.id === '02-015') {
      const quiz = orderQuiz();
      quiz.addEventListener('exercise-solved', () => {
        readProgress();
        saveProgress({ done: { ...progress.done, [entry.id]: true } });
        updateDone();
      });
      content.append(quiz);
    }
    const guidance = document.createElement('details');
    guidance.className = 'exercise-guidance';
    const checklist = document.createElement('ul');
    const criteria = entry.id === '05-012' || entry.id === '05-021'
      ? ['Проверь, какие элементы попали в каждую секущую плоскость.',
        'Сверь контуры отверстий и выемок. Заштрихуй материал детали.',
        'Сверь буквы, стрелки направления взгляда и обозначения сечений.']
      : checks[entry.mode];
    checklist.append(...criteria.map(text => heading('li', text)));
    guidance.append(heading('summary', 'Самопроверка'), checklist);
    content.append(guidance);
  }
  function renderRoute(moveFocus = false) {
    const params = new URLSearchParams(location.search);
    const group = Number(params.get('block'));
    block = groups.some(entry => entry.id === group) ? group : 0;
    search.value = params.get('q') || '';
    mode.value = Object.hasOwn(modes, params.get('format')) ? params.get('format') : '';
    populateTopics(params.get('topic'));
    buildBlocks();
    let id = '';
    try { id = decodeURIComponent(location.hash.slice(1)); } catch {}
    const entry = byId.get(id);
    browser.hidden = Boolean(entry);
    detail.hidden = !entry;
    get('backToExercises').href = url();
    if (entry) {
      renderEntry(entry);
      if (moveFocus) detail.querySelector('h2').focus();
    } else {
      printArea.replaceChildren();
      renderList();
    }
  }
  mode.add(new Option('Все форматы', ''));
  for (const [value, label] of Object.entries(modes)) mode.add(new Option(label, value));
  get('exerciseFilters').addEventListener('submit', event => event.preventDefault());
  get('exerciseFilters').addEventListener('input', () => {
    limit = 24;
    history.replaceState(null, '', url());
    renderList();
  });
  get('moreExercises').onclick = () => { limit += 24; renderList(); };
  for (const element of [list, detail, get('exerciseBlocks'), get('resumeExercise')]) {
    element.addEventListener('click', event => {
      const anchor = event.target.closest('a');
      if (!anchor || !anchor.getAttribute('href')?.startsWith('exercises.html') ||
          event.button || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      event.preventDefault();
      history.pushState(null, '', anchor.href);
      renderRoute(true);
    });
  }
  addEventListener('popstate', () => renderRoute());
  saveProgress({});
  renderRoute();
})();
