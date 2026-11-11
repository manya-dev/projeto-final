let song;
let fft;

//layers for aura trail feedback
let trailLayer;
let prevLayer;

let smoothBass = 0;
let smoothMid = 0;
let smoothTreble = 0;
let centerX = 0;
let centerY = 0;
let hueOffset = 0;

//load default audio
async function setup() {
  createCanvas(windowWidth, windowHeight);
  pixelDensity(1);
  colorMode(HSB, 360, 100, 100, 100);

  trailLayer = createGraphics(width, height);
  trailLayer.colorMode(HSB, 360, 100, 100, 100);
  prevLayer = createGraphics(width, height);
  prevLayer.colorMode(HSB, 360, 100, 100, 100);

  centerX = width / 2;
  centerY = height / 2;

  song = await loadSound("assets/track.wav");
  fft = new p5.FFT(512);
  fft.setInput(song);
}

function draw() {
  background(0);

  if (!song || !fft) {
    return;
  }

  let spectrum = fft.analyze();
  let wave = fft.waveform();

  //get bass, mid and treble energy
  let rawBass = getEnergyRange(spectrum, 1, 5);
  let rawMid = getEnergyRange(spectrum, 6, 28);
  let rawTreble = getEnergyRange(spectrum, 35, 140);

  smoothBass = lerp(smoothBass, map(rawBass, 0.02, 0.35, 0, 1, true), 0.35);
  smoothMid = lerp(smoothMid, map(rawMid, 0.01, 0.25, 0, 1, true), 0.25);
  smoothTreble = lerp(smoothTreble, map(rawTreble, 0.005, 0.12, 0, 1, true), 0.25);

  //drifting center so nothing stays fixed
  let driftX = map(noise(frameCount * 0.004), 0, 1, -width * 0.12, width * 0.12);
  let driftY = map(noise(frameCount * 0.004 + 50), 0, 1, -height * 0.12, height * 0.12);
  let targetX = width / 2 + driftX;
  let targetY = height / 2 + driftY;

  if (mouseX > 0 && mouseX < width && mouseY > 0 && mouseY < height) {
    targetX = lerp(targetX, mouseX, 0.35);
    targetY = lerp(targetY, mouseY, 0.35);
  }

  centerX = lerp(centerX, targetX, 0.06);
  centerY = lerp(centerY, targetY, 0.06);

  if (song.isPlaying()) {
    hueOffset = (hueOffset + 0.4 + smoothTreble * 2.2) % 360;
  }

  drawTunnelWave(wave);

  image(trailLayer, 0, 0);

  //save frame for next feedback step
  prevLayer.clear();
  prevLayer.image(trailLayer, 0, 0);

  if (!song.isPlaying()) {
    noStroke();
    fill(0, 0, 100, 70);
    textFont("Courier New");
    textAlign(CENTER);
    textSize(16);
    text("Click anywhere to play", width / 2, height - 30);
  }
}

//mode 1: radial wave and tunnel trail
function drawTunnelWave(wave) {
  let zoom = 1.025 + smoothBass * 0.055;
  let fadeAlpha = song.isPlaying() ? 88 : 80;

  trailLayer.clear();
  trailLayer.push();
  trailLayer.blendMode(BLEND);
  trailLayer.imageMode(CORNER);
  trailLayer.tint(0, 0, 100, fadeAlpha);
  trailLayer.translate(centerX, centerY);
  trailLayer.scale(zoom);
  trailLayer.rotate(sin(frameCount * 0.01) * 0.008);
  trailLayer.image(prevLayer, -centerX, -centerY);
  trailLayer.pop();

  trailLayer.push();
  trailLayer.blendMode(ADD);
  trailLayer.translate(centerX, centerY);

  //soft colored aura glow in the center
  let auraHue = (hueOffset + 320) % 360;
  let auraSize = min(width, height) * (0.22 + smoothBass * 0.28);
  trailLayer.noStroke();
  trailLayer.fill(auraHue, 85, 80, 12 + smoothBass * 18);
  trailLayer.circle(0, 0, auraSize * 1.6);
  trailLayer.fill((auraHue + 50) % 360, 75, 95, 10 + smoothMid * 15);
  trailLayer.circle(0, 0, auraSize);

  //outer and inner waveform rings
  let baseRadius = min(width, height) * (0.12 + smoothBass * 0.09);
  let waveAmp = min(width, height) * (0.04 + smoothMid * 0.14);

  drawWaveRing(trailLayer, wave, baseRadius, waveAmp, hueOffset, 2.2, 85);
  drawWaveRing(trailLayer, wave, baseRadius * 0.88, waveAmp * 0.7, (hueOffset + 140) % 360, 1.3, 60);

  trailLayer.blendMode(BLEND);
  trailLayer.pop();
}

//closed circular waveform
function drawWaveRing(layer, wave, radius, amp, hueVal, weight, alphaVal) {
  layer.noFill();
  layer.stroke(hueVal, 80, 100, alphaVal);
  layer.strokeWeight(weight);
  layer.beginShape();

  let step = 4;
  for (let i = 0; i < wave.length; i += step) {
    let angle = map(i, 0, wave.length, 0, TWO_PI);
    let r = radius + wave[i] * amp;
    let x = cos(angle) * r;
    let y = sin(angle) * r;
    layer.vertex(x, y);
  }

  layer.endShape(CLOSE);
}

//average energy for frequency range
function getEnergyRange(spectrum, startIdx, endIdx) {
  let sum = 0;
  let count = 0;

  for (let i = startIdx; i <= endIdx && i < spectrum.length; i++) {
    sum += spectrum[i];
    count++;
  }

  return count > 0 ? sum / count : 0;
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

  trailLayer = createGraphics(width, height);
  trailLayer.colorMode(HSB, 360, 100, 100, 100);
  prevLayer = createGraphics(width, height);
  prevLayer.colorMode(HSB, 360, 100, 100, 100);
}
