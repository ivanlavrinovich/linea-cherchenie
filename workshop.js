(() => {
  const $ = id => document.getElementById(id);
  const NS = 'http://www.w3.org/2000/svg';
  function svgNode(tag, attributes, content = '') {
    const node = document.createElementNS(NS, tag);
    for (const [name, value] of Object.entries(attributes)) node.setAttribute(name, value);
    if (content) node.textContent = content;
    return node;
  }
  const form = $('sheetForm');
  const value = name => form.elements.namedItem(name).value.trim();
  const pageSize = () => value('format') === 'a3' ? [420, 297] : [210, 297];
  const ruler = document.createElement('canvas').getContext('2d');
  function paper() {
    const [width, height] = pageSize();
    const svg = svgNode('svg', {
      width: width + 'mm', height: height + 'mm', viewBox: `0 0 ${width} ${height}`,
      role: 'img', 'aria-label': 'Чертёжный лист ' + value('format').toUpperCase(),
    });
    svg.append(svgNode('rect', { width, height, fill: '#fff' }));
    svg.append(svgNode('rect', { x: 20, y: 5, width: width - 25, height: height - 10, fill: 'none', stroke: '#000', 'stroke-width': .6 }));
    const stamp = svgNode('g', { transform: `translate(${width - 190} ${height - 60})` });
    svg.append(stamp);
    const path = (d, weight) => stamp.append(svgNode('path', { d, fill: 'none', stroke: '#000', 'stroke-width': weight }));
    path('M0 55V0H185 M65 0V55 M65 15H185 M65 40H185 M135 15V55 M135 35H185', .6);
    path('M0 20H65 M0 25H65 M0 30H65 M0 35H65 M0 40H65 M0 45H65 M0 50H65 M0 5H65 M0 10H65 M0 15H65 M7 0V25 M17 0V55 M40 0V55 M55 0V55 M135 20H185 M140 20V35 M145 20V35 M150 15V35 M167 15V35 M155 35V55', .25);
    const text = (x, y, label, size = 2.25, width = 30, center = false) => {
      if (!label) return;
      ruler.font = (size * 10) + 'px Arial';
      const span = ruler.measureText(label).width / 10;
      const options = { x, y, 'font-family': 'Arial, sans-serif', 'font-size': size, fill: '#000', 'text-anchor': center ? 'middle' : 'start' };
      if (span > width) Object.assign(options, { textLength: width, lengthAdjust: 'spacingAndGlyphs' });
      stamp.append(svgNode('text', options, label));
    };
    for (const [x,label] of [[.5,'Изм.'],[7.5,'Лист'],[17.5,'№ докум.'],[40.5,'Подп.'],[55.5,'Дата']]) text(x, 23.6, label, 1.9);
    ['Разраб.','Пров.','Т. контр.','', 'Н. контр.','Утв.'].forEach((label,i) => text(.6, 28.5 + 5*i, label, 2));
    for (const [x,y,label] of [[142.5,18.4,'Лит.'],[158.5,18.4,'Масса'],[176,18.4,'Масштаб']]) text(x,y,label,2,17,true);
    text(136,38.6,'Лист',2);
    text(153,38.6,'1',2,5,true);
    text(156,38.6,'Листов',2);
    text(182,38.6,'1',2,5,true);
    text(125,9.5,value('code'),4.5,114,true);
    text(100,29.4,value('title'),5.1,65,true);
    const student = value('student');
    const names = student.split(/\s+/);
    ruler.font = '22.5px Arial';
    if (names.length > 1 && ruler.measureText(student).width > 210) {
      text(18,27.1,names[0],1.85,21);
      text(18,29.35,names.slice(1).join(' '),1.85,21);
    } else text(18,28.6,student,2.25,21);
    text(176,29.4,value('scale'),3.5,16,true);
    text(170,46,value('group') ? 'Класс' : '',2.05,26,true);
    text(170,51,value('group'),3.3,26,true);
    return svg;
  }
  function updatePreview() { $('sheetPreview').replaceChildren(paper()); }
  form.onsubmit = e => e.preventDefault();
  form.oninput = updatePreview;
  try {
    const profile = JSON.parse(localStorage.getItem('linea-profile'));
    form.elements.namedItem('student').value = typeof profile?.name === 'string' ? profile.name.slice(0,60) : '';
    form.elements.namedItem('group').value = typeof profile?.group === 'string' ? profile.group.slice(0,22) : '';
  } catch {}
  updatePreview();

  function offer(blob, name) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = name;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function pngAt300Dpi(blob) {
    const bytes = new Uint8Array(await blob.arrayBuffer());
    const chunk = new Uint8Array(21);
    const view = new DataView(chunk.buffer);
    view.setUint32(0, 9);
    chunk.set([112,72,89,115], 4); // PNG pHYs
    view.setUint32(8, 11811);
    view.setUint32(12, 11811);
    chunk[16] = 1;
    let crc = -1;
    for (const byte of chunk.subarray(4,17)) {
      crc ^= byte;
      for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0);
    }
    view.setUint32(17, (crc ^ -1) >>> 0);
    const chunks = [bytes.subarray(0,33), chunk];
    const source = new DataView(bytes.buffer);
    for (let i = 33; i + 12 <= bytes.length;) {
      const end = i + source.getUint32(i) + 12;
      if (source.getUint32(i + 4) !== 0x70485973) chunks.push(bytes.subarray(i,end));
      i = end;
    }
    return new Blob(chunks, { type: 'image/png' });
  }
  $('sheetPng').onclick = async e => {
    const button = e.currentTarget;
    const [width,height] = pageSize();
    const file = 'linea-list-' + value('format') + '.png';
    const data = new XMLSerializer().serializeToString(paper());
    const url = URL.createObjectURL(new Blob([data], { type: 'image/svg+xml;charset=utf-8' }));
    button.disabled = true;
    $('sheetStatus').textContent = 'Подготавливаем изображение…';
    try {
      const image = new Image();
      image.src = url;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width * 300 / 25.4);
      canvas.height = Math.round(height * 300 / 25.4);
      canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
      const png = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
      if (!png) throw new Error('canvas');
      offer(await pngAt300Dpi(png), file);
      $('sheetStatus').textContent = 'Лист в PNG готов, разрешение 300 dpi.';
    } catch {
      $('sheetStatus').textContent = 'PNG создать не удалось. Можно сохранить лист через окно печати.';
    } finally {
      URL.revokeObjectURL(url);
      button.disabled = false;
    }
  };
  let printSheet, printStyle;
  function afterPrint() {
    document.body.classList.remove('printing-sheet');
    printSheet?.remove(); printStyle?.remove();
  }
  addEventListener('afterprint', afterPrint);
  $('sheetPrint').onclick = () => {
    afterPrint();
    const [width,height] = pageSize();
    printStyle = document.createElement('style');
    printStyle.textContent = `@page { size: ${width}mm ${height}mm; margin: 0; }`;
    document.head.append(printStyle);
    printSheet = document.createElement('div');
    printSheet.id = 'printSheet';
    printSheet.append(paper());
    document.body.append(printSheet);
    document.body.classList.add('printing-sheet');
    window.print();
  };

  const standards = [...document.querySelectorAll('[data-standard]')];
  const search = $('standardSearch');
  const normalize = text => text.toLowerCase().replaceAll('ё', 'е').replace(/(?<=\d),(?=\d)/g,'.');
  function filter() {
    const terms = normalize(search.value.trim()).split(/\s+/).filter(Boolean);
    let found = 0;
    for (const standard of standards) {
      const words = normalize(standard.dataset.standard);
      standard.hidden = !terms.every(term => words.includes(term));
      if (!standard.hidden) found++;
    }
    $('standardCount').textContent = found ? `Найдено карточек: ${found} из ${standards.length}` : 'Карточек по этому запросу нет.';
  }
  search.value = new URLSearchParams(location.search).get('gost')?.slice(0,100) || '';
  search.oninput = filter;
  filter();

  const checkKey = 'linea-checklist';
  const checks = [...document.querySelectorAll('.drawing-checklist input')];
  try {
    const saved = JSON.parse(localStorage.getItem(checkKey));
    if (Array.isArray(saved)) for (const box of checks) box.checked = saved.includes(box.value);
  } catch {}
  function checkStatus(save) {
    const done = checks.filter(box => box.checked).map(box => box.value);
    $('checkCount').textContent = `Отмечено ${done.length} из ${checks.length}`;
    if (save) {
      try { localStorage.setItem(checkKey, JSON.stringify(done)); }
      catch { $('checkCount').textContent += ' · Браузер не сохранил отметки.'; }
    }
  }
  for (const box of checks) box.onchange = () => checkStatus(true);
  $('resetChecks').onclick = () => { for (const box of checks) box.checked = false; checkStatus(true); };
  checkStatus(false);
})();
