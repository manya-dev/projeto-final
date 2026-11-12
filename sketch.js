let song;
let fft;
let isLoadingTrack = false;
let currentTrackName = "";
let currentBlobUrl = null;
let saveNextFrame = false;

let bass = 0;
let mid = 0;
let treble = 0;
let prevBass = 0;
let prevMid = 0;
let prevTreble = 0;
let waveEnergy = 0;

let peakBass = 0.18;
let peakMid = 0.1;
let peakTreble = 0.035;
let peakRms = 0.1;

let prevSpectrum = [];
let fluxAvg = 0;
let rmsAvg = 0;
let prevRms = 0;

let hitCooldown = 0;
let isVolumeHit = false;

let bgHue = 260;
let bgBright = 8;

let auras = [];
let waveLines = [];
let sparks = [];

//setup canvas, fft and load random online track
function setup() {
  createCanvas(windowWidth, windowHeight);
  colorMode(HSB, 360, 100, 100, 100);
  background(0);

  fft = new p5.FFT(512);
  fft.analyzer.smoothing = 0.15;

  loadRandomTrack(false);
}

//fetch random track from Audius API with local fallback
async function loadRandomTrack(autoPlay) {
  if (isLoadingTrack) {
    return;
  }

  isLoadingTrack = true;
  if (song && song.isPlaying()) {
    song.stop();
  }

  //reset adaptive audio levels for new track
  peakBass = 0.18;
  peakMid = 0.1;
  peakTreble = 0.035;
  peakRms = 0.1;
  fluxAvg = 0;
  rmsAvg = 0;
  prevRms = 0;

  let loaded = false;

  try {
    let controller = new AbortController();
    let timer = setTimeout(() => controller.abort(), 7000);
    let res = await fetch("https://api.audius.co/v1/tracks/trending?limit=25&app_name=audio_auras", {
      signal: controller.signal
    });
    clearTimeout(timer);

    if (res.ok) {
      let json = await res.json();
      let tracks = json.data || [];
      if (tracks.length > 0) {
        let pick = tracks[floor(random(tracks.length))];
        let streamUrl = `https://api.audius.co/v1/tracks/${pick.id}/stream?app_name=audio_auras`;

        let audioCtrl = new AbortController();
        let audioTimer = setTimeout(() => audioCtrl.abort(), 12000);
        let audioRes = await fetch(streamUrl, { signal: audioCtrl.signal });
        clearTimeout(audioTimer);

        if (audioRes.ok) {
          let blob = await audioRes.blob();
          if (currentBlobUrl) {
            URL.revokeObjectURL(currentBlobUrl);
          }
          currentBlobUrl = URL.createObjectURL(blob);
          song = await loadSound(currentBlobUrl);
          currentTrackName = `${pick.title} - ${pick.user ? pick.user.name : "Audius"}`;
          loaded = true;
        }
      }
    }
  } catch (err) {
    //fallback to local track if online request fails
  }

  if (!loaded) {
    song = await loadSound("assets/track.wav");
    currentTrackName = "Default Track";
  }

  fft.setInput(song);
  isLoadingTrack = false;

  if (autoPlay && song) {
    song.loop(true);
    song.play();
  }
}

function draw() {
  if (isLoadingTrack || !song || !fft) {
    blendMode(BLEND);
    background(0);
    noStroke();
    fill(0, 0, 100, 75);
    textFont("Courier New");
    textAlign(CENTER);
    textSize(16);
    text("Loading random track...", width / 2, height - 30);
    return;
  }

  let wave = fft.waveform();
  updateAudioBands(wave);

  if (song.isPlaying()) {
    bgHue = (bgHue + 0.12 + mid * 0.35) % 360;
    handleAudioPriority();
  }

  //soft dark tinted background breathing with overall volume
  bgBright = lerp(bgBright, 6 + waveEnergy * 7, 0.1);
  blendMode(BLEND);
  background(bgHue, 55, bgBright);

  updateAuras();
  updateWaveLines(wave);
  updateSparks();

  if (saveNextFrame) {
    saveCanvas("audio-aura-" + frameCount, "png");
    saveNextFrame = false;
  }

  noStroke();
  fill(0, 0, 100, 75);
  textFont("Courier New");
  textAlign(CENTER);
  textSize(16);
  let textToFill = "";
  if (!song.isPlaying()) {
    textToFill = `${currentTrackName}  |  Click to play  |  N: next track  |  S: save`;
  } else {
    textToFill = `${currentTrackName}  |  Click to pause  |  N: next track  |  S: save`;
  }
  text(textToFill, width / 2, height - 30);

}

