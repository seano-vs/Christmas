import * as THREE from "three";

// ============================================================================
// Little helpers
// ============================================================================
const $ = (s) => document.querySelector(s);
const panel = $("#panel");
const hint = $("#hint");
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const store = {
  get() { try { return JSON.parse(localStorage.getItem("hat") || "null"); } catch { return null; } },
  set(v) { try { localStorage.setItem("hat", JSON.stringify(v)); } catch {} },
  clear() { try { localStorage.removeItem("hat"); } catch {} },
};

function toast(msg) {
  const t = $("#toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (t.hidden = true), 4000);
}

function showPanel(html) {
  panel.innerHTML = html;
  panel.classList.remove("hide");
  hint.hidden = true;
}
function hidePanel() { panel.classList.add("hide"); }
function showHint(html, meter = false) {
  $("#hintText").innerHTML = html;
  $("#meter").classList.toggle("off", !meter);
  hint.hidden = false;
}

// ============================================================================
// Scene: a tiny snowy diorama with a top hat in the middle
// ============================================================================
const canvas = $("#c");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

const scene = new THREE.Scene();
const NIGHT = new THREE.Color(0x0b1630);
scene.background = NIGHT;
scene.fog = new THREE.Fog(NIGHT, 11, 26);

const camera = new THREE.PerspectiveCamera(45, 1, 0.05, 100);

scene.add(new THREE.HemisphereLight(0xcfe0ff, 0x2a3558, 1.4));
const sun = new THREE.DirectionalLight(0xfff0d8, 2.2);
sun.position.set(4, 9, 6);
sun.castShadow = true;
sun.shadow.mapSize.set(1024, 1024);
Object.assign(sun.shadow.camera, { left: -6, right: 6, top: 6, bottom: -6, near: 1, far: 25 });
scene.add(sun);

const flat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 0.85, ...extra });

// Ground: a round snowy island
const ground = new THREE.Mesh(new THREE.CylinderGeometry(6.5, 7, 0.6, 28), flat(0xf4f8ff));
ground.position.y = -0.3;
ground.receiveShadow = true;
scene.add(ground);

function tree(x, z, s) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 0.4, 6), flat(0x6b4226));
  trunk.position.y = 0.2;
  g.add(trunk);
  [[0.9, 1.0, 0.75], [0.7, 0.85, 1.3], [0.48, 0.7, 1.8]].forEach(([r, h, y]) => {
    const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 7), flat(0x1f7a4a));
    c.position.y = y;
    c.castShadow = true;
    g.add(c);
  });
  const star = new THREE.Mesh(new THREE.OctahedronGeometry(0.12), flat(0xffd34d, { emissive: 0xffb400, emissiveIntensity: 0.8 }));
  star.position.y = 2.25;
  g.add(star);
  g.position.set(x, 0, z);
  g.scale.setScalar(s);
  g.rotation.y = rand(0, 6);
  scene.add(g);
}
tree(-3.2, -2.2, 1.2); tree(3.4, -2.6, 1.4); tree(-4.3, 0.8, 0.9); tree(4.4, 0.9, 1.0); tree(0.6, -4.2, 1.1); tree(-1.6, -4.0, 0.8);

function gift(x, z, s, color, ribbon) {
  const g = new THREE.Group();
  const box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), flat(color));
  box.castShadow = true;
  g.add(box);
  const r1 = new THREE.Mesh(new THREE.BoxGeometry(1.02, 1.02, 0.18), flat(ribbon));
  const r2 = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.02, 1.02), flat(ribbon));
  g.add(r1, r2);
  g.scale.setScalar(s);
  g.position.set(x, s / 2, z);
  g.rotation.y = rand(-0.6, 0.6);
  scene.add(g);
}
gift(-2.1, 1.6, 0.55, 0xe2463f, 0xffd34d);
gift(2.3, 1.4, 0.45, 0x2f7de1, 0xffffff);
gift(2.0, 2.3, 0.3, 0x9b59d0, 0xffd34d);
gift(-2.6, 2.4, 0.32, 0x25a35a, 0xe2463f);

