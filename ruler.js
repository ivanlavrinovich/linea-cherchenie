(() => {
  const $ = id => document.getElementById(id);
  const board = $('rulerBoard'), object = $('rulerObject'), slider = $('rulerAngle');
  const ticks = [], labels = $('rulerNumbers');
  for (let i = 0; i <= 25; i++) {
    const x = 10 * i;
    ticks.push(`M${x} 0V-${i % 5 === 0 ? 17 : 8}`);
    if (i % 5 === 0) {
      const number = document.createElementNS('http://www.w3.org/2000/svg','text');
      number.setAttribute('x',x);
      number.setAttribute('y',-23);
      number.setAttribute('text-anchor','middle');
      number.textContent = i;
      labels.append(number);
    }
  }
  $('rulerTicks').setAttribute('d',ticks.join(' '));
  const constrain = (v,min,max) => Math.min(max,Math.max(min,v));
  let x, y, drag;
  function render() {
    const angle = Number(slider.value);
    object.setAttribute('transform',`translate(${x} ${y}) rotate(${angle})`);
    $('rulerDegrees').textContent = angle + '°';
    slider.setAttribute('aria-valuetext',angle + ' градусов');
  }
  function reset() { x = 138; y = 282; slider.value = -30; render(); }
  function point(event) {
    return new DOMPoint(event.clientX,event.clientY).matrixTransform(board.getScreenCTM().inverse());
  }
  object.onpointerdown = e => {
    if (!e.isPrimary || e.button !== 0) return;
    const p = point(e);
    drag = { id: e.pointerId, dx: p.x - x, dy: p.y - y };
    object.setPointerCapture(e.pointerId);
  };
  object.onpointermove = e => {
    if (drag?.id !== e.pointerId) return;
    const p = point(e);
    x = constrain(p.x - drag.dx,15,645);
    y = constrain(p.y - drag.dy,20,315);
    render();
  };
  object.onlostpointercapture = () => { drag = undefined; };
  object.onkeydown = e => {
    const directions = { ArrowLeft: [-5,0], ArrowRight: [5,0], ArrowUp: [0,-5], ArrowDown: [0,5] };
    const move = directions[e.key];
    if (!move) return;
    e.preventDefault();
    if (e.shiftKey && move[0]) slider.value = constrain(Number(slider.value) + move[0],-180,180);
    else { x = constrain(x + move[0],15,645); y = constrain(y + move[1],20,315); }
    render();
  };
  slider.oninput = render;
  $('rulerReset').onclick = reset;
  reset();
})();
