let song;
let fft;

let bass = 0;
let mid = 0;
let treble = 0;
let bassAvg = 0;
let prevBass = 0;
let prevTreble = 0;
let beatCooldown = 0;
let hatCooldown = 0;
let isBeat = false;
let isTrebleHit = false;

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

  if (song.isPlaying()) {
    if (isBeat) {
      spawnAuraBurst(2, 180, min(width, height) * 0.48, 0.55);
    }
    if (isTrebleHit) {
      spawnAuraBurst(2, 90, 220, 0.65);
    }
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
function spawnAuraBurst(count, minSize, maxSize, alphaMax) {
  for (let i = 0; i < count; i++) {
    let baseHue = (frameCount * 2.5 + random(-70, 70)) % 360;
    let baseSize = random(minSize, maxSize) * map(bass, 0.2, 1, 0.85, 1.35, true);

    auras.push({
      x: random(width),
      y: random(height),
      vx: random(-1.4, 1.4),
      vy: random(-1.4, 1.4),
      angle: random(TWO_PI),
      spin: random(-0.015, 0.015),
      rx: baseSize * 0.25,
      ry: baseSize * 0.25,
      targetRx: baseSize * random(0.6, 1.8),
      targetRy: baseSize * random(0.4, 1.2),
      hue: (baseHue + 360) % 360,
      alpha: random(alphaMax * 0.65, alphaMax)
    });
  }
}

function updateAuras() {
  blendMode(ADD);
  let pulse = 1 + bass * 0.22;

  for (let i = auras.length - 1; i >= 0; i--) {
    let a = auras[i];
    a.x += a.vx;
    a.y += a.vy;
    a.angle += a.spin;
    a.rx = lerp(a.rx, a.targetRx * pulse, 0.14);
    a.ry = lerp(a.ry, a.targetRy * pulse, 0.14);
    a.alpha -= 0.0085;

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

  bassAvg = lerp(bassAvg, bass, 0.14);
  if (beatCooldown > 0) {
    beatCooldown--;
  }
  if (hatCooldown > 0) {
    hatCooldown--;
  }

  //trigger on bass hits and treble accents
  isBeat = (bass - prevBass > 0.04 || bass > bassAvg + 0.06) && bass > 0.25 && beatCooldown === 0;
  if (isBeat) {
    beatCooldown = 12;
  }

  isTrebleHit = treble - prevTreble > 0.12 && treble > 0.25 && hatCooldown === 0;
  if (isTrebleHit) {
    hatCooldown = 10;
  }

  prevBass = bass;
  prevTreble = treble;
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