// The hat (upside down, opening up, ready to be reached into)
const hat = new THREE.Group();
scene.add(hat);
const V = (x, y) => new THREE.Vector2(x, y);
const hatOuter = new THREE.Mesh(
  new THREE.LatheGeometry([V(0, 0), V(1.0, 0), V(1.06, 0.8), V(1.1, 1.6), V(1.75, 1.62), V(1.8, 1.69), V(1.7, 1.75), V(1.04, 1.73)], 28),
  flat(0x26242f, { side: THREE.DoubleSide, roughness: 0.6 }),
);
hatOuter.castShadow = true;
const hatInner = new THREE.Mesh(
  new THREE.LatheGeometry([V(1.04, 1.73), V(0.99, 0.9), V(0.95, 0.12), V(0, 0.12)], 28),
  flat(0x7a1c2e, { side: THREE.DoubleSide, roughness: 0.5 }),
);
const band = new THREE.Mesh(new THREE.CylinderGeometry(1.11, 1.1, 0.3, 28, 1, true), flat(0xe2463f, { side: THREE.DoubleSide }));
band.position.y = 1.36;
hat.add(hatOuter, hatInner, band);
// Holly on the band
const holly = new THREE.Group();
[-1, 1].forEach((d) => {
  const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 4), flat(0x1f8a4c));
  leaf.scale.set(1.3, 0.55, 0.25);
  leaf.position.set(d * 0.2, 0.02, 0);
  leaf.rotation.z = d * 0.4;
  holly.add(leaf);
});
[[-0.06, 0.06], [0.07, 0.07], [0, -0.05]].forEach(([x, y]) => {
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.075, 8, 6), flat(0xd61f2c, { roughness: 0.3 }));
  b.position.set(x, y, 0.08);
  holly.add(b);
});
holly.position.set(0, 1.38, 1.12);
hat.add(holly);
// Warm light inside so you can see the papers
const glow = new THREE.PointLight(0xffd59a, 6, 4, 1.5);
glow.position.set(0, 1.5, 0);
hat.add(glow);

// Snow
const snowTex = (() => {
  const c = document.createElement("canvas");
  c.width = c.height = 32;
  const g = c.getContext("2d");
  const gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, "rgba(255,255,255,1)");
  gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr;
  g.fillRect(0, 0, 32, 32);
  return new THREE.CanvasTexture(c);
})();
const SNOW = 700;
const snowGeo = new THREE.BufferGeometry();
const snowPos = new Float32Array(SNOW * 3);
for (let i = 0; i < SNOW; i++) snowPos.set([rand(-10, 10), rand(0, 12), rand(-10, 8)], i * 3);
snowGeo.setAttribute("position", new THREE.BufferAttribute(snowPos, 3));
const snow = new THREE.Points(snowGeo, new THREE.PointsMaterial({ size: 0.12, map: snowTex, transparent: true, depthWrite: false }));
scene.add(snow);

// ============================================================================
// Folded papers
// ============================================================================
const PW = 0.3; // half width
const PD = 0.38; // depth
const FOLD = 1.05; // radians each half droops when folded
const PAPER_COLORS = [0xfff6e6, 0xffe9a8, 0xd9f2ff, 0xffdce6, 0xe2f7d4, 0xf0e2ff];
const backGeo = new THREE.PlaneGeometry(PW, PD).rotateX(-Math.PI / 2);
let papers = [];

function makePaper(color) {
  const g = new THREE.Group();
  const halves = [-1, 1].map((side) => {
    const pivot = new THREE.Group();
    const geo = new THREE.PlaneGeometry(PW, PD).rotateX(-Math.PI / 2).translate((side * PW) / 2, 0, 0);
    const front = new THREE.Mesh(geo, flat(color, { side: THREE.FrontSide, roughness: 1 }));
    const back = new THREE.Mesh(geo, flat(new THREE.Color(color).multiplyScalar(0.9), { side: THREE.BackSide, roughness: 1 }));
    front.castShadow = back.castShadow = true;
    pivot.add(front, back);
    g.add(pivot);
    return { pivot, front, side };
  });
  const p = { g, halves, fold: 1, v: new THREE.Vector3(), spin: new THREE.Vector3(), color };
  setFold(p, 1);
  return p;
}
function setFold(p, f) {
  p.fold = f;
  // halves droop down from the crease: a little tent
  p.halves.forEach((h) => (h.pivot.rotation.z = -h.side * f * FOLD));
}

const FLOOR = 0.12 + Math.sin(FOLD) * PW + 0.005;
const WALL = 0.98 - PW - 0.06;

