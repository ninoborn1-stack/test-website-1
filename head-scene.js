/* head-scene.js — ES Module
 * Partikelkopf mit Mouse-Interaktion:
 *   - Maus über Canvas → Partikel sammeln sich zur Maus
 *   - Maus weg         → Partikel federn zurück zum Kopf
 */
import * as THREE from 'three';
import { GLTFLoader } from './GLTFLoader.js';

(function initHeadScene() {
  const headCanvas = document.getElementById('about-canvas');
  if (!headCanvas) return;

  const headScene  = new THREE.Scene();
  const headCamera = new THREE.PerspectiveCamera(
    36, headCanvas.clientWidth / headCanvas.clientHeight, 0.1, 100
  );
  headCamera.position.set(0, 0.05, 3.5);

  const headRenderer = new THREE.WebGLRenderer({ canvas: headCanvas, antialias: true, alpha: true });
  headRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  headRenderer.setSize(headCanvas.clientWidth, headCanvas.clientHeight);

  /* Shader */
  const headMat = new THREE.ShaderMaterial({
    uniforms: { uOpacity: { value: 0.0 } },
    vertexShader: [
      'varying float vFacing;',
      'varying float vDepth;',
      'void main() {',
      '  vec3 wNorm  = normalize(normalMatrix * normal);',
      '  vec3 wPos   = (modelMatrix * vec4(position, 1.0)).xyz;',
      '  vFacing     = dot(wNorm, normalize(cameraPosition - wPos));',
      '  vec4 mvPos  = modelViewMatrix * vec4(position, 1.0);',
      '  gl_Position = projectionMatrix * mvPos;',
      '  float depth = max(-mvPos.z, 0.5);',
      '  vDepth      = depth;',
      '  gl_PointSize = clamp((2.8 + vFacing * 1.4) * 3.2 / depth, 1.0, 8.0);',
      '}'
    ].join('\n'),
    fragmentShader: [
      'uniform float uOpacity;',
      'varying float vFacing;',
      'varying float vDepth;',
      'void main() {',
      '  if (length(gl_PointCoord - 0.5) > 0.5) discard;',
      '  if (vFacing <= 0.0) discard;',
      '  float fade   = smoothstep(0.0, 0.15, vFacing);',
      '  float depthFade = clamp(1.0 - (vDepth - 2.8) * 0.35, 0.35, 1.0);',
      '  float bright = clamp(0.35 + vFacing * 0.65, 0.0, 1.0) * depthFade;',
      '  gl_FragColor = vec4(0.784 * bright, 0.941 * bright, 0.314 * bright, fade * uOpacity);',
      '}'
    ].join('\n'),
    transparent: true,
    depthWrite: true,
    depthTest: true
  });

  /* Area-weighted Surface Sampling */
  function sampleMesh(gltfScene, count) {
    const tris = [];
    gltfScene.traverse(obj => {
      if (!obj.isMesh) return;
      const geo  = obj.geometry;
      const posA = geo.attributes.position;
      const nrmA = geo.attributes.normal;
      if (!posA || !nrmA) return;
      obj.updateWorldMatrix(true, false);
      const mat  = obj.matrixWorld;
      const nMat = new THREE.Matrix3().getNormalMatrix(mat);
      const triCount = geo.index ? geo.index.count / 3 : posA.count / 3;
      for (let t = 0; t < triCount; t++) {
        let ia, ib, ic;
        if (geo.index) { ia = geo.index.getX(t*3); ib = geo.index.getX(t*3+1); ic = geo.index.getX(t*3+2); }
        else { ia = t*3; ib = t*3+1; ic = t*3+2; }
        const av = new THREE.Vector3(posA.getX(ia), posA.getY(ia), posA.getZ(ia)).applyMatrix4(mat);
        const bv = new THREE.Vector3(posA.getX(ib), posA.getY(ib), posA.getZ(ib)).applyMatrix4(mat);
        const cv = new THREE.Vector3(posA.getX(ic), posA.getY(ic), posA.getZ(ic)).applyMatrix4(mat);
        const an = new THREE.Vector3(nrmA.getX(ia), nrmA.getY(ia), nrmA.getZ(ia)).applyMatrix3(nMat).normalize();
        const bn = new THREE.Vector3(nrmA.getX(ib), nrmA.getY(ib), nrmA.getZ(ib)).applyMatrix3(nMat).normalize();
        const cn = new THREE.Vector3(nrmA.getX(ic), nrmA.getY(ic), nrmA.getZ(ic)).applyMatrix3(nMat).normalize();
        const area = bv.clone().sub(av).cross(cv.clone().sub(av)).length() * 0.5;
        if (area < 1e-10) continue;
        tris.push({ av, bv, cv, an, bn, cn, area });
      }
    });
    if (!tris.length) return null;
    let total = 0;
    const cdf  = tris.map(t => { total += t.area; return total; });
    const cdfN = cdf.map(v => v / total);
    function pick() {
      const r = Math.random(); let lo = 0, hi = tris.length - 1;
      while (lo < hi) { const m = (lo+hi)>>1; cdfN[m] < r ? lo = m+1 : hi = m; }
      return lo;
    }
    const Y_MIN = -0.20;
    const rawPts = [], rawNrm = [];
    for (let i = 0; i < count * 6 && rawPts.length / 3 < count; i++) {
      const tri = tris[pick()];
      const r1 = Math.sqrt(Math.random()), r2 = Math.random();
      const u = 1-r1, v = r1*(1-r2), w = r1*r2;
      const py = u*tri.av.y + v*tri.bv.y + w*tri.cv.y;
      if (py < Y_MIN) continue;
      rawPts.push(u*tri.av.x + v*tri.bv.x + w*tri.cv.x, py, u*tri.av.z + v*tri.bv.z + w*tri.cv.z);
      const nx = u*tri.an.x + v*tri.bn.x + w*tri.cn.x;
      const ny = u*tri.an.y + v*tri.bn.y + w*tri.cn.y;
      const nz = u*tri.an.z + v*tri.bn.z + w*tri.cn.z;
      const nl = Math.sqrt(nx*nx + ny*ny + nz*nz) || 1;
      rawNrm.push(nx/nl, ny/nl, nz/nl);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(rawPts), 3));
    geo.setAttribute('normal',   new THREE.BufferAttribute(new Float32Array(rawNrm), 3));
    return geo;
  }

  /* Occluder-Material */
  const occluderMat = new THREE.MeshBasicMaterial({ colorWrite: false, side: THREE.FrontSide });

  /* State */
  let headGroup  = null;
  let headPoints = null;
  let origPos    = null; // Float32Array — Ruhe-Positionen
  let curPos     = null; // Float32Array — aktuelle Positionen
  let vel        = null; // Float32Array — Geschwindigkeiten
  let swarmOff   = null; // Float32Array — zufälliger Offset pro Partikel im Schwarm
  let followK    = null; // Float32Array — individuelle Spring-Stärke pro Partikel
  let isTail     = null; // Float32Array — 1 = Schweif-Partikel
  let tailDist   = null; // Float32Array — 0=Mausspitze, 1=max. dahinter
  let occluders  = [];

  /* Mouse-Velocity für Schweif */
  let mousePrevLocal = null;
  const mouseVelLocal = { x: 0, y: 0, z: 0 };

  /* Mouse-Tracking */
  let mouseNDC  = null; // {x, y} in NDC, null wenn außerhalb
  const _mWorld = new THREE.Vector3();
  const _invMat = new THREE.Matrix4();

  /* Puls-Stoßwelle bei Klick */
  let pulseStartT  = -99;
  const pulseOriginL = { x: 0, y: 0, z: 0 };

  headCanvas.addEventListener('mousemove', e => {
    const r = headCanvas.getBoundingClientRect();
    mouseNDC = {
      x:  ((e.clientX - r.left) / r.width)  * 2 - 1,
      y: -((e.clientY - r.top)  / r.height) * 2 + 1
    };
  });
  headCanvas.addEventListener('mouseleave', () => { mouseNDC = null; });

  headCanvas.addEventListener('click', () => {
    if (!mouseNDC || !headGroup) return;
    const halfH = headCamera.position.z * Math.tan(THREE.MathUtils.degToRad(headCamera.fov * 0.5));
    const halfW = halfH * headCamera.aspect;
    _mWorld.set(mouseNDC.x * halfW, headCamera.position.y + mouseNDC.y * halfH, 0);
    _invMat.copy(headGroup.matrixWorld).invert();
    _mWorld.applyMatrix4(_invMat);
    pulseOriginL.x = _mWorld.x;
    pulseOriginL.y = _mWorld.y;
    pulseOriginL.z = _mWorld.z;
    pulseStartT = headClock.getElapsedTime();
  });

  /* GLB laden */
  const loader = new GLTFLoader();
  loader.load('head.glb',
    (gltf) => {
      const box    = new THREE.Box3().setFromObject(gltf.scene);
      const center = box.getCenter(new THREE.Vector3());
      const size   = box.getSize(new THREE.Vector3());
      const scale  = 2.4 / Math.max(size.x, size.y, size.z);

      gltf.scene.position.sub(center);
      gltf.scene.scale.setScalar(scale);
      gltf.scene.updateWorldMatrix(true, true);

      const geo = sampleMesh(gltf.scene, 14000);
      if (!geo) return;

      /* Visuellen Mittelpunkt der gecropten Punkte berechnen → Kamera zentrieren */
      const pts = geo.attributes.position.array;
      let minY = Infinity, maxY = -Infinity;
      for (let i = 1; i < pts.length; i += 3) { minY = Math.min(minY, pts[i]); maxY = Math.max(maxY, pts[i]); }
      const visualCenterY = (minY + maxY) * 0.5;
      headCamera.position.y = visualCenterY;
      window.headCameraY = visualCenterY;

      headGroup = new THREE.Group();
      headScene.add(headGroup);

      /* Occluder-Meshes */
      occluders = [];
      gltf.scene.traverse(obj => {
        if (!obj.isMesh) return;
        const occ = new THREE.Mesh(obj.geometry, occluderMat);
        occ.applyMatrix4(obj.matrixWorld);
        occ.renderOrder = 0;
        headGroup.add(occ);
        occluders.push(occ);
      });

      /* Partikel */
      origPos = new Float32Array(geo.attributes.position.array);
      curPos  = new Float32Array(origPos);
      vel     = new Float32Array(origPos.length);

      /* Schwarm-Offsets: jeder Partikel hat einen festen zufälligen Abstand
         zur Mausposition — bildet eine lose Wolke die der Maus folgt */
      const pCount = origPos.length / 3;
      swarmOff = new Float32Array(origPos.length);
      followK  = new Float32Array(pCount);
      isTail   = new Float32Array(pCount);
      tailDist = new Float32Array(pCount);
      for (let i = 0; i < pCount; i++) {
        const theta = Math.random() * Math.PI * 2;
        const phi   = Math.acos(2 * Math.random() - 1);
        const r     = 0.4 + Math.random() * 1.9; // breiter Schwarm 0.4–2.3
        swarmOff[i*3]   = r * Math.sin(phi) * Math.cos(theta);
        swarmOff[i*3+1] = r * Math.sin(phi) * Math.sin(theta) * 1.4;
        swarmOff[i*3+2] = r * Math.cos(phi) * 0.3;

        // 20% träge Nachzügler, 80% normale Folger (langsamer für sanften Flug)
        followK[i] = Math.random() < 0.2
          ? 0.001 + Math.random() * 0.002
          : 0.003 + Math.random() * 0.005;

        // 28% Schweif-Partikel (sehr langsam, folgen hinter der Maus)
        isTail[i] = Math.random() < 0.28 ? 1 : 0;
        tailDist[i] = Math.random(); // 0=Spitze(Maus), 1=Ende
      }

      headPoints = new THREE.Points(geo, headMat);
      headPoints.renderOrder = 1;
      headGroup.add(headPoints);

      window.gsap.to(headMat.uniforms.uOpacity, { value: 1.0, duration: 1.8, ease: 'power2.out' });
    },
    undefined,
    (err) => console.error('GLB load error:', err)
  );

  window.addEventListener('resize', () => {
    const w = headCanvas.clientWidth, h = headCanvas.clientHeight;
    headCamera.aspect = w / h;
    headCamera.updateProjectionMatrix();
    headRenderer.setSize(w, h);
  });

  /* Animation Loop */
  const headClock = new THREE.Clock();
  (function animateHead() {
    requestAnimationFrame(animateHead);
    const t = headClock.getElapsedTime();

    if (headGroup) {
      if (!mouseNDC) {
        headGroup.rotation.y = t * 0.28;
        headGroup.rotation.x = Math.sin(t * 0.15) * 0.05;
      } else {
        headGroup.rotation.y = 0;
        headGroup.rotation.x = 0;
      }
      headGroup.updateMatrixWorld();
    }

    /* Partikel-Physik */
    if (origPos && headGroup && headPoints) {
      const posAttr = headPoints.geometry.attributes.position;
      const isHovering = !!mouseNDC;


      /* Occluder nur aktiv wenn kein Hover */
      occluders.forEach(o => { o.visible = !isHovering; });


      let mLx = 0, mLy = 0, mLz = 0;
      if (isHovering) {
        /* Mausposition → Welt-Z=0-Ebene → Group-Local */
        const halfH = headCamera.position.z * Math.tan(THREE.MathUtils.degToRad(headCamera.fov * 0.5));
        const halfW = halfH * headCamera.aspect;
        _mWorld.set(mouseNDC.x * halfW, headCamera.position.y + mouseNDC.y * halfH, 0);
        _invMat.copy(headGroup.matrixWorld).invert();
        _mWorld.applyMatrix4(_invMat);
        mLx = _mWorld.x; mLy = _mWorld.y; mLz = _mWorld.z;

        /* Mouse-Velocity tracken (geglättet) */
        if (mousePrevLocal) {
          mouseVelLocal.x = mouseVelLocal.x * 0.75 + (mLx - mousePrevLocal.x) * 0.25;
          mouseVelLocal.y = mouseVelLocal.y * 0.75 + (mLy - mousePrevLocal.y) * 0.25;
        }
        mousePrevLocal = { x: mLx, y: mLy, z: mLz };
      } else {
        /* Velocity abklingen lassen */
        mouseVelLocal.x *= 0.88;
        mouseVelLocal.y *= 0.88;
        mousePrevLocal = null;
      }

      /* Puls-Welle vorberechnen */
      const pAge  = t - pulseStartT;
      const waveR = pAge * 2.4;
      const pulseBW = 0.45;

      const count = origPos.length / 3;
      for (let i = 0; i < count; i++) {
        const ix = i*3, iy = ix+1, iz = ix+2;

        /* Zielposition: Schweif hinter Maus, Rest Schwarm, sonst Original */
        let tx, ty, tz;
        if (isHovering) {
          if (isTail[i]) {
            // Schweif: hinter der Mausbewegung + kleiner Offset
            const ts = 18.0 * tailDist[i]; // 0=Mausspitze, 1=Ende
            tx = mLx - mouseVelLocal.x * ts + swarmOff[ix] * 0.65;
            ty = mLy - mouseVelLocal.y * ts + swarmOff[iy] * 0.65;
            tz = mLz + swarmOff[iz] * 0.35;
          } else {
            tx = mLx + swarmOff[ix];
            ty = mLy + swarmOff[iy];
            tz = mLz + swarmOff[iz];
          }
        } else {
          tx = origPos[ix]; ty = origPos[iy]; tz = origPos[iz];
        }

        /* Spring-Kraft — langsam raus, etwas schneller zurück */
        const k = isHovering ? followK[i] : followK[i] * 3.5;
        vel[ix] += (tx - curPos[ix]) * k;
        vel[iy] += (ty - curPos[iy]) * k;
        vel[iz] += (tz - curPos[iz]) * k * 0.5;

        /* Zusätzliche Anziehung zur Mausmitte — nur für normale Partikel */
        if (isHovering && !isTail[i]) {
          vel[ix] += (mLx - curPos[ix]) * 0.005;
          vel[iy] += (mLy - curPos[iy]) * 0.005;
        }

        /* Jitter — unabhängiges Zappeln im Schwarm-Modus */
        if (isHovering) {
          vel[ix] += (Math.random() - 0.5) * 0.012;
          vel[iy] += (Math.random() - 0.5) * 0.012;
          vel[iz] += (Math.random() - 0.5) * 0.005;

          /* Rand-Abstoßung: dynamisch aus Kamera-FOV berechnet */
          const halfH = headCamera.position.z * Math.tan(THREE.MathUtils.degToRad(headCamera.fov * 0.5));
          const halfW = halfH * headCamera.aspect;
          const BX = halfW * 0.96, BY = halfH * 0.96, BZ = 0.55;
          const cY = headCamera.position.y;
          const margin = 0.12, repK = 0.22;
          const ox  = BX - Math.abs(curPos[ix]);
          const oy  = BY - Math.abs(curPos[iy] - cY);
          const oz  = BZ - Math.abs(curPos[iz]);
          if (ox < margin) vel[ix] += (curPos[ix] > 0 ? -1 : 1) * (margin - ox) / margin * repK;
          if (oy < margin) vel[iy] += ((curPos[iy] - cY) > 0 ? -1 : 1) * (margin - oy) / margin * repK;
          if (oz < margin) vel[iz] += (curPos[iz] > 0 ? -1 : 1) * (margin - oz) / margin * repK * 0.5;
        }

        /* Puls-Stoßwelle: Wellenring breitet sich vom Klick-Punkt aus */
        if (pAge >= 0 && pAge < 2.2) {
          const dx = curPos[ix] - pulseOriginL.x;
          const dy = curPos[iy] - pulseOriginL.y;
          const dz = curPos[iz] - pulseOriginL.z;
          const dist = Math.sqrt(dx*dx + dy*dy + dz*dz) || 1e-6;
          const diff = Math.abs(dist - waveR);
          if (diff < pulseBW) {
            const strength = (1 - diff / pulseBW) * 0.08;
            vel[ix] += (dx / dist) * strength;
            vel[iy] += (dy / dist) * strength;
            vel[iz] += (dz / dist) * strength * 0.5;
          }
        }

        /* Dämpfung */
        vel[ix] *= 0.78;
        vel[iy] *= 0.78;
        vel[iz] *= 0.78;

        curPos[ix] += vel[ix];
        curPos[iy] += vel[iy];
        curPos[iz] += vel[iz];
      }

      posAttr.array.set(curPos);
      posAttr.needsUpdate = true;
    }

    headRenderer.render(headScene, headCamera);
  })();

  window.ScrollTrigger.create({
    trigger: '#about',
    start: 'top 70%',
    onEnter: () => {
      headMat.uniforms.uOpacity.value = 0;
      window.gsap.to(headMat.uniforms.uOpacity, { value: 1.0, duration: 1.8, ease: 'power2.out' });
      if (headGroup) {
        window.gsap.fromTo(headGroup.scale,
          { x: 0.7, y: 0.7, z: 0.7 },
          { x: 1, y: 1, z: 1, duration: 1.5, ease: 'back.out(1.3)' }
        );
      }
    },
    once: true
  });
})();
