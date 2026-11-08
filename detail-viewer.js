(() => {
  const root = document.querySelector('[data-model]');
  if (!root) return;
  const assets = new URL('.', document.currentScript.src);
  const stage = root.querySelector('.model3d-stage');
  const loading = root.querySelector('.model3d-loading');
  const output = root.querySelector('.model3d-scale');
  const tooltip = root.querySelector('.model3d-tip');
  const description = root.querySelector('.model3d-description');
  const initialDescription = description.textContent;
  const buttons = [...root.querySelectorAll('[data-part]')];
  const parts = new Map(buttons.map(button => [button.dataset.part, button]));
  const controls = [...root.querySelectorAll('[data-view]')];
  let selected, highlight = () => {};

  function select(id) {
    selected = selected === id ? undefined : id;
    for (const button of buttons) button.setAttribute('aria-pressed', String(button.dataset.part === selected));
    const active = parts.get(selected);
    description.textContent = active ? active.textContent + ' · ' + active.dataset.description : initialDescription;
    highlight(selected);
  }
  for (const button of buttons) button.onclick = () => select(button.dataset.part);

  function loadScript(name) {
    return new Promise((resolve,reject) => {
      const script = document.createElement('script');
      script.src = new URL(name,assets);
      script.onload = resolve;
      script.onerror = reject;
      document.head.append(script);
    });
  }
  async function start() {
    loading.textContent = 'Загружаем 3D-модель…';
    try {
      await Promise.all([loadScript('three-r160.min.js'),loadScript('detail-scenes.js')]);
      makeViewer(window.THREE,window.lineaModelScene);
    } catch {
      root.dataset.render = 'unavailable';
      loading.textContent = '3D-вид недоступен в этом браузере. Выбери часть детали в списке, чтобы прочитать её описание.';
    }
  }
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      if (!entries.some(entry => entry.isIntersecting)) return;
      observer.disconnect();
      start();
    }, { rootMargin: '240px' });
    observer.observe(root);
  } else start();

  function makeViewer(T, build) {
    const { group, pickables, apertures, materials } = build(root.dataset.model,T);
    const bounds = new T.Box3().setFromObject(group);
    const radius = bounds.getBoundingSphere(new T.Sphere()).radius;
    group.position.sub(bounds.getCenter(new T.Vector3()));
    const model = new T.Group();
    model.add(group);
    const scene = new T.Scene();
    scene.add(model,new T.HemisphereLight(0xe5f2ff,0x4b6082,1.65));
    const light = new T.DirectionalLight(0xf0f8ff,2.35);
    light.position.set(-3,5,6);
    scene.add(light);
    const rim = new T.DirectionalLight(0x92b8ff,1.1);
    rim.position.set(4,-2,-3);
    scene.add(rim);

    const camera = new T.OrthographicCamera(-1,1,1,-1,.01,radius*12);
    camera.position.z = radius*5;
    camera.updateMatrixWorld();
    const renderer = new T.WebGLRenderer({ alpha:true, antialias:true, powerPreference:'low-power' });
    renderer.setPixelRatio(Math.min(1.65,window.devicePixelRatio || 1));
    renderer.setClearColor(0x000000,0);
    const canvas = renderer.domElement;
    canvas.tabIndex = 0;
    canvas.setAttribute('aria-label','Вращаемая 3D-модель');
    canvas.setAttribute('aria-describedby','model3d-help');
    stage.prepend(canvas);
    const initial = new T.Quaternion().setFromEuler(new T.Euler(-Math.asin(1/Math.sqrt(3)),Math.PI/4,0,'XYZ'));
    const ray = new T.Raycaster();
    const point = new T.Vector2();
    const motion = new T.Quaternion();
    const first = new T.Vector3(), second = new T.Vector3();
    let frame = 0, contextLost = false, hovering, pending;
    const limit = (v,min,max) => Math.min(max,Math.max(min,v));
    const render = () => { if (!frame && !contextLost) frame = requestAnimationFrame(draw); };
    function setHighlight(id) {
      for (const [key,material] of Object.entries(materials)) {
        material.emissive.setHex(key === id ? 0x2dbaf0 : 0x000000);
        material.emissiveIntensity = key === id ? .7 : 0;
      }
      canvas.style.cursor = pointers.size ? 'grabbing' : (hovering ? 'pointer' : '');
    }
    function draw() {
      frame = 0;
      if (contextLost) return;
      if (pending) {
        const { x,y } = pending;
        pending = undefined;
        showHint(partAt(x,y),x,y);
      }
      setHighlight(hovering || selected);
      renderer.render(scene,camera);
    }
    function resize() {
      const width = stage.clientWidth, height = stage.clientHeight;
      if (!width || !height) return;
      renderer.setSize(width,height,false);
      const aspect = width / height, half = radius * 1.12 * Math.max(1,1/aspect);
      camera.left = -half*aspect;
      camera.right = half*aspect;
      camera.top = half;
      camera.bottom = -half;
      camera.updateProjectionMatrix();
      render();
    }
    function zoom(value) {
      camera.zoom = limit(value,.55,2.85);
      camera.updateProjectionMatrix();
      output.textContent = Math.round(camera.zoom*100) + '%';
      render();
    }
    function view(pose) {
      model.quaternion.copy(pose);
      clearHover();
      zoom(1);
    }
    function partAt(x,y) {
      const rect = canvas.getBoundingClientRect();
      if (!rect.width || !rect.height || x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return undefined;
      point.set(2*(x-rect.left)/rect.width-1,1-2*(y-rect.top)/rect.height);
      model.updateMatrixWorld(true);
      ray.setFromCamera(point,camera);
      const hit = ray.intersectObjects(pickables,false)[0] || ray.intersectObjects(apertures,false)[0];
      return hit?.object.userData.part;
    }
    function showHint(id,x,y) {
      hovering = id;
      const part = parts.get(id);
      tooltip.hidden = !part;
      if (!part) return;
      tooltip.querySelector('strong').textContent = part.textContent;
      tooltip.querySelector('span').textContent = part.dataset.description;
      const rect = stage.getBoundingClientRect();
      const dx = (x-rect.left)*stage.clientWidth/rect.width;
      const dy = (y-rect.top)*stage.clientHeight/rect.height;
      const left = limit(dx+12,8,stage.clientWidth-tooltip.offsetWidth-8);
      const top = dy+tooltip.offsetHeight+18 < stage.clientHeight ? dy+15 : dy-tooltip.offsetHeight-12;
      tooltip.style.left = left + 'px';
      tooltip.style.top = Math.max(8,top) + 'px';
    }
    function clearHover() {
      pending = undefined;
      hovering = undefined;
      tooltip.hidden = true;
      render();
    }

    const pointers = new Map();
    const position = e => ({ x:e.clientX,y:e.clientY });
    const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
    let press, moved = false;
    function ball(p,v,rect) {
      const half = Math.min(rect.width,rect.height)/2;
      const x = (p.x-rect.left-rect.width/2)/half, y = (rect.top+rect.height/2-p.y)/half;
      return v.set(x,y,Math.sqrt(Math.max(0,1-x*x-y*y))).normalize();
    }
    function rotate(previous,next) {
      const rect = canvas.getBoundingClientRect();
      motion.setFromUnitVectors(ball(previous,first,rect),ball(next,second,rect));
      model.quaternion.premultiply(motion).normalize();
      render();
    }
    canvas.onpointerdown = e => {
      if (contextLost || e.button !== 0 || pointers.size >= 2) return;
      const p = position(e);
      if (!pointers.size) { press = p; moved = false; }
      else moved = true;
      pointers.set(e.pointerId,p);
      canvas.setPointerCapture(e.pointerId);
      clearHover();
    };
    canvas.onpointermove = e => {
      if (contextLost) return;
      const next = position(e), previous = pointers.get(e.pointerId);
      if (!previous) {
        if (e.pointerType === 'mouse' && !pointers.size && !e.buttons) { pending = next; render(); }
        return;
      }
      const other = [...pointers].find(([id]) => id !== e.pointerId)?.[1];
      if (other) {
        const before = distance(previous,other), after = distance(next,other);
        if (before > 3 && after > 3) zoom(camera.zoom*after/before);
      } else if (moved || distance(press,next) > 3) {
        rotate(moved ? previous : press,next);
        moved = true;
      }
      pointers.set(e.pointerId,next);
    };
    canvas.onpointerup = e => {
      if (!pointers.delete(e.pointerId)) return;
      if (!moved && !pointers.size) {
        const id = partAt(e.clientX,e.clientY);
        if (id || selected) select(id);
        showHint(e.pointerType === 'mouse' ? id : selected,e.clientX,e.clientY);
      }
      render();
    };
    function cancelPointer(e) { if (pointers.delete(e.pointerId)) clearHover(); }
    canvas.onpointercancel = cancelPointer;
    canvas.onlostpointercapture = cancelPointer;
    canvas.onpointerleave = e => { if (e.pointerType === 'mouse' && !pointers.size) clearHover(); };
    canvas.addEventListener('wheel', e => {
      if (e.ctrlKey || e.metaKey || contextLost) return;
      e.preventDefault();
      clearHover();
      zoom(camera.zoom*Math.exp(-Math.sign(e.deltaY)*.11));
    }, { passive:false });
    const axes = {
      ArrowUp:[1,0,0,.16], ArrowDown:[1,0,0,-.16], ArrowLeft:[0,1,0,-.16], ArrowRight:[0,1,0,.16],
      q:[0,0,1,.16], e:[0,0,1,-.16],
    };
    canvas.onkeydown = e => {
      if (contextLost || e.ctrlKey || e.metaKey || e.altKey) return;
      const key = e.code === 'KeyQ' ? 'q' : e.code === 'KeyE' ? 'e' : e.key;
      const rotation = axes[key];
      if (rotation) {
        const [x,y,z,angle] = rotation;
        motion.setFromAxisAngle(first.set(x,y,z),angle);
        model.quaternion.premultiply(motion).normalize();
        clearHover();
      } else if (key === 'Home') view(initial);
      else if (key === '+' || key === '=') zoom(camera.zoom*1.2);
      else if (key === '-' || key === '−') zoom(camera.zoom/1.2);
      else if (key === 'Escape') {
        if (selected) select(selected);
        clearHover();
      } else return;
      e.preventDefault();
    };
    for (const button of controls) button.onclick = () => {
      const action = button.dataset.view;
      if (action === 'front') view(new T.Quaternion());
      else if (action === 'reset') view(initial);
      else zoom(action === 'in' ? camera.zoom*1.2 : camera.zoom/1.2);
    };
    function status(ready,message) {
      root.dataset.render = ready ? 'ready' : 'unavailable';
      loading.hidden = ready;
      if (message) loading.textContent = message;
      for (const button of controls) button.disabled = !ready;
    }
    canvas.addEventListener('webglcontextlost', e => {
      e.preventDefault();
      contextLost = true;
      pointers.clear();
      clearHover();
      status(false,'3D-вид временно недоступен. Описание частей можно открыть в списке.');
    });
    canvas.addEventListener('webglcontextrestored', () => {
      contextLost = false;
      status(true);
      resize();
    });
    highlight = () => { clearHover(); render(); };
    new ResizeObserver(resize).observe(stage);
    view(initial);
    resize();
    status(true);
  }
})();
