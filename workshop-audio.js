(() => {
  const toggle = document.querySelector('[data-workshop-sounds]');
  if (!toggle) return;
  const Context = window.AudioContext || window.webkitAudioContext;
  const key = 'linea-workshop-sounds';
  const quizAnswer = '[data-answer],#dailyAnswers .answer,#jeopardyAnswers .answer';
  let enabled = false, audio, volume, paperNoise, lastHover = -Infinity;
  try { enabled = localStorage.getItem(key) === '1'; } catch {}

  function updateToggle() {
    toggle.setAttribute('aria-pressed', String(enabled));
    toggle.title = (enabled ? 'Выключить' : 'Включить') + ' звуки мастерской';
    if (volume) volume.gain.setValueAtTime(enabled ? .26 : 0,audio.currentTime);
  }
  if (!Context) {
    toggle.disabled = true;
    toggle.title = 'Звук недоступен в этом браузере';
    return;
  }
  updateToggle();

  async function unlock() {
    if (!enabled) return false;
    try {
      if (!audio) {
        audio = new Context();
        volume = audio.createGain();
        volume.gain.value = .26;
        volume.connect(audio.destination);
      }
      if (audio.state !== 'running') await audio.resume();
      return enabled && audio.state === 'running';
    } catch { return false; }
  }

  function noise(duration, kind) {
    if (!paperNoise) {
      paperNoise = audio.createBuffer(1,Math.ceil(audio.sampleRate*.19),audio.sampleRate);
      const samples = paperNoise.getChannelData(0);
      for (let i = 0; i < samples.length; i++) samples[i] = Math.random()*2-1;
    }
    const grain = audio.createBufferSource();
    grain.buffer = paperNoise;
    const filter = audio.createBiquadFilter();
    filter.type = 'bandpass';
    const gain = audio.createGain();
    const at = audio.currentTime;
    const pencil = kind === 'pencil';
    filter.frequency.setValueAtTime(pencil ? 2360+Math.random()*450 : 3900,at);
    filter.frequency.exponentialRampToValueAtTime(pencil ? 1510 : 1900,at+duration);
    filter.Q.value = pencil ? .65 : 1.2;
    gain.gain.setValueAtTime(.001,at);
    gain.gain.linearRampToValueAtTime(pencil ? .27 : .18,at+(pencil ? .018 : .004));
    if (pencil) {
      gain.gain.linearRampToValueAtTime(.12,at+.048);
      gain.gain.linearRampToValueAtTime(.19,at+.064);
    }
    gain.gain.exponentialRampToValueAtTime(.001,at+duration);
    grain.connect(filter).connect(gain).connect(volume);
    grain.start(at,0,duration);
  }

  function pencil() {
    if (!enabled || audio?.state !== 'running' || performance.now()-lastHover < 95) return;
    lastHover = performance.now();
    noise(.13,'pencil');
  }

  function compass() {
    noise(.035,'compass');
    for (const [frequency,delay,strength] of [[780,0,.22],[1320,.027,.12]]) {
      const tone = audio.createOscillator();
      const gain = audio.createGain();
      const at = audio.currentTime+delay;
      tone.type = 'triangle';
      tone.frequency.setValueAtTime(frequency,at);
      tone.frequency.exponentialRampToValueAtTime(frequency*.67,at+.10);
      gain.gain.setValueAtTime(.001,at);
      gain.gain.linearRampToValueAtTime(strength,at+.006);
      gain.gain.exponentialRampToValueAtTime(.001,at+.12);
      tone.connect(gain).connect(volume);
      tone.start(at);
      tone.stop(at+.125);
    }
  }

  toggle.onclick = async () => {
    enabled = !enabled;
    try { localStorage.setItem(key,enabled ? '1' : '0'); } catch {}
    updateToggle();
    if (await unlock()) pencil();
  };
  document.addEventListener('pointerover', e => {
    if (!enabled || e.pointerType !== 'mouse') return;
    const button = e.target.closest?.('button,[role="button"]');
    if (!button || button.disabled || button.matches('[aria-disabled=true]') ||
        (e.relatedTarget instanceof Node && button.contains(e.relatedTarget))) return;
    pencil();
  });
  document.addEventListener('click', async e => {
    if (!enabled || !e.isTrusted || e.target.closest?.('[data-workshop-sounds]')) return;
    const button = e.target.closest?.(quizAnswer);
    if (await unlock() && button && !button.matches('[aria-disabled=true]')) compass();
  },true);
  // The drawing game only checks a selected region when its own handler accepts it.
  window.lineaWorkshopSounds = {
    async check() { if (await unlock()) compass(); },
  };
  window.addEventListener('storage', e => {
    if (e.key !== key && e.key !== null) return;
    enabled = e.newValue === '1';
    updateToggle();
  });
})();
