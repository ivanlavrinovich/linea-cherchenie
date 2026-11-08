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

  function mountingPlate(T) {
    const scene = factory(T,{ face:0x80b7ea, edge:0x526f98, holes:0x438ba7 });
    const fasteners = [-1.18,1.18].flatMap(x => [-.69,.69].map(y => roundHole(.21,x,y)));
    scene.plate(scene.group,rounded(3.35,2.24,.23),fasteners,-.23,.23,'face','edge');
    return scene;
  }
  function flange(T) {
    const scene = factory(T,{ disk:0x6597ce, hub:0x79c8ea, bore:0x48789f, holes:0x4fadc2 });
    const {group,face,wall,contour,opening} = scene;
    const outer = circle(1.57), bore = circle(.42), hub = circle(.73);
    const bolts = [Math.PI/2,Math.PI/2 + TAU/3,Math.PI/2 + 2*TAU/3].map(a =>
      roundHole(.175,1.09*Math.cos(a),1.09*Math.sin(a)));
    face(group,outer,[bore,...bolts.map(h=>h.loop)],-.39,'disk');
    face(group,outer,[hub,...bolts.map(h=>h.loop)],.10,'disk');
    wall(group,outer,-.39,.10,'disk');
    wall(group,hub,.10,.64,'hub');
    face(group,hub,[bore],.64,'hub');
    wall(group,bore,-.39,.64,'bore');
    opening(group,bore,-.39,'bore');
    opening(group,bore,.64,'bore');
    for (const h of bolts) {
      wall(group,h.loop,-.39,.10,h.id);
      contour(group,h.loop,-.39);
      contour(group,h.loop,.10);
      opening(group,h.loop,-.39,h.id);
      opening(group,h.loop,.10,h.id);
    }
    for (const [loop,z] of [[outer,-.39],[outer,.10],[hub,.10],[hub,.64],[bore,-.39],[bore,.64]]) contour(group,loop,z);
    return scene;
  }
  function steppedSupport(T) {
    const scene = factory(T,{ base:0x6099d1, step:0x9ac8ee, slot:0x43829f });
    const profile = [[-1.63,-1.02],[1.32,-1.02],[1.63,-.71],[1.63,1.02],[-1.63,1.02]];
    const slot = [...arc(.235,-Math.PI/2,Math.PI/2,14,.65,-.34),...arc(.235,Math.PI/2,3*Math.PI/2,14,-.56,-.34)];
    scene.plate(scene.group,profile,[hole(slot,'slot')],-.63,-.07,'base');
    scene.box(scene.group,2.63,.81,.98,-.02,.61,.42,'step');
    return scene;
  }
  function bracket(T) {
    const scene = factory(T,{ foot:0x638fc5, wall:0x92bde7, rib:0x55b8cb, holes:0x4487a0 });
    scene.plate(scene.group,rounded(3.0,2.2,.18),[-.94,.94].map(x=>roundHole(.225,x,-.49)),-.83,-.52,'foot');
    scene.box(scene.group,3,.34,1.86,0,.91,.41,'wall');
    const rib = new T.Group();
    scene.group.add(rib);
    rib.rotation.y = -Math.PI/2;
    scene.plate(rib,[[-.52,-.82],[-.52,.74],[1.13,.74]],[],-.15,.15,'rib');
    return scene;
  }
  function bushing(T) {
    const scene = factory(T,{ shell:0x5e98cf, end:0x9ecaf2, bore:0x507da7, keyway:0x53b8cf });
    const {group,face,wall,contour} = scene;
    const outer = circle(1.13), radius = .59, half = .16;
    const angle = Math.asin(half/radius);
    const curvedBore = arc(radius,angle,TAU-angle,48);
    const key = [curvedBore.at(-1),[.83,-half],[.83,half],curvedBore[0]];
    const opening = [...curvedBore,...key.slice(1,-1)];
    for (const z of [-.83,.83]) {
      face(group,outer,[opening],z,'end');
      contour(group,outer,z);
      contour(group,opening,z);
      scene.opening(group,opening,z,'bore');
    }
    wall(group,outer,-.83,.83,'shell');
    wall(group,curvedBore,-.83,.83,'bore',false);
    wall(group,key,-.83,.83,'keyway',false);
    for (const [x,y] of key) scene.line(group,[[x,y,-.83],[x,y,.83]]);
    return scene;
  }
  function cutaway(T) {
    const scene = factory(T,{ shell:0x679dd1, cut:0x83c5d6, bore:0x517fad, seat:0xb0d7f0 });
    const {group,part,line} = scene;
    const profile = [[.49,-1.0],[1.34,-1.0],[1.34,.65],[1.19,.94],[.82,.94],[.82,.16],[.49,.16]];
    const ids = ['shell','shell','shell','shell','bore','seat','bore'];
    const start = 3*Math.PI/2, end = 3*Math.PI, slices = 48;
    const sample = (r,z,a) => [r*Math.cos(a),r*Math.sin(a),z];
    for (let i = 0; i < profile.length; i++) {
      const [r,z] = profile[i], [s,w] = profile[(i+1)%profile.length];
      const positions = [];
      for (let j = 0; j < slices; j++) {
        const a = start+(end-start)*j/slices, b = start+(end-start)*(j+1)/slices;
        const v0=sample(r,z,a),v1=sample(r,z,b),v2=sample(s,w,b),v3=sample(s,w,a);
        positions.push(...v0,...v1,...v2,...v0,...v2,...v3);
      }
      const geometry = new T.BufferGeometry();
      geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
      geometry.computeVertexNormals();
      part(group,geometry,ids[i]);
      line(group,arc(r,start,end,slices).map(([x,y])=>[x,y,z]));
    }
    for (const angle of [start,end]) {
      const geometry = new T.ShapeGeometry(new T.Shape(profile.map(([r,z])=>new T.Vector2(r,z))));
      const coordinates = geometry.getAttribute('position');
      for (let i = 0; i < coordinates.count; i++) coordinates.setXYZ(i,...sample(coordinates.getX(i),coordinates.getY(i),angle));
      geometry.computeVertexNormals();
      part(group,geometry,'cut');
      line(group,profile.map(([r,z])=>sample(r,z,angle)),true);
    }
    return scene;
  }
  function studJoint(T) {
    const scene = factory(T,{ housing:0x5c88bc, cover:0x79a9df, stud:0x90bddf, washer:0x67becf, nut:0xadcce8 });
    const {group,face,wall,contour,plate,line,finish} = scene;
    const body = rounded(2.52,1.98,.22), bottomBore = circle(.232);
    face(group,body,[],-1.42,'housing');
    face(group,body,[bottomBore],-.82,'housing');
    wall(group,body,-1.42,-.82,'housing');
    wall(group,bottomBore,-1.28,-.82,'housing');
    face(group,bottomBore,[],-1.28,'housing');
    contour(group,body,-1.42);
    contour(group,body,-.82);
    contour(group,bottomBore,-.82);
    plate(group,rounded(2.28,1.74,.20),[roundHole(.29,0,0,'cover')],-.55,-.30,'cover');
    plate(group,circle(.61),[roundHole(.27,0,0,'washer')],.02,.125,'washer');
    plate(group,circle(.48,0,0,6),[roundHole(.238,0,0,'nut')],.47,.82,'nut');
    plate(group,circle(.208),[],-1.19,1.15,'stud');
    for (const [low,high] of [[-1.16,-.76],[.37,1.12]]) {
      const length = high-low;
      const turns = length / .09;
      const thread = arc(.213,0,turns*TAU,Math.ceil(turns*20)).map(([x,y],i,points)=>[x,y,low+length*i/(points.length-1)]);
      line(group,thread,false,finish);
    }
    return scene;
  }

  const models = { plate: mountingPlate, flange, step: steppedSupport, bracket, bushing, cutaway, stud: studJoint };
  window.lineaModelScene = (key, three) => models[key](three);
})();
