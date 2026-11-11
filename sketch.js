let song;
let fft;

let bass = 0;
let mid = 0;
let treble = 0;
let waveEnergy = 0;

let peakBass = 0.25;
let peakMid = 0.15;
let peakTreble = 0.06;
let peakRms = 0.18;

let prevSpectrum = [];
let lowFluxAvg = 0;
let highFluxAvg = 0;
let rmsAvg = 0;
let prevRms = 0;
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

  song = await loadSound("assets/tnt.mp3");
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
      spawnAuraBurst(1, 260, min(width, height) * 0.85, 0.58);
      spawnWaveLine(max(bass, waveEnergy), 0);
    }
    if (isTrebleHit) {
      spawnAuraBurst(1, 160, 420, 0.62);
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

    if (auras.length > 10) {
      auras.shift();
    }
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

  if (waveLines.length > 7) {
    waveLines.shift();
  }
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

//adaptive bands and spectral flux beat detection
function updateAudioBands(wave) {
  let spectrum = fft.analyze();

  let rawBass = sqrt(getPeakEnergy(spectrum, 1, 5));
  let rawMid = sqrt(getPeakEnergy(spectrum, 6, 32));
  let rawTreble = sqrt(getPeakEnergy(spectrum, 35, 180));

  let sumSq = 0;
  for (let i = 0; i < wave.length; i += 4) {
    sumSq += wave[i] * wave[i];
  }
  let rms = sqrt(sumSq / (wave.length / 4));

  //auto-adjust peaks so loud or quiet tracks do not clip
  peakBass = max(rawBass, peakBass * 0.996, 0.25);
  peakMid = max(rawMid, peakMid * 0.996, 0.15);
  peakTreble = max(rawTreble, peakTreble * 0.996, 0.06);
  peakRms = max(rms, peakRms * 0.996, 0.18);

  bass = constrain(rawBass / peakBass, 0, 1);
  mid = constrain(rawMid / peakMid, 0, 1);
  treble = constrain(rawTreble / peakTreble, 0, 1);
  waveEnergy = constrain(rms / peakRms, 0, 1);

  //measure sudden new energy across frequencies (spectral flux)
  let lowFlux = 0;
  let highFlux = 0;

  if (prevSpectrum.length === spectrum.length) {
    for (let i = 1; i <= 20; i++) {
      let diff = sqrt(spectrum[i]) - prevSpectrum[i];
      if (diff > 0) {
        lowFlux += diff;
      }
    }
    for (let i = 30; i <= 140; i++) {
      let diff = sqrt(spectrum[i]) - prevSpectrum[i];
      if (diff > 0) {
        highFlux += diff;
      }
    }
  }

  for (let i = 0; i < spectrum.length; i++) {
    prevSpectrum[i] = sqrt(spectrum[i]);
  }

  lowFluxAvg = lerp(lowFluxAvg, lowFlux, 0.12);
  highFluxAvg = lerp(highFluxAvg, highFlux, 0.12);
  rmsAvg = lerp(rmsAvg, rms, 0.08);

  if (beatCooldown > 0) {
    beatCooldown--;
  }
  if (hatCooldown > 0) {
    hatCooldown--;
  }

  //catch both spectral hits in loud parts and isolated drum hits in quiet parts
  let fluxBeat = lowFlux > max(lowFluxAvg * 1.45, 0.025);
  let rmsBeat = rms > max(rmsAvg * 1.5, 0.025) && rms > prevRms * 1.25;

  isBeat = (fluxBeat || rmsBeat) && beatCooldown === 0;
  if (isBeat) {
    beatCooldown = 11;
  }

  isTrebleHit = highFlux > max(highFluxAvg * 1.55, 0.035) && hatCooldown === 0;
  if (isTrebleHit) {
    hatCooldown = 11;
  }

  prevRms = rms;
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
