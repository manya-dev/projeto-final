let song;
let fft;

let bass = 0;
let mid = 0;
let treble = 0;
let bassAvg = 0;
let beatCooldown = 0;
let isBeat = false;

//load default audio
async function setup() {
  createCanvas(windowWidth, windowHeight);

  song = await loadSound("assets/track.wav");
  fft = new p5.FFT(512);
  fft.analyzer.smoothing = 0.35;
  fft.setInput(song);
}

function draw() {
  background(0);

  if (!song || !fft) {
    return;
  }

  updateAudioBands();

  //test circles for bass, mid, treble and beat
  noFill();
  strokeWeight(2);

  stroke(isBeat ? 255 : 120, 220, 255);
  circle(width / 2 - 140, height / 2, map(bass, 0, 1, 30, 140));

  stroke(120, 255, 180);
  circle(width / 2, height / 2, map(mid, 0, 1, 30, 140));

  stroke(255, 120, 220);
  circle(width / 2 + 140, height / 2, map(treble, 0, 1, 30, 140));

  if (!song.isPlaying()) {
    noStroke();
    fill(255, 180);
    textFont("Courier New");
    textAlign(CENTER);
    textSize(16);
    text("Click anywhere to play", width / 2, height - 30);
  }
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
