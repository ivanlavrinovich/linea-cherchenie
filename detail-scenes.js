(() => {
  const TAU = Math.PI * 2;
  const rectangle = (left, bottom, right, top) => [[left,bottom],[right,bottom],[right,top],[left,top]];
  const arc = (radius, start, end, segments, x = 0, y = 0) => Array.from({ length: segments + 1 }, (_, i) => {
    const angle = start + (end - start) * i / segments;
    return [x + radius * Math.cos(angle), y + radius * Math.sin(angle)];
  });
  const circle = (radius, x = 0, y = 0, segments = 48) => arc(radius, 0, TAU, segments, x, y).slice(0,-1);
  function rounded(width, height, radius) {
    const x = width / 2 - radius, y = height / 2 - radius;
    return [[x,y],[-x,y],[-x,-y],[x,-y]].flatMap(([cx,cy], i) =>
      arc(radius, i * Math.PI / 2, (i + 1) * Math.PI / 2, 8, cx, cy));
  }
  const hole = (loop, id) => ({ loop, id });
  const roundHole = (radius, x, y, id = 'holes') => hole(circle(radius,x,y,32),id);

  function factory(T, palette) {
    const group = new T.Group();
    const pickables = [];
    const apertures = [];
    const materials = {};
    const outline = new T.LineBasicMaterial({ color: 0xb3d9fa, transparent: true, opacity: .43 });
    const finish = new T.LineBasicMaterial({ color: 0xd4eaff, transparent: true, opacity: .58 });
    const invisible = new T.MeshBasicMaterial({ visible: false, side: T.DoubleSide });
    function part(parent, geometry, id) {
      materials[id] ||= new T.MeshStandardMaterial({
        color: palette[id], roughness: .62, metalness: .12, side: T.DoubleSide,
        polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1,
      });
      const mesh = new T.Mesh(geometry, materials[id]);
      mesh.userData.part = id;
      parent.add(mesh);
      pickables.push(mesh);
      return mesh;
    }
    function line(parent, points, closed = false, material = outline) {
      const geometry = new T.BufferGeometry().setFromPoints(points.map(([x,y,z]) => new T.Vector3(x,y,z)));
      const element = closed ? new T.LineLoop(geometry, material) : new T.Line(geometry, material);
      parent.add(element);
    }
    const contour = (parent, points, z) => line(parent, points.map(([x,y]) => [x,y,z]), true);
    function path(points, Constructor) {
      const shape = new Constructor();
      shape.moveTo(...points[0]);
      for (const point of points.slice(1)) shape.lineTo(...point);
      shape.closePath();
      return shape;
    }
    function face(parent, points, holes, z, id) {
      const shape = path(points,T.Shape);
      shape.holes = holes.map(loop => path(loop,T.Path));
      const geometry = new T.ShapeGeometry(shape);
      geometry.translate(0,0,z);
      part(parent,geometry,id);
    }
    function opening(parent, points, z, id) {
      const geometry = new T.ShapeGeometry(path(points,T.Shape));
      geometry.translate(0,0,z);
      const mesh = new T.Mesh(geometry,invisible);
      mesh.userData.part = id;
      parent.add(mesh);
      apertures.push(mesh);
    }
    function wall(parent, points, bottom, top, id, closed = true) {
      const positions = [];
      const end = closed ? points.length : points.length - 1;
      for (let i = 0; i < end; i++) {
        const a = points[i], b = points[(i+1) % points.length];
        positions.push(...a,bottom,...b,bottom,...b,top,...a,bottom,...b,top,...a,top);
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      geometry.computeVertexNormals();
      part(parent,geometry,id);
    }
    function plate(parent, outer, holes, bottom, top, faceId, edgeId = faceId) {
      const loops = holes.map(h => h.loop);
      face(parent,outer,loops,bottom,faceId);
      face(parent,outer,loops,top,faceId);
      wall(parent,outer,bottom,top,edgeId);
      for (const h of holes) {
        wall(parent,h.loop,bottom,top,h.id);
        opening(parent,h.loop,bottom,h.id);
        opening(parent,h.loop,top,h.id);
      }
      for (const loop of [outer,...loops]) {
        contour(parent,loop,bottom);
        contour(parent,loop,top);
      }
    }
    function box(parent, width, depth, height, x, y, z, id) {
      const geometry = new T.BoxGeometry(width,depth,height);
      const mesh = part(parent,geometry,id);
      mesh.position.set(x,y,z);
      mesh.add(new T.LineSegments(new T.EdgesGeometry(geometry),outline));
    }
    return { group, pickables, apertures, materials, part, line, contour, face, wall, opening, plate, box, finish };
  }

  function lessonAssembly(T, palette, design) {
    const scene = factory(T, { housing: 0x5c7ea8, ...palette });
    const components = [];
    const housing = component(-.85);
    function component(z, dx = 0) {
      const item = new T.Group();
      scene.group.add(item);
      components.push({ item, offset: new T.Vector3(dx, 0, z) });
      return item;
    }
    function ring(parent, outer, inner, low, high, id, extra = [], segments = 64) {
      scene.plate(parent, circle(outer, 0, 0, segments),
        [...(inner ? [roundHole(inner, 0, 0, id)] : []), ...extra], low, high, id);
    }
    function spindle(parent, radii, id) {
      const points = radii.map(([radius, z]) => new T.Vector2(radius, z));
      const geometry = new T.LatheGeometry(points, 64);
      geometry.rotateX(Math.PI / 2);
      scene.part(parent, geometry, id);
      for (const [radius, z] of radii) {
        if (radius) scene.contour(parent, circle(radius, 0, 0, 64), z);
      }
    }
    function thread(parent, radius, low, high) {
      const turns = (high - low) / .10;
      const samples = arc(radius, 0, turns * TAU, Math.ceil(turns * 24));
      scene.line(parent, samples.map(([x,y], i) => [x,y,low + (high-low)*i/(samples.length-1)]),
        false, scene.finish);
    }
    function boltCircle(count, radius, bore, id, phase = 0) {
      return Array.from({ length: count }, (_, i) => {
        const angle = phase + i * TAU / count;
        return roundHole(bore, radius*Math.cos(angle), radius*Math.sin(angle), id);
      });
    }
    const animate = design({ ...scene, housing, component, ring, spindle, thread, boltCircle });
    let distance = 0, phase = 0;
    function update() {
      for (const { item, offset } of components) item.position.set(0, 0, 0).addScaledVector(offset, distance);
      animate(phase, distance);
    }
    // Component geometry uses the assembly datum; parent groups carry only the separation offset.
    return {
      ...scene,
      assembly: {
        housing,
        spread(amount) { distance = amount; update(); },
        spin(angle) { phase = angle; update(); },
      },
    };
  }

  function fixture(T) {
    return lessonAssembly(T, { guide:0x59a8c0, pad:0xdba76b, cam:0xf3bb71, pin:0xafcce4 }, s => {
      const { housing, component, plate, box, ring, spindle } = s;
      const guide = component(.38), pad = component(.94);
      const cam = component(1.64), pin = component(2.33);
      const holes = [-1.51,1.51].flatMap(x => [-.89,.89].map(y => roundHole(.16,x,y,'housing')));
      plate(housing,rounded(3.65,2.44,.24),holes,-.65,-.35,'housing');
      for (const y of [-.70,.70]) box(guide,2.62,.27,.30,0,y,-.20,'guide');
      ring(guide,.45,.17,-.35,-.29,'guide');
      box(pad,.47,.77,.22,1.03,0,-.18,'pad');
      plate(cam,circle(.54,.23,0),[roundHole(.172,0,0,'cam')],-.29,-.05,'cam');
      spindle(pin,[[0,-.33],[.163,-.33],[.163,-.04],[.28,-.04],[.28,.13],[0,.13]],'pin');
      return (angle, spread) => {
        cam.rotation.z = angle;
        pad.position.x += (.54 + .23*Math.cos(angle) - .77) * (1-.7*spread);
      };
    });
  }

  function rotaryTable(T) {
    return lessonAssembly(T, { collar:0x64b9bd, table:0x6baef1, shaft:0xe4ad70, cap:0xc4d7e9 }, s => {
      const { housing, component, ring, spindle, boltCircle, line } = s;
      const collar = component(.4), table = component(1.26);
      const shaft = component(2.42), cap = component(3.35);
      ring(housing,1.67,.36,-.58,-.31,'housing',boltCircle(4,1.40,.13,'housing',Math.PI/4));
      ring(collar,.80,.36,-.31,.14,'collar');
      ring(table,1.56,.36,.14,.43,'table',boltCircle(6,1.10,.145,'table',Math.PI/6));
      for (let i=0; i<24; i++) {
        const angle=i*TAU/24;
        line(table,[(i%6===0 ? 1.33 : 1.42),1.52].map(r=>[r*Math.cos(angle),r*Math.sin(angle),.432]),false,s.finish);
      }
      spindle(shaft,[[0,-.64],[.343,-.64],[.343,.50],[.26,.57],[0,.57]],'shaft');
      ring(cap,.51,.347,.43,.52,'cap');
      return angle => { table.rotation.z = shaft.rotation.z = cap.rotation.z = angle; };
    });
  }

  function crossSlide(T) {
    return lessonAssembly(T, { rails:0x62a5bc, slide:0x87bbf0, screw:0xd4e0ed, wheel:0xe5ad63 }, s => {
      const { housing, component, plate, box, spindle, ring, thread } = s;
      const rails = component(.48), slide = component(1.16);
      const screw = component(.20,1.35), wheel = component(.25,2.05);
      const feet = [-1.52,1.52].flatMap(x => [-.86,.86].map(y => roundHole(.16,x,y,'housing')));
      plate(housing,rounded(3.62,2.32,.23),feet,-.67,-.39,'housing');
      for (const y of [-.66,.66]) box(rails,2.73,.32,.36,0,y,-.21,'rails');
      const outline = [[-.80,-.9],[.57,-.9],[.80,-.67],[.80,.9],[-.8,.9]];
      const slot = [...arc(.15,-Math.PI/2,Math.PI/2,12,.35,0),...arc(.15,Math.PI/2,3*Math.PI/2,12,-.35,0)];
      plate(slide,outline,[hole(slot,'slide'),...[-.60,.60].map(y=>roundHole(.13,0,y,'slide'))],-.03,.28,'slide');
      const rod = new T.Group(), handle = new T.Group();
      for (const [parent,child] of [[screw,rod],[wheel,handle]]) {
        parent.add(child);
        child.rotation.y = Math.PI/2;
        child.position.z = -.21;
      }
      spindle(rod,[[0,-1.42],[.115,-1.42],[.115,1.73],[0,1.73]],'screw');
      thread(rod,.117,-1.34,1.42);
      ring(handle,.36,.116,1.48,1.71,'wheel',[],12);
      ring(handle,.42,.116,1.71,1.86,'wheel',[],12);
      return (angle, spread) => {
        slide.position.x += .44*Math.sin(angle)*(1-.7*spread);
        rod.rotation.z = handle.rotation.z = angle;
      };
    });
  }

  function rollerBracket(T) {
    return lessonAssembly(T, { cheek:0x7ea9d5, roller:0x53b6ba, axle:0xc3d8ec, collars:0xe2af72 }, s => {
      const { housing, component, plate, ring, spindle, box, boltCircle } = s;
      const cheek = component(.6), roller = component(1.24);
      const axle = component(2.88), collars = component(3.40);
      box(housing,2.85,.35,1.78,0,-.97,0,'housing');
      const profile = [[-.87,-.795],[.87,-.795],...arc(.87,0,Math.PI,24,0,.09)];
      for (const [parent, low, high, id] of [[housing,-.78,-.54,'housing'],[cheek,.54,.78,'cheek']]) {
        plate(parent,profile,[roundHole(.21,0,.09,id)],low,high,id);
      }
      const moving = new T.Group();
      moving.position.y = .09;
      roller.add(moving);
      ring(moving,.67,.226,-.53,-.37,'roller',boltCircle(4,.46,.081,'roller'));
      ring(moving,.56,.226,-.37,.37,'roller');
      ring(moving,.67,.226,.37,.53,'roller',boltCircle(4,.46,.081,'roller'));
      const pin = new T.Group();
      pin.position.y = .09;
      axle.add(pin);
      spindle(pin,[[0,-.87],[.202,-.87],[.202,.94],[0,.94]],'axle');
      const locks = new T.Group();
      locks.position.y = .09;
      collars.add(locks);
      ring(locks,.30,.205,.78,.94,'collars',[],6);
      ring(housing,.29,.205,-.86,-.78,'housing');
      return angle => { moving.rotation.z = angle; };
    });
  }

  function keyedDrive(T) {
    return lessonAssembly(T, { bush:0x57babc, shaft:0xa4c9ed, key:0xefb26a, retainer:0x778fc5 }, s => {
      const { housing, component, plate, ring, spindle, box, boltCircle } = s;
      const bush = component(.44), shaft = component(1.60);
      const key = component(1.60), retainer = component(2.66);
      ring(housing,1.36,.91,-.52,-.22,'housing',boltCircle(4,1.12,.103,'housing',Math.PI/4));
      ring(housing,1.07,.91,-.22,.45,'housing');
      const angle = Math.asin(.115/.48);
      const slot = [...arc(.48,angle,TAU-angle,58),[.62,-.115],[.62,.115]];
      const shaftAngle = Math.asin(.108/.457);
      const shaftProfile = [...arc(.457,shaftAngle,TAU-shaftAngle,58),[.354,-.108],[.354,.108]];
      plate(bush,circle(.895),[hole(slot,'bush')],-.51,.52,'bush');
      plate(shaft,shaftProfile,[],-.61,.57,'shaft');
      spindle(shaft,[[0,-.84],[.34,-.84],[.414,-.61],[0,-.61]],'shaft');
      spindle(shaft,[[0,.57],[.423,.57],[.423,.89],[.35,1.00],[0,1.00]],'shaft');
      const keyBar = new T.Group();
      key.add(keyBar);
      box(keyBar,.253,.212,.95,.482,0,.03,'key');
      ring(retainer,1.00,.434,.52,.66,'retainer');
      return (angle, spread) => {
        bush.rotation.z = shaft.rotation.z = keyBar.rotation.z = angle;
        key.position.x = .92*T.MathUtils.smoothstep(spread,.84,1);
      };
    });
  }

  function pistonCutaway(T) {
    return lessonAssembly(T, { piston:0xe3a366, seal:0x58c4bd, rod:0xb5d5ee, cap:0x759bd0 }, s => {
      const { housing, component, plate, ring, spindle, boltCircle } = s;
      const piston = component(.94), seal = component(1.50);
      const rod = component(2.02), cap = component(3.04);
      const sector = (outer,inner) => [...arc(outer,Math.PI/2,TAU,60),...arc(inner,TAU,Math.PI/2,60)];
      ring(housing,1.27,0,-1.27,-1.05,'housing',boltCircle(4,1.02,.105,'housing',Math.PI/4));
      plate(housing,sector(1.06,.79),[],-1.05,.72,'housing');
      plate(housing,sector(1.24,1.06),[],.49,.72,'housing');
      ring(piston,.75,.25,-.51,-.33,'piston');
      ring(piston,.68,.25,-.33,-.18,'piston');
      ring(piston,.75,.25,-.18,.02,'piston');
      ring(seal,.775,.681,-.32,-.19,'seal');
      spindle(rod,[[0,-.57],[.241,-.57],[.241,1.31],[.20,1.43],[0,1.43]],'rod');
      ring(cap,1.24,.255,.72,.91,'cap',boltCircle(4,1.03,.10,'cap',Math.PI/4));
      return (angle, spread) => {
        const stroke = .32*Math.sin(angle)*(1-.7*spread);
        for (const moving of [piston,seal,rod]) moving.position.z += stroke;
      };
    });
  }

  function twinStudJoint(T) {
    return lessonAssembly(T, { gasket:0x60babc, cover:0x83b7e8, studs:0xaac9df, washers:0xd0daeb, nuts:0xe7ac69 }, s => {
      const { housing, component, plate, ring, spindle, thread } = s;
      const gasket = component(.45), cover = component(1.02);
      const studs = component(1.95), washers = component(2.63), nuts = component(3.35);
      const holes = (radius,id) => [-1.07,1.07].map(x => roundHole(radius,x,0,id));
      const profile = rounded(3.44,2.02,.32);
      plate(housing,profile,holes(.184,'housing'),-.89,-.32,'housing');
      plate(gasket,profile,holes(.207,'gasket'),-.32,-.26,'gasket');
      plate(cover,profile,holes(.207,'cover'),-.26,.02,'cover');
      const nutGroups = [];
      for (const x of [-1.07,1.07]) {
        const stud = new T.Group(), washer = new T.Group(), nut = new T.Group();
        for (const [parent,part] of [[studs,stud],[washers,washer],[nuts,nut]]) {
          parent.add(part);
          part.position.x = x;
        }
        spindle(stud,[[0,-.83],[.175,-.83],[.175,.51],[.144,.55],[0,.55]],'studs');
        thread(stud,.179,-.81,-.33);
        thread(stud,.179,.02,.52);
        ring(washer,.32,.20,.02,.10,'washers');
        ring(nut,.33,.185,.10,.34,'nuts',[],6);
        nutGroups.push(nut);
      }
      return angle => {
        const turn = .8*(1-Math.cos(angle));
        for (const nut of nutGroups) {
          nut.rotation.z = turn;
          nut.position.z = .10*turn/TAU;
        }
      };
    });
  }

  function planetary(T) {
    const scene = factory(T, { housing: 0x6983aa, sun: 0x45bafa, planets: 0xe5a059, carrier: 0x3e9d9c, shafts: 0xaac4df });
    const { group, plate, materials } = scene;
    function layer(parent = group) {
      const item = new T.Group();
      parent.add(item);
      return item;
    }
    function teeth(count, root, tip, phase = 0) {
      return Array.from({ length: count }, (_, index) =>
        [[-.5, root], [-.30, root], [-.17, tip], [.17, tip], [.30, root]].map(([step, radius]) => {
          const angle = phase + (index + step) * TAU / count;
          return [radius * Math.cos(angle), radius * Math.sin(angle)];
        })).flat();
    }
    const housing = layer();
    const flangeHoles = Array.from({ length: 8 }, (_, index) => {
      const angle = index * TAU / 8;
      return roundHole(.09, 2.10 * Math.cos(angle), 2.10 * Math.sin(angle), 'housing');
    });
    plate(housing, circle(2.30, 0, 0, 96), [roundHole(1.91, 0, 0, 'housing'), ...flangeHoles], -.82, -.60, 'housing');
    plate(housing, circle(2.00, 0, 0, 96), [hole(teeth(48, 1.88, 1.735), 'housing')], -.60, .28, 'housing');
    plate(housing, circle(2.07, 0, 0, 96), [roundHole(1.91, 0, 0, 'housing')], .28, .37, 'housing');

    const sun = layer();
    plate(sun, teeth(24, .82, .958), [], -.21, .22, 'sun');
    plate(sun, circle(.30), [], .22, .46, 'sun');
    plate(sun, circle(.21), [], .46, .87, 'shafts');
    plate(sun, circle(.235, 0, 0, 6), [], .87, .96, 'shafts');

    const carrier = layer();
    const planets = layer();
    const orbit = 1.35;
    const gears = [];
    const carrierProfile = [];
    for (let index = 0; index < 3; index++) {
      const angle = index * TAU / 3;
      const x = orbit * Math.cos(angle), y = orbit * Math.sin(angle);
      carrierProfile.push(...arc(.25, angle - Math.PI / 3, angle + Math.PI / 3, 10, x, y));
      const gear = layer(planets);
      gear.position.set(x, y, 0);
      plate(gear, teeth(12, .37, .508, Math.PI / 12), [roundHole(.155, 0, 0, 'planets')], -.21, .22, 'planets');
      const pin = layer(carrier);
      pin.position.set(x, y, 0);
      plate(pin, circle(.143), [], -.42, .23, 'shafts');
      plate(pin, circle(.197), [], .23, .30, 'shafts');
      plate(pin, circle(.113, 0, 0, 6), [], .30, .35, 'shafts');
      gears.push(gear);
    }
    plate(carrier, carrierProfile, [roundHole(.16, 0, 0, 'carrier')], -.62, -.42, 'carrier');
    plate(carrier, circle(.34), [], -.84, -.62, 'carrier');
    plate(carrier, circle(.23), [], -1.16, -.84, 'shafts');
    for (const material of Object.values(materials)) {
      material.roughness = .42;
      material.metalness = .24;
    }
    return {
      ...scene,
      assembly: {
        housing,
        spread(amount) {
          housing.position.z = -1.10 * amount;
          carrier.position.z = -2.55 * amount;
          planets.position.z = .78 * amount;
          sun.position.z = 2.50 * amount;
          gears.forEach((gear, index) => {
            const direction = index * TAU / 3;
            const distance = orbit + .30 * amount;
            gear.position.set(distance * Math.cos(direction), distance * Math.sin(direction), 0);
          });
        },
        spin(angle) {
          sun.rotation.z = angle;
          carrier.rotation.z = planets.rotation.z = angle / 3;
          for (const gear of gears) gear.rotation.z = -4 * angle / 3;
        },
      },
    };
  }

  const models = { plate: fixture, flange: rotaryTable, step: crossSlide, bracket: rollerBracket, bushing: keyedDrive, cutaway: pistonCutaway, stud: twinStudJoint, planetary };
  window.lineaModelScene = (key, three) => models[key](three);
})();