function fillHat(n) {
  papers.forEach((p) => p.g.parent && p.g.parent.remove(p.g));
  papers = [];
  for (let i = 0; i < n; i++) {
    const p = makePaper(PAPER_COLORS[i % PAPER_COLORS.length]);
    const a = rand(0, Math.PI * 2);
    const r = Math.sqrt(Math.random()) * WALL;
    p.g.position.set(Math.cos(a) * r, FLOOR + i * 0.05, Math.sin(a) * r);
    p.g.rotation.set(rand(-0.2, 0.2), rand(0, Math.PI * 2), rand(-0.2, 0.2));
    hat.add(p.g);
    papers.push(p);
  }
}

const GRAV = -9;
function stepPapers(dt) {
  for (const p of papers) {
    if (p.flying) continue;
    p.v.y += GRAV * dt;
    p.g.position.addScaledVector(p.v, dt);
    p.g.rotation.x += p.spin.x * dt;
    p.g.rotation.y += p.spin.y * dt;
    p.g.rotation.z += p.spin.z * dt;
    const pos = p.g.position;
    if (pos.y < FLOOR) {
      pos.y = FLOOR;
      p.v.y = Math.abs(p.v.y) * 0.35;
      p.v.x *= 0.8; p.v.z *= 0.8;
      p.spin.multiplyScalar(0.7);
      // settle back to resting upright
      p.g.rotation.x *= 0.85;
      p.g.rotation.z *= 0.85;
    }
    if (pos.y > 1.25) { pos.y = 1.25; p.v.y = -Math.abs(p.v.y) * 0.3; } // stay in the hat
    const r = Math.hypot(pos.x, pos.z);
    if (r > WALL) {
      const nx = pos.x / r, nz = pos.z / r;
      pos.x = nx * WALL; pos.z = nz * WALL;
      const dot = p.v.x * nx + p.v.z * nz;
      if (dot > 0) { p.v.x -= 1.6 * dot * nx; p.v.z -= 1.6 * dot * nz; }
    }
    p.v.multiplyScalar(1 - 0.6 * dt);
  }
}

// Shaking: knock every paper around and wobble the hat
const wobble = { x: 0, z: 0, vx: 0, vz: 0, bounce: 0, vb: 0 };
function shakeImpulse(k) {
  for (const p of papers) {
    if (p.flying) continue;
    p.v.x += rand(-1.5, 1.5) * k;
    p.v.z += rand(-1.5, 1.5) * k;
    p.v.y += rand(1.2, 3.4) * k;
    p.spin.set(rand(-8, 8) * k, rand(-10, 10) * k, rand(-8, 8) * k);
  }
  wobble.vx += rand(-1, 1) * 3 * k;
  wobble.vz += rand(-1, 1) * 3 * k;
  wobble.vb += 2.5 * k;
}
function stepWobble(dt) {
  for (const [a, v, kk] of [["x", "vx", 60], ["z", "vz", 60], ["bounce", "vb", 120]]) {
    wobble[v] += -kk * wobble[a] * dt - 6 * wobble[v] * dt;
    wobble[a] += wobble[v] * dt;
  }
  hat.rotation.x = clamp(wobble.x, -0.35, 0.35);
  hat.rotation.z = clamp(wobble.z, -0.35, 0.35);
  hat.position.y = clamp(wobble.bounce * 0.15, -0.1, 0.25);
}

// ============================================================================
// Camera choreography
// ============================================================================
const cam = {
  pos: new THREE.Vector3(), look: new THREE.Vector3(),
  from: null, to: null, t: 1, dur: 1,
  orbit: true, angle: 0,
};
const SHOTS = {
  intro: { pos: new THREE.Vector3(0, 3.6, 6.6), look: new THREE.Vector3(0, 1.0, 0) },
  inside: { pos: new THREE.Vector3(0, 4.9, 1.5), look: new THREE.Vector3(0, 0.35, 0) },
};
function moveCam(shot, dur = 1.4) {
  cam.from = { pos: cam.pos.clone(), look: cam.look.clone() };
  cam.to = shot;
  cam.t = 0;
  cam.dur = dur;
}
cam.pos.copy(SHOTS.intro.pos);
cam.look.copy(SHOTS.intro.look);