//volume triggers the event; band with strongest jump + level picks one visual element
function handleAudioPriority() {
  if (!isVolumeHit) {
    return;
  }

  let bassScore = bass * 0.45 + max(0, bass - prevBass) * 1.4;
  let midScore = mid * 0.45 + max(0, mid - prevMid) * 1.4;
  let trebleScore = treble * 0.45 + max(0, treble - prevTreble) * 1.4;

  if (bassScore >= midScore && bassScore >= trebleScore) {
    spawnAuraBurst(1, 240, min(width, height) * (0.45 + waveEnergy * 0.45), 0.42 + waveEnergy * 0.22);
  } else if (midScore >= trebleScore) {
    spawnWaveLine(waveEnergy, 95, waveEnergy > 0.65);
  } else {
    let sparkCount = round(map(waveEnergy, 0, 1, 3, 9, true));
    spawnSparks(random(width * 0.15, width * 0.85), random(height * 0.15, height * 0.85), sparkCount);
  }
}

//spawn stretched blurred auras on bass beats (deep warm/violet hues)
function spawnAuraBurst(count, minSize, maxSize, alphaMax) {
  for (let i = 0; i < count; i++) {
    let baseHue = (230 + random(130) + sin(frameCount * 0.01) * 30) % 360;
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
  let pulse = 1 + waveEnergy * 0.28;

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

//spawn distorted waveform line on mid hits (emerald, cyan, gold hues)
function spawnWaveLine(energy, hueShift, allowHuge) {
  let hueVal = (75 + random(135) + hueShift * 0.2) % 360;
  let bigScreen = max(width, height);
  let isHuge = allowHuge && random() < 0.45;
  let len = isHuge ? random(bigScreen * 0.7, bigScreen * 1.15) : random(140, 380);

  waveLines.push({
    x: random(width * 0.1, width * 0.9),
    y: random(height * 0.1, height * 0.9),
    vx: random(-3.2, 3.2),
    vy: random(-3.2, 3.2),
    angle: random(TWO_PI),
    spin: random(-0.028, 0.028),
    length: len,
    amp: map(energy, 0.2, 1, 30, isHuge ? 130 : 85, true),
    bend: random(25, isHuge ? 110 : 70),
    weight: isHuge ? random(2, 3.6) : random(1.4, 2.4),
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
    if (frameCount % 3 === 0) {
      w.trail.push({ x: w.x, y: w.y, angle: w.angle });
      if (w.trail.length > 6) {
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
  let pts = buildWavePoints(w, wave);

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
    drawWavePoints(pts);
    pop();
  }

  push();
  translate(w.x, w.y);
  rotate(w.angle);

  //outer glow stroke
  stroke(w.hue, 90, 100, w.alpha * 0.3);
  strokeWeight(w.weight * 2.8);
  drawWavePoints(pts);

  //bright core stroke
  stroke(w.hue, 45, 100, w.alpha);
  strokeWeight(w.weight);
  drawWavePoints(pts);

  pop();
}

//compute distorted wave vertices once per frame
function buildWavePoints(w, wave) {
  let pts = [];
  let step = 32;
  let tMotion = frameCount * 0.025;

  for (let i = 0; i < wave.length; i += step) {
    let t = i / (wave.length - 1);
    let fadeEnds = sin(t * PI);

    let bendCurve = sin(t * TWO_PI + tMotion + w.noiseSeed) * w.bend * (0.35 + waveEnergy * 0.75);
    let noiseWarp = map(noise(w.noiseSeed + t * 2.5, tMotion), 0, 1, -1, 1) * w.bend * (0.4 + mid * 0.6);
    let px = map(t, 0, 1, -w.length / 2, w.length / 2) + noiseWarp * 0.25 * fadeEnds;
    let py = (wave[i] * w.amp * (0.5 + waveEnergy * 0.9) + bendCurve + noiseWarp) * fadeEnds;
    pts.push({ x: px, y: py });
  }

  return pts;
}

function drawWavePoints(pts) {
  beginShape();
  for (let i = 0; i < pts.length; i++) {
    vertex(pts[i].x, pts[i].y);
  }
  endShape();
}

//treble sparks: small bright particles with short trails
function spawnSparks(cx, cy, count) {
  let baseHue = random(160, 310);

  for (let i = 0; i < count; i++) {
    let angle = random(TWO_PI);
    let speed = random(2.5, 7) * (0.6 + treble);

    sparks.push({
      x: cx,
      y: cy,
      px: cx,
      py: cy,
      vx: cos(angle) * speed,
      vy: sin(angle) * speed,
      size: random(3, 8),
      hue: (baseHue + random(-25, 25) + 360) % 360,
      alpha: 95
    });

    if (sparks.length > 40) {
      sparks.shift();
    }
  }
}

function updateSparks() {
  blendMode(ADD);

  for (let i = sparks.length - 1; i >= 0; i--) {
    let s = sparks[i];
    s.px = s.x;
    s.py = s.y;
    s.x += s.vx;
    s.y += s.vy;
    s.vx *= 0.96;
    s.vy *= 0.96;
    s.alpha -= 2.8;

    if (s.alpha <= 0) {
      sparks.splice(i, 1);
      continue;
    }

    //short streak + bright dot
    stroke(s.hue, 70, 100, s.alpha * 0.7);
    strokeWeight(s.size * 0.45);
    line(s.px, s.py, s.x, s.y);

    noStroke();
    fill(s.hue, 35, 100, s.alpha);
    circle(s.x, s.y, s.size);
  }

  blendMode(BLEND);
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
  peakBass = max(rawBass, peakBass * 0.996, 0.18);
  peakMid = max(rawMid, peakMid * 0.996, 0.1);
  peakTreble = max(rawTreble, peakTreble * 0.996, 0.035);
  peakRms = max(rms, peakRms * 0.996, 0.1);

  prevBass = bass;
  prevMid = mid;
  prevTreble = treble;

  bass = constrain(rawBass / peakBass, 0, 1);
  mid = constrain(rawMid / peakMid, 0, 1);
  treble = constrain(rawTreble / peakTreble, 0, 1);
  waveEnergy = constrain(rms / peakRms, 0, 1);

  //overall spectral change across audible bins
  let flux = 0;
  if (prevSpectrum.length === spectrum.length) {
    for (let i = 1; i <= 140; i++) {
      let diff = sqrt(spectrum[i]) - prevSpectrum[i];
      if (diff > 0) {
        flux += diff;
      }
    }
  }

  for (let i = 0; i < spectrum.length; i++) {
    prevSpectrum[i] = sqrt(spectrum[i]);
  }

  fluxAvg = lerp(fluxAvg, flux, 0.1);
  rmsAvg = lerp(rmsAvg, rms, 0.08);

  if (hitCooldown > 0) {
    hitCooldown--;
  }

  //trigger on loudness jumps (vocals, drums) or spectral bursts
  let rmsSpike = rms > max(rmsAvg * 1.16, 0.02) && rms - prevRms > 0.006;
  let fluxSpike = flux > max(fluxAvg * 1.25, 0.06) && rms > 0.02;

  isVolumeHit = (rmsSpike || fluxSpike) && hitCooldown === 0;
  if (isVolumeHit) {
    hitCooldown = 8;
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
  if (!song || isLoadingTrack) {
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

//keyboard shortcuts: N for next random track, S to save frame, Space for play/pause
function keyPressed() {
  if (key === "n" || key === "N") {
    if (typeof userStartAudio === "function") {
      userStartAudio();
    }
    loadRandomTrack(true);
  } else if (key === "s" || key === "S") {
    saveNextFrame = true;
  } else if (key === " ") {
    mousePressed();
    return false;
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
