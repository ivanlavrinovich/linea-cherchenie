(() => {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const confettiColors = ['#66db9a','#86c9ff','#ffcf68','#c5a9ff','#f7f8ff'];

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
    if (reduced.matches || document.body.classList.contains('no-motion')) return;
    status.querySelector('.feedback-burst')?.remove();
    const burst = document.createElement('span');
    burst.className = 'feedback-burst';
    burst.setAttribute('aria-hidden','true');
    for (let i = 0; i < (correct ? 18 : 7); i++) {
      const particle = document.createElement('i');
      const side = i % 2 === 0 ? -1 : 1;
      particle.className = correct ? 'confetti-bit' : 'cross-bit';
      particle.style.setProperty('--dx', (side*(16+Math.random()*99)) + 'px');
      particle.style.setProperty('--dy', (-26-Math.random()*85) + 'px');
      particle.style.setProperty('--spin', (side*(25+Math.random()*200)) + 'deg');
      particle.style.setProperty('--delay', (i%4)*23 + 'ms');
      if (correct) particle.style.background = confettiColors[i%confettiColors.length];
      else particle.textContent = '×';
      burst.append(particle);
    }
    status.append(burst);
    setTimeout(() => burst.remove(), 1100);
  }

  window.lineaAnswerFeedback = { mark, setOutcome, burst };
})();