function stepCam(dt, time) {
  if (cam.t < 1) {
    cam.t = Math.min(1, cam.t + dt / cam.dur);
    const k = ease(cam.t);
    cam.pos.lerpVectors(cam.from.pos, cam.to.pos, k);
    cam.look.lerpVectors(cam.from.look, cam.to.look, k);
  }
  camera.position.copy(cam.pos);
  if (cam.orbit) {
    // gentle drift so the menu screen feels alive
    camera.position.x += Math.sin(time * 0.25) * 1.2;
    camera.position.y += Math.sin(time * 0.4) * 0.15;
  }
  camera.lookAt(cam.look);
}

function resize() {
  const w = innerWidth, h = innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.fov = camera.aspect < 0.8 ? 62 : 45;
  camera.updateProjectionMatrix();
}
addEventListener("resize", resize);
resize();

// ============================================================================
// Confetti
// ============================================================================
let confetti = [];
const confGeo = new THREE.PlaneGeometry(0.04, 0.025);
function burst(at) {
  const cols = [0xe2463f, 0xffcf5a, 0x25a35a, 0x2f7de1, 0xffffff, 0xff7ab8];
  for (let i = 0; i < 110; i++) {
    const m = new THREE.Mesh(confGeo, new THREE.MeshBasicMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, transparent: true }));
    m.position.copy(at);
    const v = new THREE.Vector3(rand(-1, 1), rand(0.2, 1.4), rand(-1, 1)).normalize().multiplyScalar(rand(1.2, 2.8));
    scene.add(m);
    confetti.push({ m, v, s: new THREE.Vector3(rand(-12, 12), rand(-12, 12), rand(-12, 12)), life: rand(1.8, 3) });
  }
}
function stepConfetti(dt) {
  confetti = confetti.filter((c) => {
    c.life -= dt;
    c.v.y -= 2.6 * dt;
    c.v.multiplyScalar(1 - 1.8 * dt);
    c.m.position.addScaledVector(c.v, dt);
    c.m.rotation.x += c.s.x * dt; c.m.rotation.y += c.s.y * dt;
    c.m.material.opacity = clamp(c.life, 0, 1);
    if (c.life <= 0) { scene.remove(c.m); c.m.material.dispose(); return false; }
    return true;
  });
}

// ============================================================================
// Main loop
// ============================================================================
const tweens = [];
function tween(dur, fn) {
  return new Promise((done) => tweens.push({ t: 0, dur, fn, done }));
}

const clock = new THREE.Clock();
function frame() {
  const dt = Math.min(clock.getDelta(), 1 / 30);
  const time = clock.elapsedTime;

  for (let i = tweens.length - 1; i >= 0; i--) {
    const tw = tweens[i];
    tw.t = Math.min(1, tw.t + dt / tw.dur);
    tw.fn(tw.t);
    if (tw.t >= 1) { tweens.splice(i, 1); tw.done(); }
  }

  if (state.stage === "menu") hat.rotation.y += dt * 0.25;
  stepWobble(dt);
  stepPapers(dt);
  stepConfetti(dt);
  stepCam(dt, time);

  // pulse papers when it's time to pick one
  const pulse = state.stage === "pick" ? 0.25 + 0.25 * Math.sin(time * 5) : 0;
  for (const p of papers) if (!p.flying) p.halves.forEach((h) => (h.front.material.emissive.setHex(0xffc94d), (h.front.material.emissiveIntensity = pulse)));

  const sp = snowGeo.attributes.position.array;
  for (let i = 0; i < SNOW; i++) {
    sp[i * 3 + 1] -= dt * (0.5 + (i % 7) * 0.08);
    sp[i * 3] += Math.sin(time + i) * dt * 0.15;
    if (sp[i * 3 + 1] < 0) sp[i * 3 + 1] = 12;
  }
  snowGeo.attributes.position.needsUpdate = true;

  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}

// ============================================================================
// Game flow:  menu → confirm → shake → pick → reveal
// ============================================================================
const state = { stage: "menu", data: null, me: null, shake: 0 };

async function api(path, body) {
  const r = await fetch(path, body ? { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) } : {});
  return r.json();
}

async function boot() {
  requestAnimationFrame(frame);
  try {
    state.data = await api("api/state");
  } catch {
    showPanel(`<h2>The hat is stuck 😬</h2><p>Couldn't reach the server. Try again in a moment.</p>`);
    return;
  }
  $("#title").textContent = state.data.title;
  document.title = state.data.title;

  const saved = store.get();
  if (saved && !state.data.drawn.includes(saved.name)) store.clear(); // hat was reset
  fillHat(Math.max(1, state.data.names.length - state.data.drawn.length));
  menu();
}

