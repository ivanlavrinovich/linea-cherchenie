(() => {
  const key = 'linea-activity-v1';
  const awards = { 'error-game': 15, 'jeopardy': 25, 'course-quiz': 15 };
  for (let i = 0; i < 7; i++) awards['lesson-' + i] = 20;
  const levels = [
    { label: 'Новичок', min: 0, color: '#7d8ca2' },
    { label: 'Чертёжник', min: 40, color: '#429cff' },
    { label: 'Инженер', min: 100, color: '#eeb947' },
    { label: 'Архитектор', min: 180, color: '#5ef0e0' },
  ];
  const questions = [
    ['Какой линией показывают невидимый контур?', ['Штриховой','Сплошной толстой','Штрихпунктирной'], 0, 'Штриховой показывают скрытые контуры и рёбра.'],
    ['Какая линия подходит для оси симметрии?', ['Сплошная толстая','Тонкая штрихпунктирная','Сплошная волнистая'], 1, 'Оси и центровые линии проводят тонкой штрихпунктирной.'],
    ['Каковы размеры листа А4?', ['297 × 420 мм','210 × 297 мм','148 × 210 мм'], 1, 'А4 имеет размеры 210 × 297 мм.'],
    ['В масштабе 1:2 отрезок на листе равен 30 мм. Какова действительная длина?', ['15 мм','30 мм','60 мм'], 2, 'Изображение уменьшено вдвое. Действительная длина равна 60 мм.'],
    ['Что показывает сечение?', ['Всё, что видно за секущей плоскостью','Фигуру непосредственно в секущей плоскости','Только внешний вид детали'], 1, 'Сечение показывает фигуру пересечения детали плоскостью.'],
    ['Какой знак ставят перед диаметром?', ['R','⌀','□'], 1, 'Перед числом диаметра ставят ⌀.'],
    ['Как называется луч, делящий угол пополам?', ['Биссектриса','Касательная','Нормаль'], 0, 'Биссектриса делит угол на две равные части.'],
    ['Где располагают вид сверху относительно главного вида в ЕСКД?', ['Слева','Над главным видом','Под главным видом'], 2, 'В принятой в ЕСКД системе вид сверху помещают под главным видом.'],
    ['Какой масштаб соответствует изображению в натуральную величину?', ['1:2','1:1','2:1'], 1, 'В масштабе 1:1 длина на чертеже равна действительной.'],
    ['Какой линией проводят видимый контур?', ['Тонкой штриховой','Тонкой штрихпунктирной','Сплошной толстой основной'], 2, 'Видимый контур выделяют сплошной толстой основной линией.'],
    ['Какой размер ставят на чертеже в масштабе 2:1?', ['Действительный размер','Удвоенный размер','Половину действительного'], 0, 'Размерное число сообщает действительный размер детали.'],
    ['Что штрихуют на поперечном сечении трубы?', ['Всё внутри наружной окружности','Только материал стенки','Только отверстие'], 1, 'Отверстие не содержит материала, поэтому его оставляют пустым.'],
    ['Что изображает круг на торце цилиндра?', ['Вид вдоль оси','Вид поперёк оси','Любой вид цилиндра'], 0, 'При взгляде вдоль оси видна круглая торцевая поверхность.'],
    ['Чему равна конусность при D = 40 мм, d = 20 мм, L = 100 мм?', ['1:2','1:5','1:10'], 1, 'Конусность (D − d) / L = 20 / 100 = 1:5.'],
  ];
  function day() {
    const local = new Date();
    return Math.floor(Date.UTC(local.getFullYear(),local.getMonth(),local.getDate()) / 86400000);
  }
  function dailyQuestion(date) {
    let seed = Math.imul(date ^ 0x517cc1b7, 0x45d9f3b);
    seed = Math.imul(seed ^ (seed >>> 16), 0x45d9f3b);
    return questions[((seed ^ (seed >>> 16)) >>> 0) % questions.length];
  }
  const positive = (value, limit) => Number.isInteger(value) && value > 0 && value <= limit;
  function validate(raw) {
    const last = positive(raw?.last, 100000) ? raw.last : 0;
    const streak = last && positive(raw?.streak, last) ? raw.streak : 0;
    const best = Math.max(streak, positive(raw?.best, 100000) ? raw.best : 0);
    const earned = Object.keys(awards).filter(id => Array.isArray(raw?.earned) && raw.earned.includes(id));
    const answers = {};
    if (raw?.answers && typeof raw.answers === 'object' && !Array.isArray(raw.answers)) {
      for (const [date, answer] of Object.entries(raw.answers)) {
        if (/^[1-9]\d{0,4}$/.test(date) && [0,1,2].includes(answer?.choice) && typeof answer.correct === 'boolean') {
          answers[date] = { choice: answer.choice, correct: answer.correct };
        }
      }
    }
    return { last, streak, best, earned, answers };
  }
  function read() {
    try { return validate(JSON.parse(localStorage.getItem(key))); }
    catch { return validate(null); }
  }
  function study() {
    try { return JSON.parse(localStorage.getItem('linea-study')) || {}; }
    catch { return {}; }
  }
  function stats(state = read()) {
    let xp = state.earned.reduce((sum, id) => sum + awards[id], 0);
    for (const answer of Object.values(state.answers)) if (answer.correct) xp += 10;
    const tier = levels.findLastIndex(level => xp >= level.min);
    return { xp, tier, ...levels[tier], next: levels[tier + 1] };
  }
  let session = read();
  let persisted = true;
  async function change(edit) {
    const transaction = () => {
      const current = persisted ? read() : session;
      const before = JSON.stringify(current);
      edit(current);
      session = current;
      if (before === JSON.stringify(current)) return;
      try { localStorage.setItem(key, JSON.stringify(current)); persisted = true; }
      catch { persisted = false; }
    };
    try {
      if (navigator.locks?.request) await navigator.locks.request(key, transaction);
      else transaction();
    } catch { transaction(); }
    render();
  }
  function recordVisit() {
    const today = day();
    return change(current => {
      if (current.last < today) {
        current.streak = current.last === today - 1 ? current.streak + 1 : 1;
        current.best = Math.max(current.best, current.streak);
        current.last = today;
      }
      const activity = study();
      if (Array.isArray(activity.done)) {
        for (const i of activity.done) {
          if (Number.isInteger(i) && i >= 0 && i < 7 && !current.earned.includes('lesson-' + i)) current.earned.push('lesson-' + i);
        }
      }
      if (Number.isFinite(activity.best) && activity.best > 0 && !current.earned.includes('course-quiz')) current.earned.push('course-quiz');
    });
  }
  function award(id) {
    if (!Object.hasOwn(awards,id)) return;
    return change(current => { if (!current.earned.includes(id)) current.earned.push(id); });
  }
  const card = document.querySelector('#daily');
  const feedback = document.querySelector('#dailyFeedback');
  const answers = document.querySelector('#dailyAnswers');
  const workshop = document.querySelector('.workshop');
  let rendered = '';
  function renderDaily(date) {
    const [prompt, options, correct, why] = dailyQuestion(date);
    const response = session.answers[date];
    const answer = response?.choice;
    const signature = date + ':' + answer + ':' + response?.correct + ':' + persisted;
    if (signature === rendered) return;
    rendered = signature;
    document.querySelector('#dailyQuestion').textContent = prompt;
    const buttons = [...answers.children];
    options.forEach((option,i) => {
      const button = buttons[i];
      button.textContent = option;
      if (!window.lineaAnswerFeedback) {
        button.disabled = answer !== undefined;
        button.classList.toggle('correct', answer !== undefined && i === correct);
        button.classList.toggle('wrong', answer === i && answer !== correct);
      }
    });
    window.lineaAnswerFeedback?.mark(answers,answer === undefined ? undefined : correct,answer);
    window.lineaAnswerFeedback?.setOutcome(feedback,response?.correct);
    feedback.textContent = answer === undefined ? '' : (response.correct ? '✓ Верно! +10 XP. ' : '× Неверно. Правильный ответ: «' + options[correct] + '». ') + why +
      (persisted ? '' : ' Браузер не сохранил результат.');
  }
  if (card) {
    for (let i = 0; i < 3; i++) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'answer';
      button.onclick = async () => {
        const today = day();
        if (!rendered.startsWith(today + ':')) { await recordVisit(); return; }
        for (const option of answers.children) option.disabled = true;
        if (session.last !== today) await recordVisit();
        let correct;
        await change(current => {
          if (current.answers[today] !== undefined) return;
          correct = dailyQuestion(today)[2] === i;
          current.answers[today] = { choice: i, correct };
        });
        if (correct !== undefined) window.lineaAnswerFeedback?.burst(feedback,correct);
      };
      answers.append(button);
    }
  }
  function render() {
    const today = day();
    const active = session.last === today;
    const streak = active || session.last === today - 1 ? session.streak : 0;
    const stage = Math.floor(streak / 10);
    const progress = stats(session);
    document.documentElement.dataset.xpTier = progress.tier;
    if (workshop) {
      const done = study().done;
      const count = Array.isArray(done) ? new Set(done.filter(i => Number.isInteger(i) && i >= 0 && i < 7)).size : 0;
      document.querySelector('#progressText').textContent = count + ' / 7';
      document.querySelector('#progressFill').style.width = count / 7 * 100 + '%';
    }
    const compass = document.querySelector('[data-compass]');
    if (compass) {
      compass.dataset.active = String(active);
      compass.dataset.stage = String(stage % 5);
      compass.dataset.cycle = String(Math.floor(stage / 5) % 2);
      compass.querySelector('[data-compass-days]').textContent = streak;
      compass.title = active ? 'Серия: ' + streak + ' дн. · заход сегодня засчитан' : 'Сегодня заход ещё не засчитан';
      compass.setAttribute('aria-label',compass.title + '. Мой уровень');
    }
    const profile = document.querySelector('#activityProgress');
    if (profile) {
      profile.querySelector('[data-rank]').textContent = progress.label;
      profile.querySelector('[data-xp]').textContent = progress.xp + ' XP';
      profile.querySelector('[data-streak]').textContent = `Серия: ${streak} дн. · Рекорд: ${session.best} дн. · Следующий облик циркуля: ${(stage + 1) * 10} дн.`;
      profile.querySelector('[data-next-level]').textContent = progress.next
        ? 'До уровня «' + progress.next.label + '» осталось ' + (progress.next.min - progress.xp) + ' XP.'
        : 'Открыта неоновая рамка «Архитектор».';
    }
    if (card) renderDaily(today);
  }
  window.lineaProgress = { key, validate, read: () => persisted ? read() : session, stats, award, refresh: recordVisit };
  render();
  if (!document.hidden) recordVisit();
  addEventListener('pageshow', () => { if (!document.hidden) recordVisit(); });
  addEventListener('focus', recordVisit);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) recordVisit(); });
  addEventListener('storage', e => { if (e.key === key || e.key === null) { session = read(); render(); } });
  document.addEventListener('click', e => { if (e.target.closest('#done')) recordVisit(); });
  setInterval(() => { if (session.last !== day()) render(); }, 30000);

  const sequence = ['ArrowUp','ArrowUp','ArrowDown','ArrowDown','ArrowLeft','ArrowRight','ArrowLeft','ArrowRight','b','a'];
  let step = 0, timeout, audio;
  const notice = document.createElement('div');
  notice.className = 'chaos-notice';
  notice.setAttribute('role','status');
  notice.hidden = true;
  notice.textContent = 'Чертёжный хаос! Esc — остановить.';
  document.body.append(notice);
  function stopChaos() {
    clearTimeout(timeout);
    document.body.classList.remove('drawing-chaos');
    notice.hidden = true;
  }
  function compassSound() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    try {
      audio ||= new Audio();
      audio.resume().catch(() => {});
      [460, 715, 965].forEach((frequency,i) => {
        const t = audio.currentTime + i * .035;
        const oscillator = audio.createOscillator(), gain = audio.createGain();
        oscillator.type = 'triangle';
        oscillator.frequency.setValueAtTime(frequency,t);
        oscillator.frequency.exponentialRampToValueAtTime(frequency * .56,t + .15);
        gain.gain.setValueAtTime(.045,t);
        gain.gain.exponentialRampToValueAtTime(.001,t + .18);
        oscillator.connect(gain).connect(audio.destination);
        oscillator.start(t); oscillator.stop(t + .2);
      });
    } catch {}
  }
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') { step = 0; stopChaos(); }
    if (e.repeat || e.ctrlKey || e.altKey || e.metaKey || e.target.closest?.('input,textarea,select,canvas,[contenteditable],#rulerObject,dialog')) return;
    const pressed = e.code === 'KeyB' ? 'b' : e.code === 'KeyA' ? 'a' : e.key.length === 1 ? e.key.toLowerCase() : e.key;
    step = pressed === sequence[step] ? step + 1 : Number(pressed === sequence[0]);
    if (step !== sequence.length) return;
    step = 0;
    stopChaos();
    document.body.classList.add('drawing-chaos');
    notice.hidden = false;
    compassSound();
    timeout = setTimeout(stopChaos, 8000);
  });
})();
