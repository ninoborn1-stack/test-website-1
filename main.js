import * as THREE from 'three';

/* ============================================================
   MAIN.JS
   Drei Module:
   1. Custom Cursor + Dot-Navigation
   2. Three.js Hero-Canvas (Partikel + Wireframe-Ikosaeder)
   3. GSAP Animationen (Intro + ScrollTrigger Reveals)
   4. SVG-Animationen (About-Kreis, Skills-Radial)
   5. Project Cards Mouse-Tracking
   ============================================================ */

/* ============================================================
   1. SETUP — GSAP Plugin registrieren
   ScrollTrigger ist ein GSAP-Plugin und muss einmalig
   registriert werden bevor es verwendet werden kann.
   ============================================================ */
gsap.registerPlugin(ScrollTrigger);


/* ============================================================
   2. CUSTOM CURSOR
   Liest die Mausposition und verschiebt das Cursor-Element.
   "mix-blend-mode: difference" im CSS macht den Effekt
   dass der Cursor helle Elemente invertiert.
   ============================================================ */
const cursor = document.getElementById('cursor');

let mouseX = 0;
let mouseY = 0;
let cursorX = 0;
let cursorY = 0;

// Mausposition tracken
document.addEventListener('mousemove', (e) => {
  mouseX = e.clientX;
  mouseY = e.clientY;
});


/* ============================================================
   3. DOT NAVIGATION
   Klick auf Dot = smooth scroll zur Sektion.
   ScrollTrigger aktualisiert den aktiven Dot automatisch.
   ============================================================ */
const dotItems = document.querySelectorAll('.dot-nav__item');

dotItems.forEach(dot => {
  dot.addEventListener('click', () => {
    const targetId = dot.dataset.target;
    document.getElementById(targetId)?.scrollIntoView({ behavior: 'smooth' });
  });
});

// Aktiven Dot per IntersectionObserver setzen
// (welche Sektion ist gerade im Viewport sichtbar?)
const sections = document.querySelectorAll('section');

const sectionObserver = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      const id = entry.target.id;
      dotItems.forEach(dot => {
        dot.classList.toggle('active', dot.dataset.target === id);
      });
    }
  });
}, { threshold: 0.5 }); // 50% der Sektion muss sichtbar sein

sections.forEach(s => sectionObserver.observe(s));

/* ============================================================
   4. THREE.JS HERO CANVAS
   Was passiert hier:
   - Eine THREE.Scene ist der "Raum" in dem alles existiert
   - THREE.PerspectiveCamera ist unser "Auge" in diesem Raum
   - THREE.WebGLRenderer zeichnet alles auf den Canvas

   Objekte:
   A) Partikel-Feld: 3000 zufällig platzierte Punkte
   B) Wireframe-Ikosaeder: geometrisches 3D-Objekt in der Mitte
   ============================================================ */

const canvas = document.getElementById('hero-canvas');
const scene  = new THREE.Scene();

// PerspectiveCamera(FOV, Seitenverhältnis, NearPlane, FarPlane)
// FOV = Field of View (Sichtfeld in Grad)
const camera = new THREE.PerspectiveCamera(
  60,
  canvas.clientWidth / canvas.clientHeight,
  0.1,
  1000
);
camera.position.z = 5;

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: true,
  alpha: true   // transparenter Hintergrund → CSS-Hintergrund scheint durch
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2)); // max 2x für Performance
renderer.setSize(canvas.clientWidth, canvas.clientHeight);

/* ---- A) Partikel-Feld ---- */

// BufferGeometry ist die effizienteste Art viele Punkte darzustellen.
// Wir füllen ein Float32Array mit x,y,z Koordinaten (3 Werte pro Partikel).
const PARTICLE_COUNT = 6000;
const positions = new Float32Array(PARTICLE_COUNT * 3);

for (let i = 0; i < PARTICLE_COUNT; i++) {
  positions[i * 3]     = (Math.random() - 0.5) * 30;  // x
  positions[i * 3 + 1] = (Math.random() - 0.5) * 30;  // y
  positions[i * 3 + 2] = (Math.random() - 0.5) * 30;  // z
}

const particleGeo = new THREE.BufferGeometry();
particleGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

const particleMat = new THREE.PointsMaterial({
  color: 0x999999,
  size: 0.045,
  sizeAttenuation: true
});

const particles = new THREE.Points(particleGeo, particleMat);
scene.add(particles);

/* Partikel-Scatter-Physik */
const partOrigPos  = new Float32Array(positions);
const partCurPos   = new Float32Array(positions);
const partVel      = new Float32Array(PARTICLE_COUNT * 3);
let   partSettling = 0;

/* ---- B) Wireframe-Ikosaeder ---- */
// IcosahedronGeometry(radius, detail)
// detail=1 = mehr Polygone als der Standard-Ikosaeder
/* Hilfsfunktion: samplet N Punkte entlang jeder Kante einer EdgesGeometry */
function edgesToDots(edgesGeo, pointsPerEdge) {
  const pos = edgesGeo.attributes.position;
  const edgeCount = pos.count / 2;
  const arr = new Float32Array(edgeCount * pointsPerEdge * 3);
  let idx = 0;
  for (let e = 0; e < edgeCount; e++) {
    const ax = pos.getX(e*2),   ay = pos.getY(e*2),   az = pos.getZ(e*2);
    const bx = pos.getX(e*2+1), by = pos.getY(e*2+1), bz = pos.getZ(e*2+1);
    for (let p = 0; p < pointsPerEdge; p++) {
      const t = p / (pointsPerEdge - 1);
      arr[idx++] = ax + (bx - ax) * t;
      arr[idx++] = ay + (by - ay) * t;
      arr[idx++] = az + (bz - az) * t;
    }
  }
  return arr;
}