function menu() {
  state.stage = "menu";
  cam.orbit = true;
  const { names, drawn } = state.data;
  const saved = store.get();
  if (saved) {
    showPanel(`
      <h2>Welcome back, ${esc(saved.name)} 👋</h2>
      <p>You've already pulled your paper.</p>
      <div class="stack"><button class="btn" id="again">🎩 Show my paper again</button></div>`);
    $("#again").onclick = () => {
      state.me = saved.name;
      hidePanel();
      enterHat().then(() => pickPaper(papers[0] || null));
    };
    return;
  }
  if (drawn.length >= names.length) {
    showPanel(`<h1>The hat is empty 🎄</h1><p>Everyone has pulled a name. Merry Christmas!</p>`);
    return;
  }
  showPanel(`
    <h1>Who are you?</h1>
    <div class="names">
      ${names.map((n) => `<button class="btn${drawn.includes(n) ? "" : " green"}" data-n="${esc(n)}" ${drawn.includes(n) ? "disabled" : ""}>${drawn.includes(n) ? "✓ " : ""}${esc(n)}</button>`).join("")}
    </div>
    <p class="muted">${drawn.length} of ${names.length} have drawn</p>`);
  panel.querySelectorAll("[data-n]").forEach((b) => (b.onclick = () => confirmName(b.dataset.n)));
}

function confirmName(name) {
  showPanel(`
    <h2>You're <span style="color:var(--red)">${esc(name)}</span>?</h2>
    <p>You only get one pull, so make sure it's you!</p>
    <div class="stack">
      <button class="btn green" id="yes">Yes, let's go! 🎩</button>
      <button class="btn ghost" id="no">← Not me</button>
    </div>`);
  $("#no").onclick = menu;
  $("#yes").onclick = async () => {
    state.me = name;
    await askMotion(); // must happen inside the tap on iPhone
    hidePanel();
    await enterHat();
    startShake();
  };
}

async function enterHat() {
  state.stage = "enter";
  cam.orbit = false;
  // turn hat so holly faces us, then fly the camera over the rim
  const TAU = Math.PI * 2;
  const r0 = ((((hat.rotation.y + Math.PI) % TAU) + TAU) % TAU) - Math.PI;
  tween(1.2, (t) => (hat.rotation.y = r0 * (1 - ease(t))));
  moveCam(SHOTS.inside, 1.4);
  await sleep(1400);
}

// ---------------------------------------------------------------- shaking
let motionOK = false;
async function askMotion() {
  try {
    if (typeof DeviceMotionEvent !== "undefined" && typeof DeviceMotionEvent.requestPermission === "function") {
      motionOK = (await DeviceMotionEvent.requestPermission()) === "granted";
    } else {
      motionOK = "DeviceMotionEvent" in window;
    }
  } catch { motionOK = false; }
}

let lastA = null;
addEventListener("devicemotion", (e) => {
  const a = e.accelerationIncludingGravity;
  if (!a || a.x == null) return;
  if (lastA) {
    const d = Math.hypot(a.x - lastA.x, a.y - lastA.y, a.z - lastA.z);
    if (d > 9 && state.stage === "shake") {
      const k = clamp(d / 22, 0.4, 1.4);
      shakeImpulse(k);
      addShake(k * 0.045);
      navigator.vibrate?.(15);
    }
  }
  lastA = { x: a.x, y: a.y, z: a.z };
});

const isTouch = matchMedia("(pointer: coarse)").matches;
function startShake() {
  state.stage = "shake";
  state.shake = 0;
  $("#meterFill").style.width = "0%";
  showHint(
    isTouch && motionOK
      ? `<span class="wiggle">📱</span> Shake your phone!<small>(or tap the hat)</small>`
      : `👆 Tap the hat to shake it!`,
    true,
  );
}

function addShake(x) {
  state.shake = Math.min(1, state.shake + x);
  $("#meterFill").style.width = `${state.shake * 100}%`;
  if (state.shake >= 1 && state.stage === "shake") {
    state.stage = "settling";
    setTimeout(() => {
      state.stage = "pick";
      showHint(`✋ Reach in and grab a paper!`);
    }, 900);
  }
}

