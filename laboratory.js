(() => {
  const $ = id => document.getElementById(id);
  const format = new Intl.NumberFormat('ru', { maximumSignificantDigits: 8, useGrouping: false });
  const num = value => {
    const clean = value.trim().replace(',', '.');
    if (!/^(?:\d+\.?\d{0,6}|\.\d{1,6})$/.test(clean)) return NaN;
    const result = Number(clean);
    return result <= 1e9 ? result : NaN;
  };
  function scaleRatio(value) {
    const parts = value.split(':').map(num);
    if (parts.length !== 2 || !parts.every(n => n > 0)) return NaN;
    return parts[0] / parts[1];
  }
  function reducedRatio(a, b) {
    const x = Math.round(a * 1e6);
    const y = Math.round(b * 1e6);
    let r = x, s = y;
    while (s) [r, s] = [s, r % s];
    return `${x / r}:${y / r}`;
  }
  const scale = $('scaleCalc');
  function calculateScale() {
    const { target, drawing, real, ratio, result } = scale.elements;
    for (const field of scale.querySelectorAll('[data-scale-field]')) {
      field.hidden = field.dataset.scaleField === target.value || (target.value === 'ratio' && field.dataset.scaleField === 'ratio');
    }
    const d = num(drawing.value), r = num(real.value), factor = scaleRatio(ratio.value);
    if (target.value === 'ratio') {
      if (!(d > 0 && r > 0)) { result.textContent = 'Введи две положительные длины.'; return; }
      result.textContent = `Масштаб ${reducedRatio(d, r)} · ${format.format(d)} ÷ ${format.format(r)} = ${format.format(d / r)}`;
      return;
    }
    const length = target.value === 'drawing' ? r : d;
    if (!(length > 0) || !factor) { result.textContent = 'Введи положительную длину и масштаб в виде 1:2.'; return; }
    result.textContent = target.value === 'drawing'
      ? `${format.format(length * factor)} мм на чертеже · длина × масштаб`
      : `${format.format(length / factor)} мм в действительности · длина ÷ масштаб`;
  }
  scale.onsubmit = e => e.preventDefault();
  scale.addEventListener('input', calculateScale);
  calculateScale();

  const shape = $('shapeCalc');
  const graph = shape.querySelector('svg');
  const ratioText = k => k === 0 ? '0' : `${k < 0 ? '−' : ''}1:${format.format(1 / Math.abs(k))}`;
  function calculateShape() {
    const { kind, large, small, result } = shape.elements;
    const taper = kind.value === 'taper';
    shape.querySelector('[data-size-large]').textContent = taper ? 'Больший диаметр D, мм' : 'Начальная высота H, мм';
    shape.querySelector('[data-size-small]').textContent = taper ? 'Меньший диаметр d, мм' : 'Конечная высота h, мм';
    shape.querySelector('[data-size-length]').textContent = taper ? 'Длина вдоль оси L, мм' : 'Горизонтальное расстояние L, мм';
    const a = num(large.value), b = num(small.value), l = num(shape.elements.namedItem('length').value);
    if (!(a >= 0 && b >= 0 && l > 0) || (taper && (!(a > 0) || a < b))) {
      graph.replaceChildren();
      result.textContent = taper ? 'Нужны D > 0, 0 ≤ d ≤ D и L > 0.' : 'Нужны H и h не меньше нуля, а L больше нуля.';
      return;
    }
    const k = (a - b) / l;
    const degrees = Math.atan(taper ? k / 2 : k) * (taper ? 2 : 1) * 180 / Math.PI;
    result.textContent = `${taper ? 'C = (D − d)' : 'i = (H − h)'} / L = (${format.format(a)} − ${format.format(b)}) / ${format.format(l)} = ${format.format(k)} · ${ratioText(k)} · ${taper ? 'угол конуса' : 'угол по формуле'} ${format.format(degrees)}°${taper ? '' : ' · ' + format.format(k * 100) + '%'}`;
    const height = Math.max(1, a, b);
    const y1 = taper ? 84 - 54 * a / height : 139 - 110 * a / height;
    const y2 = taper ? 84 - 54 * b / height : 139 - 110 * b / height;
    graph.innerHTML = `
      <path class="lab-outline" d="${taper ? `M104 ${y1}L376 ${y2}V${168 - y2}L104 ${168 - y1}Z` : `M104 ${y1}L376 ${y2}V139H104Z`}"/>
      ${taper ? '<path class="lab-axis" d="M76 84H404"/>' : ''}
      <path class="lab-dim" d="M88 ${y1}H104M88 ${y1}V${taper ? 168 - y1 : 139}H104 M392 ${y2}H376M392 ${y2}V${taper ? 168 - y2 : 139}H376 M104 154V167H376V154"/>
      <text x="76" y="${taper ? 88 : 123}" text-anchor="end">${taper ? 'D' : 'H'}</text><text x="403" y="${taper ? 88 : 123}">${taper ? 'd' : 'h'}</text><text x="240" y="183" text-anchor="middle">L</text>`;
  }
  shape.onsubmit = e => e.preventDefault();
  shape.addEventListener('input', calculateShape);
  calculateShape();

  const exercises = [
    {
      prompt: 'Вид спереди на цилиндрический вал.',
      correct: 1,
      why: 'Осевая линия должна быть тонкой штрихпунктирной. Здесь она сплошная.',
      zones: [
        ['Верхний край', 'M92 65H388V115M92 65V115', '', 'M75 48H405V94H75Z'],
        ['Линия посередине', 'M66 115H414', 'lab-dim', 'M58 96H422V134H58Z'],
        ['Нижний край', 'M92 115V165H388V115', '', 'M75 139H405V184H75Z'],
      ],
    },
    {
      prompt: 'Вид трубы сбоку. Стенки отверстия скрыты.',
      correct: 2,
      why: 'Невидимые границы отверстия показывают штриховой линией. Нижнюю границу здесь ошибочно сделали сплошной.',
      zones: [
        ['Наружный контур', 'M92 57H388V173H92Z', '', 'M70 41H410V77H70Z'],
        ['Верхняя граница отверстия', 'M92 91H388', 'lab-hidden', 'M90 78H390V103H90Z'],
        ['Нижняя граница отверстия', 'M92 139H388', 'lab-dim', 'M90 127H390V156H90Z'],
      ],
      guide: '<path class="lab-axis" d="M66 115H414"/>',
    },
    {
      prompt: 'Торец круглого фланца. Сравни типы линий.',
      correct: 0,
      why: 'Наружную кромку видно, поэтому нужен сплошной толстый контур. Штрихи здесь неверны.',
      zones: [
        ['Наружная окружность', 'M240 35a80 80 0 1 0 0 160a80 80 0 1 0 0 -160Z', 'lab-hidden', 'M240 35a80 80 0 1 0 0 160a80 80 0 1 0 0 -160Z', 'ring-hit'],
        ['Кромка отверстия', 'M240 80a35 35 0 1 0 0 70a35 35 0 1 0 0 -70Z', '', 'M240 80a35 35 0 1 0 0 70a35 35 0 1 0 0 -70Z', 'ring-hit'],
        ['Центровые линии', 'M145 115H335M240 23V207', 'lab-axis', 'M145 115H335M240 23V207', 'ring-hit'],
      ],
    },
  ];
  const drawing = $('errorDrawing'), next = $('nextError'), restart = $('restartError');
  let exercise = 0, solved = false;
  function showExercise() {
    const { prompt, zones, guide } = exercises[exercise];
    $('errorPrompt').textContent = `Задание ${exercise + 1} из ${exercises.length}. ${prompt} Выбери линию, которую нужно исправить.`;
    $('errorFeedback').textContent = '';
    solved = false;
    next.hidden = restart.hidden = true;
    drawing.innerHTML = (guide || '') + zones.map(([name, mark, cls, hit, hitClass], i) => `
      <g role="button" tabindex="0" data-zone="${i}" aria-label="${name}">
        <path class="error-mark ${cls}" d="${mark}"/><path class="error-hit ${hitClass || ''}" d="${hit}"/>
      </g>`).join('');
  }
  function selectZone(e) {
    const zone = e.target.closest('[data-zone]');
    if (!zone || solved) return;
    const active = exercises[exercise];
    if (Number(zone.dataset.zone) !== active.correct) {
      $('errorFeedback').textContent = 'Эта линия уместна. Проверь другой участок.';
      return;
    }
    solved = true;
    zone.classList.add('found-error');
    const last = exercise === exercises.length - 1;
    $('errorFeedback').textContent = 'Верно. ' + active.why + (last ? ' Все три ошибки найдены.' : '');
    next.hidden = last;
    restart.hidden = !last;
  }
  drawing.onclick = selectZone;
  drawing.onkeydown = e => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    e.preventDefault();
    selectZone(e);
  };
  next.onclick = () => { exercise++; showExercise(); drawing.querySelector('[data-zone]').focus(); };
  restart.onclick = () => { exercise = 0; showExercise(); drawing.querySelector('[data-zone]').focus(); };
  showExercise();

  const board = $('drawBoard');
  const pen = board.getContext('2d');
  if (!pen) return;
  const tools = [...document.querySelectorAll('[data-draw-tool]')];
  const undo = $('undoDrawing'), clear = $('clearDrawing');
  const shapes = [];
  const steps = [];
  const bounds = [board.width, board.height];
  const distance = (a, b) => Math.hypot(b[0] - a[0], b[1] - a[1]);
  let cursor = [450, 225], tool = 'line', pointer = null, point = null, keyboard = false;
  function segment(a, b) { pen.moveTo(...a); pen.lineTo(...b); }
  function paintShape(kind, pts, preview = false) {
    if (pts.length < 2) return;
    pen.strokeStyle = preview ? '#75b0fc' : '#d9ecff';
    pen.lineWidth = 2.5;
    pen.setLineDash(preview ? [7, 5] : []);
    pen.beginPath();
    const [a, b, c] = pts;
    if (kind === 'circle') pen.arc(...a, distance(a, b), 0, Math.PI * 2);
    else {
      segment(a, b);
      if (c) {
        segment(b, c);
        const start = Math.atan2(a[1] - b[1], a[0] - b[0]);
        const end = Math.atan2(c[1] - b[1], c[0] - b[0]);
        const arc = Math.atan2(Math.sin(end - start), Math.cos(end - start));
        const radius = Math.min(28, distance(b, a) / 2, distance(b, c) / 2);
        pen.moveTo(b[0] + Math.cos(start) * radius, b[1] + Math.sin(start) * radius);
        pen.arc(...b, radius, start, start + arc, arc < 0);
        if (!preview) {
          pen.fillStyle = '#b8d9ff';
          pen.font = '18px system-ui';
          const mid = start + arc / 2;
          const x = Math.max(4, Math.min(board.width - 47, b[0] + Math.cos(mid) * (radius + 12)));
          const y = Math.max(20, Math.min(board.height - 4, b[1] + Math.sin(mid) * (radius + 12)));
          pen.fillText(Math.round(Math.abs(arc) * 180 / Math.PI) + '°', x, y);
        }
      }
    }
    pen.stroke();
  }
  function paint() {
    pen.fillStyle = '#0d1727';
    pen.fillRect(0, 0, ...bounds);
    pen.strokeStyle = '#263d5b';
    pen.setLineDash([]);
    pen.lineWidth = 1;
    pen.beginPath();
    for (let x = 20; x < bounds[0]; x += 20) segment([x + .5, 0], [x + .5, bounds[1]]);
    for (let y = 20; y < bounds[1]; y += 20) segment([0, y + .5], [bounds[0], y + .5]);
    pen.stroke();
    for (const item of shapes) paintShape(item.kind, item.points);
    if (steps.length && point) paintShape(tool, [...steps, point], true);
    pen.fillStyle = '#75b0fc';
    for (const step of steps) { pen.beginPath(); pen.arc(...step, 4, 0, Math.PI * 2); pen.fill(); }
    if (keyboard) {
      pen.setLineDash([]);
      pen.strokeStyle = '#ffd46b';
      pen.beginPath();
      segment([cursor[0] - 10, cursor[1]], [cursor[0] + 10, cursor[1]]);
      segment([cursor[0], cursor[1] - 10], [cursor[0], cursor[1] + 10]);
      pen.stroke();
    }
  }
  function hint() {
    const text = tool === 'angle'
      ? ['Поставь точку на первой стороне угла.', 'Теперь поставь вершину угла.', 'Поставь точку на второй стороне.'][steps.length]
      : (steps.length ? 'Укажи вторую точку.' : 'Протяни линию или поставь две точки. Для окружности первая точка задаёт центр.');
    $('drawHint').textContent = text;
    undo.disabled = !shapes.length && !steps.length;
    clear.disabled = undo.disabled;
    paint();
  }
  function addPoint(p) {
    if (steps.length && distance(steps.at(-1), p) < 2) return;
    steps.push(p);
    if (steps.length === (tool === 'angle' ? 3 : 2)) {
      shapes.push({ kind: tool, points: steps.splice(0) });
    }
    hint();
  }
  function position(e) {
    const rect = board.getBoundingClientRect();
    return [e.clientX - rect.left, e.clientY - rect.top].map((v, i) =>
      Math.max(0, Math.min(bounds[i], v * bounds[i] / (i ? rect.height : rect.width))));
  }
  board.onpointerdown = e => {
    if (!e.isPrimary || e.button !== 0) return;
    keyboard = false;
    point = position(e);
    pointer = { id: e.pointerId, start: point, drag: !steps.length && tool !== 'angle' };
    board.setPointerCapture(e.pointerId);
    if (pointer.drag) addPoint(point);
    else paint();
  };
  board.onpointermove = e => {
    if (!e.isPrimary) return;
    keyboard = false;
    point = position(e);
    paint();
  };
  board.onpointerup = e => {
    if (pointer?.id !== e.pointerId) return;
    point = position(e);
    if (!pointer.drag || distance(pointer.start, point) > 4) addPoint(point);
    pointer = null;
    paint();
  };
  board.onlostpointercapture = () => {
    if (pointer?.drag) steps.pop();
    pointer = null;
    hint();
  };
  board.onkeydown = e => {
    const arrows = { ArrowUp: [0, -10], ArrowDown: [0, 10], ArrowLeft: [-10, 0], ArrowRight: [10, 0] };
    if (!arrows[e.key] && e.key !== 'Enter' && e.key !== 'Escape') return;
    e.preventDefault();
    keyboard = true;
    if (arrows[e.key]) cursor = cursor.map((v, i) => Math.max(0, Math.min(bounds[i], v + arrows[e.key][i])));
    point = cursor;
    if (e.key === 'Enter') addPoint(cursor);
    if (e.key === 'Escape') steps.length = 0;
    hint();
  };
  board.onblur = () => { keyboard = false; paint(); };
  for (const button of tools) button.onclick = () => {
    tool = button.dataset.drawTool;
    steps.length = 0;
    for (const choice of tools) choice.setAttribute('aria-pressed', String(choice === button));
    hint();
  };
  undo.onclick = () => { if (steps.length) steps.pop(); else shapes.pop(); hint(); };
  clear.onclick = () => { steps.length = shapes.length = 0; hint(); };
  hint();

  try {
    const state = JSON.parse(localStorage.getItem('linea-study'));
    const done = Array.isArray(state?.done) ? new Set(state.done.filter(i => Number.isInteger(i) && i >= 0 && i < 7)).size : 0;
    $('progressText').textContent = done + ' / 7';
    $('progressFill').style.width = done / 7 * 100 + '%';
    document.body.classList.toggle('compact-theme', !!state?.gray);
    document.body.classList.toggle('no-motion', !!state?.noMotion);
  } catch {}
})();
