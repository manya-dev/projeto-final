let song;
let fft;

let bass = 0;
let mid = 0;
let treble = 0;
let prevBass = 0;
let beatCooldown = 0;
let isBeat = false;

let auras = [];

//load default audio
async function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  background(0);

  song = await loadSound("assets/track.wav");
  fft = new p5.FFT(512);
  fft.analyzer.smoothing = 0.35;
  fft.setInput(song);
}

function draw() {
  //pure black background without gray residue
  blendMode(BLEND);
  background(0);

  if (!song || !fft) {
    return;
  }

  updateAudioBands();

  if (song.isPlaying() && isBeat) {
    spawnAuraBurst();
  }

  updateAuras();

  if (!song.isPlaying()) {
    noStroke();
    fill(0, 0, 100, 75);
    textFont("Courier New");
    textAlign(CENTER);
    textSize(16);
    text("Click anywhere to play", width / 2, height - 30);
  }
}

//spawn stretched blurred auras on beat
function spawnAuraBurst() {
  let count = bass > 0.7 ? 2 : 1;
  for (let i = 0; i < count; i++) {
    let baseHue = (frameCount * 2 + random(-50, 50)) % 360;
    let baseSize = random(80, min(width, height) * 0.45) * map(bass, 0.25, 1, 0.7, 1.35, true);

    auras.push({
      x: random(width),
      y: random(height),
      vx: random(-1.2, 1.2),
      vy: random(-1.2, 1.2),
      angle: random(TWO_PI),
      spin: random(-0.015, 0.015),
      rx: baseSize * 0.3,
      ry: baseSize * 0.3,
      targetRx: baseSize * random(0.6, 1.7),
      targetRy: baseSize * random(0.4, 1.2),
      hue: (baseHue + 360) % 360,
      alpha: random(0.35, 0.65)
    });
  }
}

function updateAuras() {
  blendMode(ADD);

  for (let i = auras.length - 1; i >= 0; i--) {
    let a = auras[i];
    a.x += a.vx;
    a.y += a.vy;
    a.angle += a.spin;
    a.rx = lerp(a.rx, a.targetRx, 0.12);
    a.ry = lerp(a.ry, a.targetRy, 0.12);
    a.alpha -= 0.012;

    if (a.alpha <= 0) {
      auras.splice(i, 1);
      continue;
    }

    drawBlurredAura(a);
  }

  blendMode(BLEND);
}

//soft radial gradient glow
function drawBlurredAura(a) {
  let ctx = drawingContext;
  ctx.save();
  ctx.translate(a.x, a.y);
  ctx.rotate(a.angle);
  ctx.scale(a.rx, a.ry);

  let grad = ctx.createRadialGradient(0, 0, 0, 0, 0, 1);
  grad.addColorStop(0, `hsla(${a.hue}, 95%, 65%, ${a.alpha})`);
  grad.addColorStop(0.45, `hsla(${(a.hue + 30) % 360}, 90%, 50%, ${a.alpha * 0.45})`);
  grad.addColorStop(1, `hsla(${a.hue}, 90%, 45%, 0)`);

  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(0, 0, 1, 0, TWO_PI);
  ctx.fill();
  ctx.restore();
}

//split spectrum into bass, mid, treble and detect beat onset
function updateAudioBands() {
  let spectrum = fft.analyze();

  let rawBass = sqrt(getPeakEnergy(spectrum, 1, 5));
  let rawMid = sqrt(getPeakEnergy(spectrum, 6, 32));
  let rawTreble = sqrt(getPeakEnergy(spectrum, 35, 180));

  bass = map(rawBass, 0.2, 0.48, 0, 1, true);
  mid = map(rawMid, 0.08, 0.25, 0, 1, true);
  treble = map(rawTreble, 0.015, 0.08, 0, 1, true);

  if (beatCooldown > 0) {
    beatCooldown--;
  }

  //trigger when bass jumps up sharply
  let bassJump = bass - prevBass;
  isBeat = bassJump > 0.07 && bass > 0.28 && beatCooldown === 0;
  if (isBeat) {
    beatCooldown = 10;
  }

  prevBass = bass;
}

//peak energy in frequency range
function getPeakEnergy(spectrum, startIdx, endIdx) {
  let peak = 0;

  for (let i = startIdx; i <= endIdx && i < spectrum.length; i++) {
    if (spectrum[i] > peak) {
      peak = spectrum[i];
    }
  }

  return peak;
}

//play and pause on click
function mousePressed() {
  if (!song) {
    return;
  }

  if (typeof userStartAudio === "function") {
    userStartAudio();
  }

  if (song.isPlaying()) {
    song.pause();
  } else {
    song.loop(true);
    song.play();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