// ---------------------------------------------------------------- tapping
const ray = new THREE.Raycaster();
canvas.addEventListener("pointerdown", (e) => {
  if (state.stage === "shake") {
    shakeImpulse(1);
    addShake(0.34);
    navigator.vibrate?.(20);
    return;
  }
  if (state.stage !== "pick") return;
  const ndc = new THREE.Vector2((e.clientX / innerWidth) * 2 - 1, -(e.clientY / innerHeight) * 2 + 1);
  ray.setFromCamera(ndc, camera);
  const hit = ray.intersectObjects(papers.map((p) => p.g), true)[0];
  let chosen = hit && papers.find((p) => p.g.getObjectById(hit.object.id));
  if (!chosen) {
    // missed? grab whichever paper is nearest to the finger
    let best = Infinity;
    for (const p of papers) {
      const s = p.g.getWorldPosition(new THREE.Vector3()).project(camera);
      const d = Math.hypot(s.x - ndc.x, s.y - ndc.y);
      if (d < best) { best = d; chosen = p; }
    }
  }
  if (chosen) pickPaper(chosen);
});

// ---------------------------------------------------------------- the reveal
function nameTexture(name, color) {
  const c = document.createElement("canvas");
  c.width = 1024;
  c.height = Math.round((1024 * PD) / (PW * 2));
  const g = c.getContext("2d");
  g.fillStyle = "#" + new THREE.Color(color).getHexString();
  g.fillRect(0, 0, c.width, c.height);
  // faint ruled lines + fold crease
  g.strokeStyle = "rgba(80,120,200,.18)";
  g.lineWidth = 4;
  for (let y = 120; y < c.height; y += 90) { g.beginPath(); g.moveTo(40, y); g.lineTo(c.width - 40, y); g.stroke(); }
  g.strokeStyle = "rgba(0,0,0,.08)";
  g.beginPath(); g.moveTo(c.width / 2, 0); g.lineTo(c.width / 2, c.height); g.stroke();
  g.fillStyle = "#2b1d14";
  g.textAlign = "center";
  g.textBaseline = "middle";
  let size = 220;
  do { g.font = `700 ${size}px Fredoka, system-ui, sans-serif`; size -= 8; } while (g.measureText(name).width > c.width * 0.86 && size > 40);
  g.save();
  g.translate(c.width / 2, c.height / 2 + 10);
  g.rotate(-0.04);
  g.fillText(name, 0, 0);
  g.restore();
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 4;
  return t;
}

async function pickPaper(p) {
  state.stage = "reveal";
  hint.hidden = true;
  const saved = store.get();
  const req = api("api/draw", { name: state.me, token: saved?.name === state.me ? saved.token : null }).catch(() => ({ error: "Couldn't reach the hat. Try again." }));
  navigator.vibrate?.(40);

  if (!p) { p = makePaper(PAPER_COLORS[0]); p.g.position.set(0, FLOOR, 0); hat.add(p.g); papers.push(p); }
  p.flying = true;
  scene.attach(p.g); // keep world transform, leave the hat

  // fly it up in front of the camera
  const fwd = new THREE.Vector3(); camera.getWorldDirection(fwd);
  const up = new THREE.Vector3(0, 1, 0).applyQuaternion(camera.quaternion);
  const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
  const fitW = halfH * Math.min(camera.aspect, 1.1);
  const dist = (PW * 2) / (0.8 * 2 * fitW);
  const target = camera.position.clone().addScaledVector(fwd, dist).addScaledVector(up, dist * halfH * 0.3);
  const q0 = p.g.quaternion.clone();
  const q1 = camera.quaternion.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI / 2));
  const p0 = p.g.position.clone();
  const lift = p0.clone().setY(p0.y + 1.4);
  await tween(1.0, (t) => {
    const k = ease(t);
    // up out of the hat first, then toward the camera
    const a = new THREE.Vector3().lerpVectors(p0, lift, Math.min(1, k * 2));
    p.g.position.lerpVectors(a, target, Math.max(0, k * 1.6 - 0.6));
    p.g.quaternion.slerpQuaternions(q0, q1, k);
    p.g.scale.setScalar(1 + k * 0.05);
  });

  const r = await req;
  if (r.error) {
    toast(r.error);
    await tween(0.6, (t) => p.g.position.lerpVectors(target, p0, ease(t)));
    hat.attach(p.g);
    p.flying = false;
    state.data = await api("api/state").catch(() => state.data);
    if (r.error.includes("already")) store.clear();
    menu();
    return;
  }
  store.set({ name: state.me, token: r.token });
  if (!state.data.drawn.includes(state.me)) state.data.drawn.push(state.me);

  // unfold
  await document.fonts.load("700 100px Fredoka").catch(() => {});
  const tex = nameTexture(r.target, p.color);
  let shown = false;
  const showName = () => p.halves.forEach((h) => {
    const t = tex.clone();
    t.needsUpdate = true;
    t.repeat.set(0.5, 1);
    t.offset.set(h.side < 0 ? 0 : 0.5, 0);
    h.front.material.map = t;
    h.front.material.color.set(0xffffff);
    h.front.material.emissiveIntensity = 0;
    h.front.material.needsUpdate = true;
  });
  // the name appears as the paper opens, like it was written on the inside
  await tween(0.8, (t) => {
    setFold(p, 1 - ease(t));
    if (!shown && t > 0.4) { shown = true; showName(); }
  });
  // snapshot the open paper for the WhatsApp preview card, before the confetti
  const upload = snapshot(p)
    .then((blob) => fetch(`api/card?name=${encodeURIComponent(state.me)}&token=${encodeURIComponent(r.token)}`, { method: "POST", headers: { "content-type": "image/jpeg" }, body: blob }))
    .catch((e) => console.warn("card upload failed", e));
  burst(p.g.position.clone());
  navigator.vibrate?.([30, 40, 60]);

  reveal(r, upload);
}