// Innerer Ikosaeder — grüne Punkte, feinere Detail-Stufe
const icoGeo  = new THREE.IcosahedronGeometry(2.0, 1);
const edgesGeo = new THREE.EdgesGeometry(icoGeo);
const icoDotGeo = new THREE.BufferGeometry();
icoDotGeo.setAttribute('position', new THREE.BufferAttribute(edgesToDots(edgesGeo, 85), 3));
const icoMat = new THREE.PointsMaterial({
  color: 0xc8f050,
  size: 0.022,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0
});
const ico = new THREE.Points(icoDotGeo, icoMat);
scene.add(ico);

// Äußerer Ikosaeder — dunkle Punkte, grobe Detail-Stufe
const icoGeo2  = new THREE.IcosahedronGeometry(2.9, 0);
const edgesGeo2 = new THREE.EdgesGeometry(icoGeo2);
const icoDotGeo2 = new THREE.BufferGeometry();
icoDotGeo2.setAttribute('position', new THREE.BufferAttribute(edgesToDots(edgesGeo2, 85), 3));
const icoMat2 = new THREE.PointsMaterial({
  color: 0x333333,
  size: 0.016,
  sizeAttenuation: true,
  transparent: true,
  opacity: 0
});
const ico2 = new THREE.Points(icoDotGeo2, icoMat2);
scene.add(ico2);

/* Scatter-Physik: Punkte explodieren und federn zurück */
const icoOrigPos  = new Float32Array(icoDotGeo.attributes.position.array);
const icoCurPos   = new Float32Array(icoOrigPos);
const icoVel      = new Float32Array(icoOrigPos.length);
const icoOrigPos2 = new Float32Array(icoDotGeo2.attributes.position.array);
const icoCurPos2  = new Float32Array(icoOrigPos2);
const icoVel2     = new Float32Array(icoOrigPos2.length);
let icoSettling   = 0;

/* Intro-Scale + Spin für den Ikosaeder (GSAP animiert diese Variablen) */
let icoScale = 0;
const _icoScaleObj = { v: 0 };
const _icoSpin = { v: Math.PI * 4 }; // 2 Umdrehungen beim Laden

/* ---- Mouse-Parallax für den Hero ---- */
// Wenn die Maus sich bewegt, rotiert der Ikosaeder leicht
let targetRotX = 0;
let targetRotY = 0;

document.addEventListener('mousemove', (e) => {
  // Mausposition normalisieren: -0.5 bis +0.5
  targetRotX = (e.clientY / window.innerHeight - 0.5) * 0.8;
  targetRotY = (e.clientX / window.innerWidth  - 0.5) * 0.8;
});

/* ---- Resize Handler ---- */
// Canvas muss neu skaliert werden wenn das Fenster die Größe ändert
window.addEventListener('resize', () => {
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  renderer.setSize(w, h);
});

/* ---- Animation Loop ---- */
// requestAnimationFrame ruft diese Funktion ~60x pro Sekunde auf.
// Das ist die "Spielschleife" der 3D-Szene.
const clock = new THREE.Clock();

function animateHero() {
  requestAnimationFrame(animateHero);

  const t = clock.getElapsedTime();

  // Ikosaeder rotieren (kontinuierlich + Maus-Einfluss)
  ico.rotation.x  += (targetRotX - ico.rotation.x)  * 0.05;
  ico.rotation.y  += (targetRotY + t * 0.15 + _icoSpin.v - ico.rotation.y) * 0.05;
  ico2.rotation.x += (targetRotX * 0.3 - ico2.rotation.x) * 0.02;
  ico2.rotation.y += (-targetRotY * 0.4 - t * 0.11 - ico2.rotation.y) * 0.02;
  ico2.rotation.z += (t * 0.06 - ico2.rotation.z) * 0.015;

  // Partikel sehr langsam rotieren
  particles.rotation.y = t * 0.01;
  particles.rotation.x = t * 0.005;

  // Ikosaeder leicht pulsieren (Sinus-Funktion für sanftes Ein/Ausatmen)
  const pulse = Math.sin(t * 0.8) * 0.05 + 1;
  ico.scale.setScalar(pulse * icoScale);
  ico2.scale.setScalar(icoScale);

  /* Scatter-Physik */
  if (icoSettling > 0) {
    icoSettling--;
    for (let i = 0; i < icoOrigPos.length; i += 3) {
      icoVel[i]   += (icoOrigPos[i]   - icoCurPos[i])   * 0.016;
      icoVel[i+1] += (icoOrigPos[i+1] - icoCurPos[i+1]) * 0.016;
      icoVel[i+2] += (icoOrigPos[i+2] - icoCurPos[i+2]) * 0.016;
      icoVel[i]   *= 0.91; icoVel[i+1] *= 0.91; icoVel[i+2] *= 0.91;
      icoCurPos[i]   += icoVel[i];
      icoCurPos[i+1] += icoVel[i+1];
      icoCurPos[i+2] += icoVel[i+2];
    }
    icoDotGeo.attributes.position.array.set(icoCurPos);
    icoDotGeo.attributes.position.needsUpdate = true;

    for (let i = 0; i < icoOrigPos2.length; i += 3) {
      icoVel2[i]   += (icoOrigPos2[i]   - icoCurPos2[i])   * 0.016;
      icoVel2[i+1] += (icoOrigPos2[i+1] - icoCurPos2[i+1]) * 0.016;
      icoVel2[i+2] += (icoOrigPos2[i+2] - icoCurPos2[i+2]) * 0.016;
      icoVel2[i]   *= 0.91; icoVel2[i+1] *= 0.91; icoVel2[i+2] *= 0.91;
      icoCurPos2[i]   += icoVel2[i];
      icoCurPos2[i+1] += icoVel2[i+1];
      icoCurPos2[i+2] += icoVel2[i+2];
    }
    icoDotGeo2.attributes.position.array.set(icoCurPos2);
    icoDotGeo2.attributes.position.needsUpdate = true;
  }

  /* Sterne zurückfedern */
  if (partSettling > 0) {
    partSettling--;
    for (let i = 0; i < partOrigPos.length; i += 3) {
      partVel[i]   += (partOrigPos[i]   - partCurPos[i])   * 0.006;
      partVel[i+1] += (partOrigPos[i+1] - partCurPos[i+1]) * 0.006;
      partVel[i+2] += (partOrigPos[i+2] - partCurPos[i+2]) * 0.006;
      partVel[i]   *= 0.94; partVel[i+1] *= 0.94; partVel[i+2] *= 0.94;
      partCurPos[i]   += partVel[i];
      partCurPos[i+1] += partVel[i+1];
      partCurPos[i+2] += partVel[i+2];
    }
    particleGeo.attributes.position.array.set(partCurPos);
    particleGeo.attributes.position.needsUpdate = true;
  }

  renderer.render(scene, camera);
}
animateHero();

