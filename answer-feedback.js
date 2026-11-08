(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const confettiColors = ['#66db9a','#86c9ff','#ffcf68','#c5a9ff','#f7f8ff'];
  const rainDuration = 1500;
  let layer, canvas, brush, frame = 0;

  function mark(container, correct, chosen) {
    [...container.querySelectorAll('button.answer')].forEach((button,index) => {
      const outcome = index === correct ? 'correct' : index === chosen ? 'wrong' : '';
      button.disabled = correct !== undefined;
      button.classList.remove('correct','wrong');
      button.removeAttribute('aria-label');
      if (!outcome) return;
      button.classList.add(outcome);
      button.setAttribute('aria-label', button.textContent.trim() + (outcome === 'correct' ? '. Правильный ответ' : '. Неверный ответ'));
    });
  }

  function setOutcome(status, correct) {
    if (typeof correct === 'boolean') status.dataset.outcome = correct ? 'correct' : 'wrong';
    else delete status.dataset.outcome;
  }

  function burst(status, correct) {
    cancelAnimationFrame(frame);
    layer?.remove();
    if (reduced.matches || document.body.classList.contains('no-motion')) return;
    const doc = status.ownerDocument;
    if (!layer) {
      layer = doc.createElement('div');
      layer.className = 'feedback-burst';
      layer.setAttribute('aria-hidden','true');
      if (typeof layer.showPopover === 'function') layer.setAttribute('popover','manual');
      canvas = doc.createElement('canvas');
      brush = canvas.getContext('2d');
      layer.append(canvas);
    }
    if (!brush) return;
    doc.body.append(layer);
    if (layer.hasAttribute('popover')) layer.showPopover();
    const width = layer.clientWidth, height = layer.clientHeight;
    if (!width || !height) { layer.remove(); return; }
    const ratio = Math.min(devicePixelRatio || 1, 1.6, Math.sqrt(2000000/(width*height)));
    const pixelsWide = Math.round(width*ratio), pixelsHigh = Math.round(height*ratio);
    if (canvas.width !== pixelsWide) canvas.width = pixelsWide;
    if (canvas.height !== pixelsHigh) canvas.height = pixelsHigh;
    const count = Math.min(correct ? 128 : 92, Math.max(correct ? 48 : 34,
      Math.round(width / (correct ? 11 : 15))));
    const particles = Array.from({length:count}, (_,i) => {
      const delay = Math.random()*(i%6===0 ? 45 : 425);
      return {
        x: width*(i+Math.random())/count,
        size: correct ? 6+Math.random()*8 : 12+Math.random()*13,
        drift: (Math.random()-.5)*90,
        phase: Math.random()*Math.PI*2,
        spin: (Math.random()-.5)*8,
        delay,
        duration: (rainDuration-delay)*(.74+Math.random()*.26),
        color: correct ? confettiColors[i%confettiColors.length] : '#fa748b',
      };
    });
    const started = performance.now();
    function draw(now) {
      const elapsed = now-started;
      if (elapsed >= rainDuration || reduced.matches || document.body.classList.contains('no-motion')) {
        layer.remove();
        frame = 0;
        return;
      }
      brush.setTransform(1,0,0,1,0,0);
      brush.clearRect(0,0,canvas.width,canvas.height);
      for (const p of particles) {
        const t = (elapsed-p.delay)/p.duration;
        if (t <= 0 || t >= 1) continue;
        const x = p.x+p.drift*t+8*(Math.sin(p.phase+6*t)-Math.sin(p.phase));
        const y = -p.size+(height+2*p.size)*t*(.8+.2*t);
        const angle = p.phase+p.spin*t;
        const c = Math.cos(angle)*ratio, s = Math.sin(angle)*ratio;
        brush.setTransform(c,s,-s,c,x*ratio,y*ratio);
        brush.globalAlpha = Math.min(1,t*9,(1-t)*7);
        if (correct) {
          brush.fillStyle = p.color;
          brush.fillRect(-p.size*.33,-p.size/2,p.size*.66,p.size);
        } else {
          const half = p.size*.34;
          brush.strokeStyle = p.color;
          brush.lineCap = 'round';
          brush.lineWidth = Math.max(2,p.size*.15);
          brush.beginPath();
          brush.moveTo(-half,-half); brush.lineTo(half,half);
          brush.moveTo(-half,half); brush.lineTo(half,-half);
          brush.stroke();
        }
      }
      frame = requestAnimationFrame(draw);
    }
    brush.setTransform(1,0,0,1,0,0);
    brush.clearRect(0,0,canvas.width,canvas.height);
    frame = requestAnimationFrame(draw);
  }

  window.lineaAnswerFeedback = { mark, setOutcome, burst };
})();
