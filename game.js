const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

const TILE_SIZE = 60;
const GRAVITY_STRENGTH = 900; // px/s^2
const FRICTION = 0.45;
const ROTATION_COOLDOWN = 200; // ms

const levels = [
  {
    layout: [
      "############",
      "#S....#....#",
      "#.##.#.##..#",
      "#....#..#..#",
      "#.####.##..#",
      "#....#.....#",
      "##.#.#######",
      "#..#....#E.#",
      "#..####.#..#",
      "#.....#....#",
      "###.#.##.#.#",
      "############",
    ],
  },
  {
    layout: [
      "############",
      "#S...#.....#",
      "#.###.###..#",
      "#...#...#..#",
      "###.#.#.#..#",
      "#...#.#.#..#",
      "#.###.#.####",
      "#.....#....#",
      "#.#####.##.#",
      "#...O...#E.#",
      "###.#####..#",
      "############",
    ],
  },
  {
    layout: [
      "############",
      "#S...#...E.#",
      "#.###.#.##.#",
      "#...#.#....#",
      "###.#.####.#",
      "#...#....#.#",
      "#.#######.#.#",
      "#.....O..#..#",
      "#.#####.##..#",
      "#.....#.....#",
      "#O###.#O###.#",
      "############",
    ],
  },
];

const state = {
  levelIndex: 0,
  ball: null,
  orientation: 0,
  lastRotation: 0,
  timerStart: performance.now(),
  currentTime: 0,
  bestTime: null,
  levelCompleted: false,
};

const hud = {
  level: document.getElementById("level"),
  totalLevels: document.getElementById("total-levels"),
  timer: document.getElementById("timer"),
  best: document.getElementById("best-time"),
  message: document.getElementById("message"),
};

hud.totalLevels.textContent = levels.length;

function createLevel(levelIndex) {
  const layout = levels[levelIndex].layout;
  let start = null;
  let exit = null;

  layout.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === "S") {
        start = { x: x * TILE_SIZE + TILE_SIZE / 2, y: y * TILE_SIZE + TILE_SIZE / 2 };
      }
      if (cell === "E") {
        exit = { x, y };
      }
    });
  });

  if (!start) {
    throw new Error("Level mangler startposition (S)");
  }
  if (!exit) {
    throw new Error("Level mangler udgang (E)");
  }

  state.ball = {
    x: start.x,
    y: start.y,
    radius: TILE_SIZE * 0.3,
    vx: 0,
    vy: 0,
  };
  state.orientation = 0;
  state.lastRotation = performance.now();
  state.timerStart = performance.now();
  state.currentTime = 0;
  state.levelCompleted = false;
  hud.level.textContent = levelIndex + 1;
  hud.timer.textContent = "0.00s";
}

function tileAt(x, y) {
  const layout = levels[state.levelIndex].layout;
  const col = Math.floor(x / TILE_SIZE);
  const row = Math.floor(y / TILE_SIZE);
  if (row < 0 || row >= layout.length || col < 0 || col >= layout[row].length) {
    return "#";
  }
  return layout[row][col];
}

function sampleTiles(points) {
  return points.map((p) => tileAt(p.x, p.y));
}

function rotateLeft() {
  const now = performance.now();
  if (now - state.lastRotation < ROTATION_COOLDOWN || state.levelCompleted) return;
  state.orientation = (state.orientation + 1) % 4;
  state.lastRotation = now;
  dampVelocityOnRotate();
}

function rotateRight() {
  const now = performance.now();
  if (now - state.lastRotation < ROTATION_COOLDOWN || state.levelCompleted) return;
  state.orientation = (state.orientation + 3) % 4;
  state.lastRotation = now;
  dampVelocityOnRotate();
}

function dampVelocityOnRotate() {
  state.ball.vx *= 0.35;
  state.ball.vy *= 0.35;
}

function update(delta) {
  if (state.levelCompleted) {
    return;
  }

  const gravity = getGravityVector();
  const ball = state.ball;

  ball.vx += gravity.x * GRAVITY_STRENGTH * delta;
  ball.vy += gravity.y * GRAVITY_STRENGTH * delta;

  ball.vx *= 1 - FRICTION * delta;
  ball.vy *= 1 - FRICTION * delta;

  integrate(ball, delta);

  handleLevelTiles();

  state.currentTime = (performance.now() - state.timerStart) / 1000;
  hud.timer.textContent = `${state.currentTime.toFixed(2)}s`;
}

function integrate(ball, delta) {
  const prevX = ball.x;
  const prevY = ball.y;

  const newX = ball.x + ball.vx * delta;
  const collisionX = checkCollision(newX, ball.y, ball.radius);
  if (collisionX) {
    ball.x = prevX;
    ball.vx = 0;
  } else {
    ball.x = newX;
  }

  const newY = ball.y + ball.vy * delta;
  const collisionY = checkCollision(ball.x, newY, ball.radius);
  if (collisionY) {
    ball.y = prevY;
    ball.vy = 0;
  } else {
    ball.y = newY;
  }
}