/* ============================================================
   5. GSAP INTRO ANIMATION
   Die Hero-Elemente fliegen beim ersten Laden rein.
   stagger = zeitlicher Versatz zwischen den Elementen.
   ============================================================ */
/* Hero-Klick: Punkte explodieren radial nach außen */
document.getElementById('hero').addEventListener('click', () => {
  const strength = 0.22;
  for (let i = 0; i < icoOrigPos.length; i += 3) {
    const len = Math.sqrt(icoCurPos[i]**2 + icoCurPos[i+1]**2 + icoCurPos[i+2]**2) || 1;
    const s = strength * (0.6 + Math.random() * 0.8);
    icoVel[i]   += icoCurPos[i]  /len * s + (Math.random()-0.5) * strength * 0.5;
    icoVel[i+1] += icoCurPos[i+1]/len * s + (Math.random()-0.5) * strength * 0.5;
    icoVel[i+2] += icoCurPos[i+2]/len * s + (Math.random()-0.5) * strength * 0.5;
  }
  for (let i = 0; i < icoOrigPos2.length; i += 3) {
    const len = Math.sqrt(icoCurPos2[i]**2 + icoCurPos2[i+1]**2 + icoCurPos2[i+2]**2) || 1;
    const s = strength * (0.5 + Math.random() * 0.6);
    icoVel2[i]   += icoCurPos2[i]  /len * s + (Math.random()-0.5) * strength * 0.4;
    icoVel2[i+1] += icoCurPos2[i+1]/len * s + (Math.random()-0.5) * strength * 0.4;
    icoVel2[i+2] += icoCurPos2[i+2]/len * s + (Math.random()-0.5) * strength * 0.4;
  }
  icoSettling = 360;

  /* Sterne: zufälliger Kick in alle Richtungen */
  const pStr = 0.18;
  for (let i = 0; i < partOrigPos.length; i += 3) {
    partVel[i]   += (Math.random() - 0.5) * pStr;
    partVel[i+1] += (Math.random() - 0.5) * pStr;
    partVel[i+2] += (Math.random() - 0.5) * pStr;
  }
  partSettling = 400;
});

/* Ikosaeder-Intro: aufploppen + einblenden */
gsap.to(_icoScaleObj, {
  v: 1,
  duration: 2.0,
  ease: 'back.out(1.4)',
  delay: 0.1,
  onUpdate: () => { icoScale = _icoScaleObj.v; }
});
gsap.to(_icoSpin, { v: 0, duration: 2.8, ease: 'power3.out', delay: 0.1 });
gsap.to(icoMat,  { opacity: 0.15, duration: 1.6, ease: 'power3.out', delay: 0.1 });
gsap.to(icoMat2, { opacity: 0.6, duration: 2.0, ease: 'power3.out', delay: 0.4 });

gsap.timeline({ delay: 0.3 })
  .to('.hero__eyebrow', {
    opacity: 1,
    y: 0,
    duration: 0.8,
    ease: 'power3.out'
  })
  .to('.hero__name', {
    opacity: 1,
    y: 0,
    duration: 1,
    ease: 'power3.out'
  }, '-=0.4')  // 0.4s überlappen mit vorheriger Animation
  .to('.hero__tagline', {
    opacity: 1,
    y: 0,
    duration: 0.8,
    ease: 'power3.out'
  }, '-=0.5')
  .to('.hero__scroll-hint', {
    opacity: 1,
    duration: 0.6,
    ease: 'power2.out'
  }, '-=0.2');

