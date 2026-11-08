(() => {
  const $ = id => document.getElementById(id);
  const topics = [
    ['Линии', [
      ['Чем проводят линии видимого контура?', ['Штриховой','Сплошной толстой','Тонкой штрихпунктирной'], 1, 'Видимый контур рисуют сплошной толстой основной.'],
      ['Какая линия подходит для выносной?', ['Сплошная тонкая','Сплошная толстая','Разомкнутая'], 0, 'Размерные и выносные линии делают сплошными тонкими.'],
      ['Две центровые линии пересекаются. Что должно попасть в точку пересечения?', ['Промежутки','Точки','Длинные штрихи'], 2, 'Центровые линии пересекаются длинными штрихами.'],
    ]],
    ['Форматы', [
      ['Каковы размеры А3?', ['210 × 297 мм','297 × 420 мм','420 × 594 мм'], 1, 'А3 — 297 × 420 мм.'],
      ['Какой отступ оставляют слева под подшивку?', ['5 мм','10 мм','20 мм'], 2, 'Для подшивки оставляют 20 мм слева.'],
      ['На сколько листов А4 можно разделить один лист А2 без остатка?', ['На четыре','На два','На восемь'], 0, 'А2 делится на два А3, а каждый А3 — на два А4.'],
    ]],
    ['Проекции', [
      ['Как называется изображение на фронтальной плоскости?', ['Вид сверху','Главный вид','Вид слева'], 1, 'Главный вид располагается на фронтальной плоскости.'],
      ['Где размещают вид слева в принятой в ЕСКД системе?', ['Слева от главного','Под главным','Справа от главного'], 2, 'В этой системе вид слева располагают справа.'],
      ['Как проецируется отрезок, перпендикулярный плоскости проекций?', ['В точку','В отрезок той же длины','В окружность'], 0, 'Все его точки имеют одну и ту же проекцию на плоскость.'],
    ]],
    ['Сечения', [
      ['На сечении трубы отверстие…', ['Штрихуют в обратную сторону','Оставляют пустым','Закрашивают'], 1, 'Штриховка обозначает материал стенки.'],
      ['Какой контур у вынесенного сечения?', ['Сплошной толстый','Штриховой','Штрихпунктирный'], 0, 'Вынесенное сечение обводят сплошной основной линией.'],
      ['Чем разрез отличается от сечения?', ['Всегда другой штриховкой','Разрез не имеет обозначения','Разрез показывает также видимое за плоскостью'], 2, 'Сечение ограничено фигурой в плоскости. На разрезе видны и элементы за ней.'],
    ]],
  ];
  const game = $('jeopardy');
  const grid = game.querySelector('tbody');
  const mode = $('jeopardyMode');
  const dialog = $('jeopardyQuestion');
  const used = new Set();
  let scores, turn, correctCount;
  const team = () => mode.value === 'team';
  function summary() {
    const remaining = 12 - used.size;
    const scoresText = team() ? `Команда 1: ${scores[0]} · Команда 2: ${scores[1]}` : `Счёт: ${scores[0]}`;
    const result = remaining ? (team() ? ` · Ход команды ${turn + 1}` : '') :
      (team() ? (scores[0] === scores[1] ? ' · Ничья' : ` · Победила команда ${scores[0] > scores[1] ? 1 : 2}`) : ' · Игра завершена');
    $('jeopardyStatus').textContent = scoresText + result + (remaining ? ` · Осталось ${remaining} из 12` : '');
  }
  function ask(row, col, cell) {
    const id = row * 3 + col, cost = (col + 1) * 100;
    if (used.has(id)) return;
    const [topic, questions] = topics[row];
    const [prompt, options, correct, why] = questions[col];
    $('jeopardyTitle').textContent = `${topic} · ${cost}`;
    $('jeopardyPrompt').textContent = prompt;
    const feedback = $('jeopardyFeedback');
    const effects = window.lineaAnswerFeedback;
    feedback.textContent = '';
    effects.setOutcome(feedback);
    const answers = $('jeopardyAnswers');
    answers.replaceChildren();
    options.forEach((option,i) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'answer';
      button.textContent = option;
      button.onclick = () => {
        if (used.has(id)) return;
        used.add(id);
        const ok = i === correct;
        if (ok) correctCount++;
        const delta = ok ? cost : (team() ? -cost : 0);
        scores[turn] += delta;
        if (team()) turn = 1 - turn;
        effects.mark(answers,correct,i);
        effects.setOutcome(feedback,ok);
        feedback.textContent = (ok ? `✓ Верно! +${cost}. ` : '× Неверно. Правильный ответ: «' + options[correct] + '». ') + why;
        effects.burst(feedback,ok);
        cell.disabled = true;
        cell.textContent = ok ? '✓' : '—';
        summary();
        if (used.size === 12 && correctCount > 0) window.lineaProgress?.award('jeopardy');
        dialog.querySelector('.site-search-body [data-close-game]').focus();
      };
      answers.append(button);
    });
    dialog.showModal();
  }
  function reset() {
    if (dialog.open) dialog.close();
    used.clear();
    scores = [0,0];
    turn = correctCount = 0;
    grid.replaceChildren();
    topics.forEach(([name], row) => {
      const line = grid.insertRow();
      const label = document.createElement('th');
      label.scope = 'row';
      label.textContent = name;
      line.append(label);
      for (let col = 0; col < 3; col++) {
        const cell = line.insertCell(), button = document.createElement('button');
        button.type = 'button';
        button.textContent = (col + 1) * 100;
        button.setAttribute('aria-label', name + ', ' + button.textContent);
        button.onclick = () => ask(row, col, button);
        cell.append(button);
      }
    });
    summary();
  }
  for (const button of dialog.querySelectorAll('[data-close-game]')) button.onclick = () => dialog.close();
  dialog.addEventListener('close', () => {
    if (document.activeElement === document.body) (grid.querySelector('button:not(:disabled)') || $('jeopardyReset')).focus();
  });
  mode.onchange = reset;
  $('jeopardyReset').onclick = reset;
  reset();
})();
