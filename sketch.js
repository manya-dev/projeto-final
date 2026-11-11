let song;
let fft;

let bass = 0;
let mid = 0;
let treble = 0;
let bassAvg = 0;
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
  fft.analyzer.smoothing = 0.4;
  fft.setInput(song);
}

function draw() {
  //soft fade for glowing trails
  blendMode(BLEND);
  background(0, 0, 0, 18);

  if (!song || !fft) {
    return;
  }

  updateAudioBands();

  if (song.isPlaying()) {
    spawnAuras();
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

//create random auras synced to sound
function spawnAuras() {
  if (isBeat) {
    let count = bass > 0.75 ? 2 : 1;
    for (let i = 0; i < count; i++) {
      let hueVal = (frameCount * 1.5 + random(-40, 40)) % 360;
      let maxSize = map(bass, 0.2, 1, 140, min(width, height) * 0.55);
      auras.push(makeAura(hueVal, maxSize));
    }
  }

  if (mid > 0.55 && random() < 0.22) {
    let hueVal = (160 + random(-50, 70)) % 360;
    let maxSize = map(mid, 0.4, 1, 90, 260);
    auras.push(makeAura(hueVal, maxSize));
  }
}

function makeAura(hueVal, maxSize) {
  return {
    x: random(width),
    y: random(height),
    vx: random(-0.8, 0.8),
    vy: random(-0.8, 0.8),
    size: maxSize * 0.25,
    maxSize: maxSize,
    hue: (hueVal + 360) % 360,
    alpha: random(22, 38)
  };
}

function updateAuras() {
  blendMode(ADD);
  noStroke();

  for (let i = auras.length - 1; i >= 0; i--) {
    let a = auras[i];
    a.x += a.vx;
    a.y += a.vy;
    a.size = lerp(a.size, a.maxSize, 0.08);
    a.alpha -= 0.45;

    //soft layered glow
    fill(a.hue, 85, 90, a.alpha * 0.35);
    circle(a.x, a.y, a.size);
    fill(a.hue, 80, 95, a.alpha * 0.55);
    circle(a.x, a.y, a.size * 0.62);
    fill((a.hue + 25) % 360, 60, 100, a.alpha * 0.7);
    circle(a.x, a.y, a.size * 0.3);

    if (a.alpha <= 0) {
      auras.splice(i, 1);
    }
  }

  blendMode(BLEND);
}

//split spectrum into bass, mid, treble and detect beat
function updateAudioBands() {
  let spectrum = fft.analyze();

  let rawBass = sqrt(getPeakEnergy(spectrum, 1, 5));
  let rawMid = sqrt(getPeakEnergy(spectrum, 6, 32));
  let rawTreble = sqrt(getPeakEnergy(spectrum, 35, 180));

  bass = map(rawBass, 0.2, 0.48, 0, 1, true);
  mid = map(rawMid, 0.08, 0.25, 0, 1, true);
  treble = map(rawTreble, 0.015, 0.08, 0, 1, true);

  bassAvg = lerp(bassAvg, bass, 0.12);
  if (beatCooldown > 0) {
    beatCooldown--;
  }

  isBeat = bass > bassAvg * 1.15 && bass > 0.25 && beatCooldown === 0;
  if (isBeat) {
    beatCooldown = 8;
  }
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