/* ============================================================
   6. GSAP SCROLL REVEALS
   [data-reveal] Elemente fliegen rein wenn sie in den
   Viewport scrollen. ScrollTrigger koppelt die Animation
   an die Scroll-Position.
   ============================================================ */
document.querySelectorAll('[data-reveal]').forEach((el, i) => {
  gsap.fromTo(el,
    { opacity: 0, y: 32 },
    {
      opacity: 1,
      y: 0,
      duration: 0.8,
      ease: 'power3.out',
      scrollTrigger: {
        trigger: el,
        start: 'top 85%',    // Animation startet wenn Element 85% vom Top ist
        toggleActions: 'play none none none'
      }
    }
  );
});

/* 7. ABOUT — PARTIKEL-KOPF: siehe head-scene.js (ES Module) */

/* ============================================================
   8. SKILLS — Terminal HUD Skill-Scan mit Tag-Chips
   6 Kategorien, Skills als Tags die nacheinander einlaufen.
   ============================================================ */

(function() {
  const viz = document.querySelector('.skills__viz');
  viz.innerHTML = '';

  const categories = [
    {
      label: 'DESIGN',
      tags: ['Figma', 'UI Design', 'UX Research', 'Prototyping', 'Design Systems', 'Responsive Design']
    },
    {
      label: 'FRONTEND',
      tags: ['HTML5', 'CSS3', 'JavaScript', 'GSAP', 'Three.js', 'Animations', 'Responsive']
    },
    {
      label: 'CMS & BACKEND',
      tags: ['WordPress', 'WooCommerce', 'Python', 'Flask', 'REST APIs', 'MySQL', 'Node.js']
    },
    {
      label: 'DEPLOYMENT',
      tags: ['GitHub', 'GitHub Pages', 'Netlify', 'Vercel', 'cPanel / FTP']
    },
    {
      label: 'PERFORMANCE & SEO',
      tags: ['Core Web Vitals', 'Lighthouse', 'On-Page SEO', 'Google Analytics', 'Meta Tags']
    },
    {
      label: 'COLLABORATION',
      tags: ['Git', 'Agile', 'Notion', 'Slack', 'Upwork', 'Malt']
    },
  ];

  /* Header */
  const header = document.createElement('div');
  header.className = 'sh-header';
  header.innerHTML = `<span>SKILL_SCAN</span><span class="sh-status">INITIALIZING…</span>`;
  viz.appendChild(header);

  /* Scan-Linie unter dem Header */
  const scanBar = document.createElement('div');
  scanBar.className = 'sh-scanbar';
  scanBar.innerHTML = `<div class="sh-scanbar-fill"></div><div class="sh-scanbar-dot"></div>`;
  viz.appendChild(scanBar);

  /* Alle Tags sammeln für gestaffelte Animation */
  const allTags = [];

  categories.forEach(cat => {
    const block = document.createElement('div');
    block.className = 'sh-block';

    const catEl = document.createElement('div');
    catEl.className = 'sh-cat';
    catEl.textContent = `— ${cat.label} —`;
    block.appendChild(catEl);

    const tagWrap = document.createElement('div');
    tagWrap.className = 'sh-tags';

    cat.tags.forEach(name => {
      const tag = document.createElement('span');
      tag.className = 'sh-tag';
      tag.textContent = name;
      tag.style.opacity = '0';
      tag.style.transform = 'translateY(6px)';
      tagWrap.appendChild(tag);
      allTags.push(tag);
    });

    block.appendChild(tagWrap);
    viz.appendChild(block);
  });

  /* Scan-Animation on scroll */
  ScrollTrigger.create({
    trigger: '#skills',
    start: 'top 60%',
    once: true,
    onEnter: () => {
      header.querySelector('.sh-status').textContent = 'SCANNING…';

      /* Scan-Linie lädt */
      const fill = scanBar.querySelector('.sh-scanbar-fill');
      const dot  = scanBar.querySelector('.sh-scanbar-dot');
      gsap.to(fill, { width: '100%', duration: allTags.length * 0.045 + 0.4, ease: 'power1.inOut' });
      gsap.to(dot,  { left:  '100%', duration: allTags.length * 0.045 + 0.4, ease: 'power1.inOut' });

      allTags.forEach((tag, i) => {
        gsap.to(tag, {
          opacity: 1,
          y: 0,
          duration: 0.35,
          delay: i * 0.045 + 0.2,
          ease: 'power2.out'
        });
      });

      gsap.delayedCall(allTags.length * 0.045 + 0.6, () => {
        header.querySelector('.sh-status').textContent = 'COMPLETE';
        header.querySelector('.sh-status').style.color = '#c8f050';
      });
    }
  });
})();

/* ============================================================
   9. VALUE CARDS — THREE.JS MINI ANIMATIONEN
   Jede Karte hat eine passende 3D-Animation:
   0=Partikel-Speed, 1=Torus, 2=Node-Graph, 3=Oktaeder
   ============================================================ */