// Render a dedicated 1200x630 frame for the preview card, centred on the paper.
function snapshot(p) {
  const W = 1200, H = 630;
  const camPos = camera.position.clone();
  const pr = renderer.getPixelRatio();
  // slide the camera sideways (no rotation) so the paper sits dead centre
  const fwd = camera.getWorldDirection(new THREE.Vector3());
  const toPaper = p.g.position.clone().sub(camera.position);
  camera.position.add(toPaper.addScaledVector(fwd, -toPaper.dot(fwd)));
  camera.aspect = W / H;
  camera.fov = 34;
  camera.updateProjectionMatrix();
  renderer.setPixelRatio(1);
  renderer.setSize(W, H, false);
  renderer.render(scene, camera);
  const out = document.createElement("canvas");
  out.width = W; out.height = H;
  out.getContext("2d").drawImage(renderer.domElement, 0, 0);
  // put everything back before the next frame is shown
  camera.position.copy(camPos);
  renderer.setPixelRatio(pr);
  resize();
  return new Promise((ok, fail) => out.toBlob((b) => (b ? ok(b) : fail()), "image/jpeg", 0.86));
}

function reveal({ target, v }, upload) {
  const { names, drawn } = state.data;
  const link = new URL(`s/${encodeURIComponent(state.me)}${v ? `?v=${v}` : ""}`, location.href).href;
  const text = `🎩 I pulled ${target} out of the hat! ${drawn.length} of ${names.length} done. Your turn 👉 ${link}`;
  showPanel(`
    <p style="margin:0">You pulled…</p>
    <div class="big">${esc(target)}</div>
    <div class="stack">
      <a class="btn green" id="wa" style="opacity:.6;pointer-events:none" href="https://wa.me/?text=${encodeURIComponent(text)}" target="_blank" rel="noopener">
        <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm0 18.2c-1.5 0-3-.4-4.2-1.2l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2Zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8-.2-.1-.4-.1-.6.1l-.8 1c-.1.2-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.2-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2c0 1.3.9 2.5 1 2.7.1.2 1.8 2.8 4.4 3.9 1.6.7 2.3.8 3.1.6.5-.1 1.5-.6 1.7-1.2.2-.6.2-1.1.2-1.2-.1-.1-.3-.2-.5-.3Z"/></svg>
        Tell the group on WhatsApp
      </a>
    </div>
    <p class="muted">Your paper stays saved on this phone.</p>`);
  // wait (briefly) for the preview card upload so WhatsApp gets the real picture
  const wa = $("#wa");
  Promise.race([upload, sleep(5000)]).then(() => wa.removeAttribute("style"));
}

boot();