function checkCollision(x, y, radius) {
  const samples = sampleTiles([
    { x: x - radius, y: y - radius },
    { x: x + radius, y: y - radius },
    { x: x - radius, y: y + radius },
    { x: x + radius, y: y + radius },
  ]);
  return samples.some((cell) => cell === "#");
}

function handleLevelTiles() {
  const { x, y } = state.ball;
  const tile = tileAt(x, y);

  if (tile === "O") {
    restartLevel("Ups! Bolden faldt i et hul.");
    return;
  }
  if (tile === "E") {
    completeLevel();
  }
}

function restartLevel(message) {
  showTemporaryMessage(message, 1500);
  createLevel(state.levelIndex);
}

function completeLevel() {
  state.levelCompleted = true;
  const levelTime = state.currentTime;
  if (state.bestTime === null || levelTime < state.bestTime) {
    state.bestTime = levelTime;
    hud.best.textContent = `${state.bestTime.toFixed(2)}s`;
  }

  if (state.levelIndex < levels.length - 1) {
    showTemporaryMessage("Flot! Videre til næste niveau…", 1500, () => {
      state.levelIndex += 1;
      createLevel(state.levelIndex);
    });
  } else {
    const totalTime = (performance.now() - runStartTime) / 1000;
    showEndMessage(`Du gennemførte labyrinten!\nTotal tid: ${totalTime.toFixed(2)}s`);
  }
}

let runStartTime = performance.now();

function showTemporaryMessage(text, duration, callback) {
  hud.message.textContent = text;
  hud.message.classList.remove("hidden");
  hud.message.classList.add("visible");
  setTimeout(() => {
    hud.message.classList.remove("visible");
    hud.message.classList.add("hidden");
    if (callback) callback();
  }, duration);
}

function showEndMessage(text) {
  hud.message.textContent = text + "\nTryk på R for at starte forfra.";
  hud.message.classList.remove("hidden");
  hud.message.classList.add("visible");
}

function resetGame() {
  runStartTime = performance.now();
  state.levelIndex = 0;
  state.bestTime = null;
  hud.best.textContent = "–";
  createLevel(0);
  hud.message.classList.add("hidden");
  hud.message.classList.remove("visible");
}

function getGravityVector() {
  switch (state.orientation) {
    case 0:
      return { x: 0, y: 1 };
    case 1:
      return { x: -1, y: 0 };
    case 2:
      return { x: 0, y: -1 };
    case 3:
      return { x: 1, y: 0 };
    default:
      return { x: 0, y: 1 };
  }
}

function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const layout = levels[state.levelIndex].layout;

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate(-state.orientation * Math.PI * 0.5);
  ctx.translate(-canvas.width / 2, -canvas.height / 2);

  drawGrid(layout);
  drawBall();

  ctx.restore();
}

function drawGrid(layout) {
  ctx.fillStyle = "#111";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  layout.forEach((row, y) => {
    [...row].forEach((cell, x) => {
      if (cell === "#") {
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      } else if (cell === "O") {
        ctx.fillStyle = "#444";
        ctx.beginPath();
        ctx.arc(
          x * TILE_SIZE + TILE_SIZE / 2,
          y * TILE_SIZE + TILE_SIZE / 2,
          TILE_SIZE * 0.25,
          0,
          Math.PI * 2
        );
        ctx.fill();
      } else if (cell === "E") {
        ctx.strokeStyle = "#66ffcc";
        ctx.lineWidth = 4;
        ctx.strokeRect(x * TILE_SIZE + 8, y * TILE_SIZE + 8, TILE_SIZE - 16, TILE_SIZE - 16);
      }
    });
  });
}

function drawBall() {
  const ball = state.ball;
  const pulse = Math.sin(performance.now() / 250) * 0.06;
  const radius = ball.radius * (1 + pulse);
  ctx.fillStyle = "#ffd54f";
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, radius, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = "rgba(0,0,0,0.2)";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.arc(ball.x, ball.y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function loop(timestamp) {
  if (!lastTick) lastTick = timestamp;
  const delta = Math.min((timestamp - lastTick) / 1000, 0.05);
  lastTick = timestamp;

  update(delta);
  render();

  requestAnimationFrame(loop);
}

let lastTick = 0;

window.addEventListener("keydown", (event) => {
  if (event.key === "ArrowLeft") {
    rotateLeft();
  } else if (event.key === "ArrowRight") {
    rotateRight();
  } else if (event.key.toLowerCase() === "r") {
    resetGame();
  }
});

createLevel(0);
runStartTime = performance.now();
requestAnimationFrame(loop);
