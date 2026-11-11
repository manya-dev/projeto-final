let song;
let fft;

let bass = 0;
let mid = 0;
let treble = 0;
let waveEnergy = 0;
let energyAvg = 0;
let prevEnergy = 0;
let prevTreble = 0;
let beatCooldown = 0;
let hatCooldown = 0;
let isBeat = false;
let isTrebleHit = false;

let bgHue = 260;
let bgBright = 8;

let auras = [];
let waveLines = [];

//load default audio
async function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  background(0);

  song = await loadSound("assets/track.wav");
  fft = new p5.FFT(512);
  fft.analyzer.smoothing = 0.15;
  fft.setInput(song);
}

function draw() {
  if (!song || !fft) {
    background(0);
    return;
  }

  let wave = fft.waveform();
  updateAudioBands(wave);

  if (song.isPlaying()) {
    bgHue = (bgHue + 0.12 + mid * 0.35) % 360;
    if (isBeat) {
      spawnAuraBurst(2, 260, min(width, height) * 0.85, 0.58);
      spawnWaveLine(max(bass, waveEnergy), 0);
    }
    if (isTrebleHit) {
      spawnAuraBurst(2, 160, 420, 0.65);
      spawnWaveLine(treble, 160);
    }
  }

  //soft dark tinted background without harsh flashing
  bgBright = lerp(bgBright, 7 + bass * 6, 0.08);
  blendMode(BLEND);
  background(bgHue, 55, bgBright);

  updateAuras();
  updateWaveLines(wave);

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
    a.rx = lerp(a.rx, a.targetRx * pulse, 0.28);
    a.ry = lerp(a.ry, a.targetRy * pulse, 0.28);
    a.alpha -= 0.0065;

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

//spawn glowing waveform line at random place and angle
function spawnWaveLine(energy, hueShift) {
  let hueVal = (frameCount * 2.5 + hueShift + random(-35, 35)) % 360;
  let bigScreen = max(width, height);
  let isHuge = random() < 0.35;
  let len = isHuge ? random(bigScreen * 0.7, bigScreen * 1.15) : random(140, 420);

  waveLines.push({
    x: random(width * 0.1, width * 0.9),
    y: random(height * 0.1, height * 0.9),
    vx: random(-3.2, 3.2),
    vy: random(-3.2, 3.2),
    angle: random(TWO_PI),
    spin: random(-0.028, 0.028),
    length: len,
    amp: map(energy, 0.2, 1, 50, isHuge ? 220 : 140, true),
    bend: random(45, isHuge ? 180 : 110),
    weight: isHuge ? random(2.5, 4.5) : random(1.5, 2.8),
    noiseSeed: random(1000),
    hue: (hueVal + 360) % 360,
    alpha: 95,
    trail: []
  });
}

function updateWaveLines(wave) {
  blendMode(ADD);
  noFill();

  for (let i = waveLines.length - 1; i >= 0; i--) {
    let w = waveLines[i];

    //save recent positions to draw fading motion echoes
    if (frameCount % 2 === 0) {
      w.trail.push({ x: w.x, y: w.y, angle: w.angle });
      if (w.trail.length > 10) {
        w.trail.shift();
      }
    }

    w.x += w.vx;
    w.y += w.vy;
    w.angle += w.spin;
    w.alpha -= 1.6;

    if (w.alpha <= 0) {
      waveLines.splice(i, 1);
      continue;
    }

    drawWaveSegment(w, wave);
  }

  blendMode(BLEND);
}

function drawWaveSegment(w, wave) {
  //draw duplicated echo trail behind the moving wave
  for (let i = 0; i < w.trail.length; i++) {
    let past = w.trail[i];
    let ratio = (i + 1) / (w.trail.length + 1);
    let trailHue = (w.hue + (w.trail.length - i) * 7) % 360;

    push();
    translate(past.x, past.y);
    rotate(past.angle);
    stroke(trailHue, 85, 95, w.alpha * ratio * 0.42);
    strokeWeight(w.weight * 0.85);
    drawWaveShape(w, wave);
    pop();
  }

  push();
  translate(w.x, w.y);
  rotate(w.angle);

  //outer glow stroke
  stroke(w.hue, 90, 100, w.alpha * 0.3);
  strokeWeight(w.weight * 3.5);
  drawWaveShape(w, wave);

  //bright core stroke
  stroke(w.hue, 45, 100, w.alpha);
  strokeWeight(w.weight);
  drawWaveShape(w, wave);

  pop();
}

function drawWaveShape(w, wave) {
  let step = 6;
  let tMotion = frameCount * 0.04;
  beginShape();
  for (let i = 0; i < wave.length; i += step) {
    let t = i / (wave.length - 1);
    let fadeEnds = sin(t * PI);

    //organic curve and noise distortion along the line
    let bendCurve = sin(t * TWO_PI + tMotion + w.noiseSeed) * w.bend * (0.45 + bass);
    let noiseWarp = map(noise(w.noiseSeed + t * 3, tMotion), 0, 1, -1, 1) * w.bend * (0.6 + mid);
    let px = map(t, 0, 1, -w.length / 2, w.length / 2) + noiseWarp * 0.35 * fadeEnds;
    let py = (wave[i] * w.amp + bendCurve + noiseWarp) * fadeEnds;
    vertex(px, py);
  }
  endShape();
}

//split spectrum into bands and detect beats from instant waveform energy
function updateAudioBands(wave) {
  let spectrum = fft.analyze();

  let rawBass = sqrt(getPeakEnergy(spectrum, 1, 5));
  let rawMid = sqrt(getPeakEnergy(spectrum, 6, 32));
  let rawTreble = sqrt(getPeakEnergy(spectrum, 35, 180));

  bass = map(rawBass, 0.2, 0.48, 0, 1, true);
  mid = map(rawMid, 0.08, 0.25, 0, 1, true);
  treble = map(rawTreble, 0.015, 0.08, 0, 1, true);

  //instant RMS volume from waveform (zero smoothing lag)
  let sumSq = 0;
  for (let i = 0; i < wave.length; i += 4) {
    sumSq += wave[i] * wave[i];
  }
  let rms = sqrt(sumSq / (wave.length / 4));
  waveEnergy = map(rms, 0.05, 0.3, 0, 1, true);
  energyAvg = lerp(energyAvg, waveEnergy, 0.08);

  if (beatCooldown > 0) {
    beatCooldown--;
  }
  if (hatCooldown > 0) {
    hatCooldown--;
  }

  //trigger on sharp energy peaks in sync with beats
  isBeat = waveEnergy > energyAvg * 1.22 && waveEnergy - prevEnergy > 0.08 && waveEnergy > 0.35 && beatCooldown === 0;
  if (isBeat) {
    beatCooldown = 16;
  }

  isTrebleHit = treble - prevTreble > 0.14 && treble > 0.3 && hatCooldown === 0;
  if (isTrebleHit) {
    hatCooldown = 10;
  }

  prevEnergy = waveEnergy;
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
