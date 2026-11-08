(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const confettiColors = ['#66db9a','#86c9ff','#ffcf68','#c5a9ff','#f7f8ff'];
  const rainDuration = 1500;
  let rain, cleanup;

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
    clearTimeout(cleanup);
    rain?.remove();
    if (reduced.matches || document.body.classList.contains('no-motion')) return;
    const doc = status.ownerDocument;
    const layer = doc.createElement('div');
    layer.className = 'feedback-burst';
    layer.setAttribute('aria-hidden','true');
    if (typeof layer.showPopover === 'function') layer.setAttribute('popover','manual');
    doc.body.append(layer);
    if (layer.hasAttribute('popover')) layer.showPopover();
    rain = layer;
    layer.style.setProperty('--fall', (layer.clientHeight + 60) + 'px');
    const count = Math.min(correct ? 132 : 94, Math.max(correct ? 48 : 34,
      Math.round(layer.clientWidth / (correct ? 11 : 15))));
    const particles = doc.createDocumentFragment();
    for (let i = 0; i < count; i++) {
      const particle = doc.createElement('i');
      const delay = Math.round(Math.random()*380);
      particle.className = correct ? 'confetti-bit' : 'cross-bit';
      particle.style.setProperty('--x', (100*(i+Math.random())/count) + '%');
      particle.style.setProperty('--dx', ((Math.random()-.5)*80) + 'px');
      particle.style.setProperty('--spin', ((Math.random()-.5)*680) + 'deg');
      particle.style.setProperty('--size', (correct ? 6+Math.random()*7 : 16+Math.random()*14) + 'px');
      particle.style.setProperty('--delay', delay + 'ms');
      particle.style.setProperty('--duration', (rainDuration-delay) + 'ms');
      if (correct) particle.style.background = confettiColors[i%confettiColors.length];
      else particle.textContent = '×';
      particles.append(particle);
    }
    layer.append(particles);
    cleanup = setTimeout(() => { layer.remove(); rain = undefined; }, rainDuration);
  }

  window.lineaAnswerFeedback = { mark, setOutcome, burst };
})();
