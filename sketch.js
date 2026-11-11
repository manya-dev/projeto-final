let song;
let fft;

//load default audio
async function setup() {
  createCanvas(windowWidth, windowHeight);

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
  let bass = getEnergyRange(spectrum, 0, 12);
  let size = map(bass, 0, 0.5, 60, 260, true);

  //test circle for audio reaction
  noFill();
  stroke(120, 220, 255);
  strokeWeight(2);
  circle(width / 2, height / 2, size);

  if (!song.isPlaying()) {
    noStroke();
    fill(255, 180);
    textFont("Courier New");
    textAlign(CENTER);
    textSize(16);
    text("Click anywhere to play", width / 2, height - 30);
  }
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
}