(function() {
  const SZ = 72;
  const entries = [];

  function setup(id, camZ) {
    const cv = document.getElementById(id);
    if (!cv) return null;
    const scene = new THREE.Scene();
    const cam   = new THREE.PerspectiveCamera(40, 1, 0.1, 50);
    cam.position.z = camZ;
    const rdr = new THREE.WebGLRenderer({ canvas: cv, antialias: true, alpha: true });
    rdr.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    rdr.setSize(SZ, SZ);
    return { scene, cam, rdr };
  }

  /* 0 — Fast Delivery: Horizontale Datenlinien blitzen von links nach rechts */
  const e0 = setup('val-cv-0', 3);
  if (e0) {
    const LINES = 7;
    const lines = [];
    const lm = new THREE.LineBasicMaterial({ color: 0xc8f050 });
    for (let i = 0; i < LINES; i++) {
      const y = -1.4 + i * (2.8 / (LINES - 1));
      const len = 0.4 + Math.random() * 1.2;
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-2, y, 0), new THREE.Vector3(-2 + len, y, 0)]);
      const line = new THREE.Line(geo, lm.clone());
      e0.scene.add(line);
      lines.push({ line, len, speed: 0.06 + Math.random() * 0.09, x: -2 + Math.random() * 3 });
    }
    entries.push({ ...e0, update() {
      lines.forEach(l => {
        l.x += l.speed;
        if (l.x - l.len > 2.2) { l.x = -2.2; l.len = 0.4 + Math.random() * 1.2; l.speed = 0.06 + Math.random() * 0.09; }
        const pos = l.line.geometry.attributes.position;
        pos.setXYZ(0, l.x - l.len, pos.getY(0), 0);
        pos.setXYZ(1, l.x,          pos.getY(1), 0);
        pos.needsUpdate = true;
      });
    }});
  }

  /* 1 — Reliability: Torus dreht sich gleichmäßig */
  const e1 = setup('val-cv-1', 3);
  if (e1) {
    const torus = new THREE.Mesh(
      new THREE.TorusGeometry(0.75, 0.18, 12, 40),
      new THREE.MeshBasicMaterial({ color: 0xc8f050, wireframe: true })
    );
    e1.scene.add(torus);
    entries.push({ ...e1, update(t) { torus.rotation.x = t * 0.5; torus.rotation.z = t * 0.15; }});
  }

  /* 2 — Strategic Thinking: Orbit-System */
  const e2 = setup('val-cv-2', 3.5);
  if (e2) {
    /* Zentrum */
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.18, 12, 12), new THREE.MeshBasicMaterial({ color: 0xc8f050 }));
    e2.scene.add(center);
    /* 3 Orbits in verschiedenen Ebenen */
    const orbits = [
      { r: 0.75, speed: 0.9,  tilt: 0,           orbitY: 0 },
      { r: 0.55, speed: -1.4, tilt: Math.PI/2.5,  orbitY: 0 },
      { r: 0.9,  speed: 0.55, tilt: Math.PI/4,    orbitY: 0 },
    ];
    const rings = [], dots = [];
    orbits.forEach(o => {
      /* Orbit-Ring */
      const rg = new THREE.RingGeometry(o.r - 0.005, o.r + 0.005, 48);
      const rm = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ color: 0x2a4008, side: THREE.DoubleSide }));
      rm.rotation.x = o.tilt;
      e2.scene.add(rm);
      rings.push(rm);
      /* Orbiting dot */
      const dot = new THREE.Mesh(new THREE.SphereGeometry(0.08, 8, 8), new THREE.MeshBasicMaterial({ color: 0xc8f050 }));
      e2.scene.add(dot);
      dots.push({ dot, ...o, angle: Math.random() * Math.PI * 2 });
    });
    entries.push({ ...e2, update(t) {
      dots.forEach(o => {
        o.angle += o.speed * 0.016;
        const x = Math.cos(o.angle) * o.r;
        const y = Math.sin(o.angle) * o.r;
        /* Rotate point by tilt around X */
        o.dot.position.set(x, y * Math.cos(o.tilt), y * Math.sin(o.tilt));
      });
    }});
  }

  /* 3 — Clean Modern Craft: Wireframe-Oktaeder */
  const e3 = setup('val-cv-3', 2.5);
  if (e3) {
    const obj = new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.OctahedronGeometry(0.9)),
      new THREE.LineBasicMaterial({ color: 0xc8f050 })
    );
    e3.scene.add(obj);
    entries.push({ ...e3, update(t) { obj.rotation.y = t * 0.45; obj.rotation.x = t * 0.22; }});
  }

  /* Gemeinsamer Loop */
  const vc = new THREE.Clock();
  (function loop() {
    requestAnimationFrame(loop);
    const t = vc.getElapsedTime();
    entries.forEach(e => { e.update(t); e.rdr.render(e.scene, e.cam); });
  })();
})();


/* 10. PRICING — plain text prices (canvas animations removed) */

/* ============================================================
   10. CONTACT FORM
   Nur Frontend — kein Backend.
   Zeigt eine Erfolgsmeldung nach dem Submit.
   ============================================================ */
document.getElementById('contact-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const btn = e.target.querySelector('.form__submit span');
  btn.textContent = 'Sent ✓';
  gsap.fromTo(btn.parentElement,
    { borderColor: '#c8f050' },
    { borderColor: '#c8f050', duration: 0.3 }
  );
  setTimeout(() => {
    btn.textContent = 'Send Message';
  }, 3000);
});

/* ============================================================
   11. SKILLS LABEL RESIZE
   Labels neu positionieren wenn Fenster die Größe ändert,
   da ihre Position von der Container-Größe abhängt.
   ============================================================ */
