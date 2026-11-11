let song;
let fft;

//load default audio
async function setup() {
  createCanvas(windowWidth, windowHeight);

  song = await loadSound("assets/track.wav");
  fft = new p5.FFT(0.8, 512);
}

function draw() {
  background(0);

  if (!song || !fft) {
    return;
  }

  fft.analyze();
  let bass = fft.getEnergy("bass");
  let size = map(bass, 0, 255, 60, 260);

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
    song.loop();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