window.addEventListener('resize', () => {
  document.querySelectorAll('.skill-label').forEach((label, i) => {
    if (i >= skills.length) return;
    const angle = (i / skills.length) * Math.PI * 2 - Math.PI / 2;
    const r = outerR * skills[i].level;
    const x = cx + Math.cos(angle) * r;
    const y = cy + Math.sin(angle) * r;
    const scaleX = skillsViz.offsetWidth  / 500;
    const scaleY = skillsViz.offsetHeight / 500;
    label.style.left = (x * scaleX) + 'px';
    label.style.top  = (y * scaleY) + 'px';
  });
});


/* ============================================================
   12. LANGUAGE SWITCHER + THEME TOGGLE
   EN / DE übersetzungen + Dark / Light mode.
   Einstellungen werden in localStorage gespeichert.
   ============================================================ */

(function() {

  /* ---- Übersetzungen ---------------------------------------- */
  const I18N = {
    en: {
      heroEyebrow:      'Creative Developer & Designer',
      heroTagline:      'Interfaces that think. Experiences that move.',
      heroScroll:       'scroll',
      workLabel:        'Portfolio',
      workHeading:      'Selected Work',
      proj0cat:         'ONLINE SCHOOL / CODING',
      proj0title:       'PyCoBase',
      proj0desc:        'Free online learning platform for Python. Interactive lessons, live editor and structured courses — free for everyone.',
      proj1cat:         'SAAS / LANDING PAGE',
      proj1title:       'Aufstiegscode',
      proj1desc:        'Landing page for a non-fiction book. Conversion-optimised, animated, with a direct purchase flow.',
      proj2cat:         'TECH STARTUP / HOMEPAGE',
      proj2title:       'creativate',
      proj2desc:        'Homepage for a tech company. Clear branding, animated hero, modern structure — built for a strong first impression.',
      proj3cat:         'FASHION / E-COMMERCE',
      proj3title:       'Kleidungsmarke',
      proj3desc:        'Landing page for a clothing brand. Product grid, animated hero section, mobile-optimised. Link coming soon.',
      aboutLabel:       'About',
      aboutHeading:     'Building at the intersection of<br />design &amp; engineering.',
      aboutText0:       "I'm a creative developer based in Switzerland, focused on crafting digital experiences that combine precise engineering with considered visual design.",
      aboutText1:       'My work lives at the boundary between what a browser can render and what a human can perceive — interactive, fast, and built with intent.',
      aboutValuesLabel: 'WHAT I STAND FOR',
      val0title:        'Fast Delivery',
      val0desc:         'First working version within 48 hours. No endless waiting, no vague timelines.',
      val1title:        'Reliability',
      val1desc:         'What I commit to, I deliver. Clear communication throughout every project.',
      val2title:        'Strategic Thinking',
      val2desc:         'I ask the right questions before I build. Your goals drive every design decision.',
      val3title:        'Clean, Modern Craft',
      val3desc:         'No bloat, no templates. Every line of code and every pixel is intentional.',
      skillsLabel:      'Expertise',
      skillsHeading:    'What I work with',
      pricingLabel:     'Pricing',
      pricingHeading:   'Fixed prices. No surprises.',
      pricingSub:       'Fixed-price packages for common needs. Custom quotes available — just ask.',
      tier0: 'STARTER',   period0: 'one-time · 5 day delivery',
      feat00: '1-page landing page', feat01: 'Mobile responsive', feat02: 'Contact form',
      feat03: 'GitHub deploy', feat04: '1 revision round',
      cta0: 'Get started',
      badge1: 'MOST POPULAR', tier1: 'PROFESSIONAL', period1: 'one-time · 10 day delivery',
      feat10: 'Multi-page website (up to 5)', feat11: 'WordPress or custom HTML/CSS/JS',
      feat12: 'Animations & interactions', feat13: 'SEO basics + Google Analytics',
      feat14: '3 revision rounds', feat15: '2 weeks post-delivery support',
      cta1: 'Get started',
      tier2: 'CUSTOM', period2: 'scoped to your project',
      feat20: 'Web apps & dashboards', feat21: 'Python automation & APIs',
      feat22: 'WooCommerce / e-commerce', feat23: 'Ongoing retainer possible',
      feat24: 'Milestone-based billing',
      price2: "Let's talk",
      cta2: 'Request quote',
      quoteLabel:         'Statement',
      quoteHeading:       'In my own words.',
      quoteText:          'Self-taught developer with an entrepreneurial background and a clear focus on working solutions. I have independently built web applications, AI-powered tools and digital products — not as exercises, but with the intent to actually deploy them and create concrete value. My path from a trade apprenticeship through founding and successfully running a restaurant to software development was not linear, but it shaped me: I see things through, take responsibility, and get up to speed quickly on new topics on my own. This foundation is something I now want to deepen and build on through professional training as an application developer.',
      contactLabel:       'Contact',
      contactHeading:     "Let's build something.",
      contactSub:         'Available for freelance projects, collaborations, and full-time roles.',
      labelName:          'Name',
      labelEmail:         'E-Mail',
      labelMessage:       'Message',
      placeholderMessage: 'Tell me about your project…',
      submitBtn:          'Send Message',
      footerBuilt:        'Built with Three.js + GSAP',
    },
    de: {
      heroEyebrow:      'Kreativer Entwickler & Designer',
      heroTagline:      'Interfaces die denken. Erlebnisse die bewegen.',
      heroScroll:       'scrollen',
      workLabel:        'Portfolio',
      workHeading:      'Ausgewählte Arbeiten',
      proj0cat:         'ONLINE SCHULE / CODING',
      proj0title:       'PyCoBase',
      proj0desc:        'Kostenlose Online-Lernplattform für Python. Interaktive Lektionen, Live-Editor und strukturierte Kurse — gratis für alle.',
      proj1cat:         'SAAS / LANDINGPAGE',
      proj1title:       'Aufstiegscode',
      proj1desc:        'Landingpage für ein Fachbuch. Conversion-optimiert, animiert, mit direktem Kaufprozess.',
      proj2cat:         'TECH STARTUP / HOMEPAGE',
      proj2title:       'creativate',
      proj2desc:        'Startseite für eine Tech-Firma. Klares Branding, animierter Hero, moderne Struktur.',
      proj3cat:         'FASHION / E-COMMERCE',
      proj3title:       'Kleidungsmarke',
      proj3desc:        'Landingpage für eine Kleidungsfirma. Produktgrid, animierte Hero-Sektion, mobil-optimiert. Link folgt.',
      aboutLabel:       'Über mich',
      aboutHeading:     'An der Schnittstelle von<br />Design &amp; Entwicklung.',
      aboutText0:       'Ich bin ein kreativer Entwickler aus der Schweiz, der digitale Erlebnisse erschafft, die präzise Technik mit durchdachtem visuellem Design verbinden.',
      aboutText1:       'Meine Arbeit bewegt sich an der Grenze dessen, was ein Browser rendern und ein Mensch wahrnehmen kann — interaktiv, schnell und mit Absicht gebaut.',
      aboutValuesLabel: 'WOFÜR ICH STEHE',
      val0title:        'Schnelle Lieferung',
      val0desc:         'Erste funktionierende Version innerhalb von 48 Stunden. Kein endloses Warten, keine vagen Timelines.',
      val1title:        'Zuverlässigkeit',
      val1desc:         'Was ich zusage, liefere ich. Klare Kommunikation durch jedes Projekt hindurch.',
      val2title:        'Strategisches Denken',
      val2desc:         'Ich stelle die richtigen Fragen bevor ich baue. Deine Ziele treiben jede Designentscheidung an.',
      val3title:        'Sauberes, modernes Handwerk',
      val3desc:         'Kein Bloat, keine Templates. Jede Codezeile und jedes Pixel ist bewusst gesetzt.',
      skillsLabel:      'Expertise',
      skillsHeading:    'Womit ich arbeite',
      pricingLabel:     'Preise',
      pricingHeading:   'Fixpreise. Keine Überraschungen.',
      pricingSub:       'Festpreispakete für gängige Anforderungen. Individuelle Angebote auf Anfrage.',
      tier0: 'STARTER',   period0: 'einmalig · 5 Tage Lieferung',
      feat00: '1-seitige Landingpage', feat01: 'Mobil responsiv', feat02: 'Kontaktformular',
      feat03: 'GitHub-Deploy', feat04: '1 Überarbeitungsrunde',
      cta0: 'Jetzt starten',
      badge1: 'AM BELIEBTESTEN', tier1: 'PROFESSIONAL', period1: 'einmalig · 10 Tage Lieferung',
      feat10: 'Mehrseitige Website (bis 5)', feat11: 'WordPress oder Custom HTML/CSS/JS',
      feat12: 'Animationen & Interaktionen', feat13: 'SEO Basics + Google Analytics',
      feat14: '3 Überarbeitungsrunden', feat15: '2 Wochen Support nach Lieferung',
      cta1: 'Jetzt starten',
      tier2: 'INDIVIDUAL', period2: 'auf dein Projekt zugeschnitten',
      feat20: 'Web-Apps & Dashboards', feat21: 'Python-Automation & APIs',
      feat22: 'WooCommerce / E-Commerce', feat23: 'Laufendes Retainer möglich',
      feat24: 'Meilenstein-basierte Abrechnung',
      price2: 'Auf Anfrage',
      cta2: 'Angebot anfragen',
      quoteLabel:         'Statement',
      quoteHeading:       'In eigenen Worten.',
      quoteText:          'Autodidaktischer Entwickler mit unternehmerischem Hintergrund und einem klaren Fokus auf funktionierende Lösungen. Ich habe eigenständig Webanwendungen, KI-gestützte Tools und digitale Produkte entwickelt – nicht als Übung, sondern mit dem Anspruch, sie tatsächlich einzusetzen und einen konkreten Nutzen zu schaffen. Mein Weg von der handwerklichen Ausbildung über die Gründung und erfolgreiche Führung eines Restaurants bis hin zur Softwareentwicklung war nicht geradlinig, hat mich aber geprägt: Ich bringe Projekte zu Ende, übernehme Verantwortung und arbeite mich schnell und selbstständig in neue Themen ein. Dieses Fundament möchte ich nun durch eine Ausbildung zum Fachinformatiker für Anwendungsentwicklung gezielt vertiefen und weiter ausbauen.',
      contactLabel:       'Kontakt',
      contactHeading:     'Lass uns etwas bauen.',
      contactSub:         'Verfügbar für Freelance-Projekte, Kooperationen und Festanstellungen.',
      labelName:          'Name',
      labelEmail:         'E-Mail',
      labelMessage:       'Nachricht',
      placeholderMessage: 'Erzähl mir von deinem Projekt…',
      submitBtn:          'Nachricht senden',
      footerBuilt:        'Gebaut mit Three.js + GSAP',
    }
  };

  /* ---- Texte anwenden --------------------------------------- */
  function applyTranslations(lang) {
    const t = I18N[lang];
    if (!t) return;
    const qs  = sel => document.querySelector(sel);
    const qsa = sel => document.querySelectorAll(sel);

    // Hero
    const eyebrow = qs('.hero__eyebrow');
    if (eyebrow) eyebrow.textContent = t.heroEyebrow;
    const tagline = qs('.hero__tagline');
    if (tagline) tagline.textContent = t.heroTagline;
    const scrollHint = qs('.hero__scroll-hint');
    if (scrollHint) scrollHint.textContent = t.heroScroll;

    // Work
    const workLabel = qs('.work__label');
    if (workLabel) workLabel.textContent = t.workLabel;
    const workHeading = qs('.work__heading');
    if (workHeading) workHeading.textContent = t.workHeading;
    const projData = [
      [t.proj0cat, t.proj0title, t.proj0desc],
      [t.proj1cat, t.proj1title, t.proj1desc],
      [t.proj2cat, t.proj2title, t.proj2desc],
      [t.proj3cat, t.proj3title, t.proj3desc],
    ];
    qsa('.project-card').forEach((card, i) => {
      if (!projData[i]) return;
      const [cat, title, desc] = projData[i];
      const c = card.querySelector('.project-card__cat');
      const tl = card.querySelector('.project-card__title');
      const d = card.querySelector('.project-card__desc');
      if (c) c.textContent = cat;
      if (tl) tl.textContent = title;
      if (d) d.textContent = desc;
    });

    // About
    const aboutLabel = qs('.about__label');
    if (aboutLabel) aboutLabel.textContent = t.aboutLabel;
    const aboutHeading = qs('.about__heading');
    if (aboutHeading) aboutHeading.innerHTML = t.aboutHeading;
    const aboutTexts = qsa('.about__text');
    if (aboutTexts[0]) aboutTexts[0].textContent = t.aboutText0;
    if (aboutTexts[1]) aboutTexts[1].textContent = t.aboutText1;
    const valuesLabel = qs('.about__values-label');
    if (valuesLabel) valuesLabel.textContent = t.aboutValuesLabel;
    const valData = [
      [t.val0title, t.val0desc],
      [t.val1title, t.val1desc],
      [t.val2title, t.val2desc],
      [t.val3title, t.val3desc],
    ];
    qsa('.about__val-card').forEach((card, i) => {
      if (!valData[i]) return;
      const [title, desc] = valData[i];
      const tl = card.querySelector('.about__val-title');
      const d = card.querySelector('.about__val-desc');
      if (tl) tl.textContent = title;
      if (d) d.textContent = desc;
    });

    // Skills
    const skillsLabel = qs('.skills__label');
    if (skillsLabel) skillsLabel.textContent = t.skillsLabel;
    const skillsHeading = qs('.skills__heading');
    if (skillsHeading) skillsHeading.textContent = t.skillsHeading;

    // Quote
    const qLabel = qs('.quote__label');
    if (qLabel) qLabel.textContent = t.quoteLabel;
    const qHeading = qs('.quote__heading');
    if (qHeading) qHeading.textContent = t.quoteHeading;
    const qText = qs('.quote__text');
    if (qText) qText.textContent = t.quoteText;

    // Contact
    const cLabel = qs('.contact__label');
    if (cLabel) cLabel.textContent = t.contactLabel;
    const cHeading = qs('.contact__heading');
    if (cHeading) cHeading.textContent = t.contactHeading;
    const cSub = qs('.contact__sub');
    if (cSub) cSub.textContent = t.contactSub;
    const lName = qs('label[for="name"]');
    if (lName) lName.textContent = t.labelName;
    const lEmail = qs('label[for="email"]');
    if (lEmail) lEmail.textContent = t.labelEmail;
    const lMsg = qs('label[for="message"]');
    if (lMsg) lMsg.textContent = t.labelMessage;
    const msgArea = qs('#message');
    if (msgArea) msgArea.placeholder = t.placeholderMessage;
    const submitSpan = qs('.form__submit span');
    if (submitSpan) submitSpan.textContent = t.submitBtn;

    // Footer
    const footerSpans = qsa('footer span');
    if (footerSpans[1]) footerSpans[1].textContent = t.footerBuilt;

    // HTML lang attr + button states
    document.documentElement.lang = lang === 'de' ? 'de' : 'en';
    document.getElementById('lang-en').classList.toggle('active', lang === 'en');
    document.getElementById('lang-de').classList.toggle('active', lang === 'de');

    localStorage.setItem('lang', lang);
  }

  /* ---- Theme anwenden --------------------------------------- */
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = theme === 'light' ? '🌙' : '☀️';
    localStorage.setItem('theme', theme);
  }

  /* ---- Init: gespeicherte Werte laden ----------------------- */
  const savedLang  = localStorage.getItem('lang')  || 'en';
  const savedTheme = localStorage.getItem('theme') || 'dark';

  applyTheme(savedTheme);
  applyTranslations(savedLang);

  /* ---- Button Events --------------------------------------- */
  document.getElementById('lang-en').addEventListener('click', () => applyTranslations('en'));
  document.getElementById('lang-de').addEventListener('click', () => applyTranslations('de'));

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  });

})();

