// game.js

import { drawPegs, pegs, pegRadius, prizes } from './board.js';
import { updateHighScores } from './main.js';
import { pegRadius } from './board.js';
import { updateHighScores } from './main.js';

let isPlaying = false;
let score = 0;
let playButton, messageArea, piBalanceP;

const plinkSound = new Audio('sounds/plink.wav');
const winSound = new Audio('sounds/win.mp3');

function handleEndOfGame(canvas, ballInstance, boardInstance) {
    if (!ballInstance) return;
    const prizeIndex = Math.floor((ballInstance.x / canvas.width) * boardInstance.prizes.length);
    const prize = boardInstance.prizes[prizeIndex];
    score += prize;
    winSound.play();
    messageArea.textContent = `You won ${prize} points! Total score: ${score}`;
    piBalanceP.textContent = `Score: ${score}`;
    playButton.disabled = false;
    // The frontend no longer saves scores locally, it will fetch from the backend
    updateHighScores(score);
}

function updateGame(canvas, ctx, ballInstance, boardInstance) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    boardInstance.draw(ctx);
    ballInstance.draw(ctx);
    ballInstance.vy += 0.2;
    ballInstance.x += ballInstance.vx;
    ballInstance.y += ballInstance.vy;

    boardInstance.pegs.forEach(peg => {
        const dx = ballInstance.x - peg.x;
        const dy = ballInstance.y - peg.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < ballInstance.radius + pegRadius) {
            plinkSound.play();
            const angle = Math.atan2(dy, dx);
            const speed = Math.sqrt(ballInstance.vx * ballInstance.vx + ballInstance.vy * ballInstance.vy);
            ballInstance.vx = Math.cos(angle) * speed * 0.9;
            ballInstance.vy = Math.sin(angle) * speed * 0.9;
        }
    });

    if (ballInstance.x - ballInstance.radius < 0 || ballInstance.x + ballInstance.radius > canvas.width) {
        ballInstance.vx *= -0.8;
    }

    if (ballInstance.y > canvas.height - ballInstance.radius) {
        handleEndOfGame(canvas, ballInstance, boardInstance);
        ballInstance = null;
        isPlaying = false;
        return;
    }
    requestAnimationFrame(() => updateGame(canvas, ctx, ballInstance, boardInstance));
}

export function startGameLoop(canvas, ctx, elements, ballInstance, boardInstance) {
    playButton = elements.playButton;
    messageArea = elements.messageArea;
    piBalanceP = elements.piBalanceP;
    if (isPlaying) return;
    isPlaying = true;
    messageArea.textContent = "Dropping ball...";
    playButton.disabled = true;
    updateGame(canvas, ctx, ballInstance, boardInstance);
}

let isPlaying = false;
let score = 0;
let playButton, messageArea, piBalanceP;

// Create audio objects for sound effects
const plinkSound = new Audio('sounds/plink.wav');
const winSound = new Audio('sounds/win.mp3');

// Function to handle what happens when the ball reaches the bottom
function handleEndOfGame(canvas, ballInstance) {
    if (!ballInstance) return;

    const prizeIndex = Math.floor(
        (ballInstance.x / canvas.width) * prizes.length
    );
    
    const prize = prizes[prizeIndex];
    score += prize;

    winSound.play();

    messageArea.textContent = `You won ${prize} points! Total score: ${score}`;
    piBalanceP.textContent = `Score: ${score}`;
    playButton.disabled = false;

    updateHighScores(score);
}

// Main game loop
function updateGame(canvas, ctx, ballInstance) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPegs(ctx);
    
    // Call the draw method on the Ball instance
    ballInstance.draw(ctx);

    // Apply gravity
    ballInstance.vy += 0.2;

    // Update ball position
    ballInstance.x += ballInstance.vx;
    ballInstance.y += ballInstance.vy;

    // Collision detection with pegs
    pegs.forEach(peg => {
        const dx = ballInstance.x - peg.x;
        const dy = ballInstance.y - peg.y;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance < ballInstance.radius + pegRadius) {
            plinkSound.play();

            const angle = Math.atan2(dy, dx);
            const speed = Math.sqrt(ballInstance.vx * ballInstance.vx + ballInstance.vy * ballInstance.vy);
            
            ballInstance.vx = Math.cos(angle) * speed * 0.9;
            ballInstance.vy = Math.sin(angle) * speed * 0.9;
        }
    });
    
    // Keep ball within horizontal bounds
    if (ballInstance.x - ballInstance.radius < 0 || ballInstance.x + ballInstance.radius > canvas.width) {
        ballInstance.vx *= -0.8;
    }

    // Check if the ball has reached the bottom
    if (ballInstance.y > canvas.height - ballInstance.radius) {
        handleEndOfGame(canvas, ballInstance);
        ballInstance = null;
        isPlaying = false;
        return;
    }
    
    requestAnimationFrame(() => updateGame(canvas, ctx, ballInstance));
}

function startGameLoop(canvas, ctx, elements, ballInstance) {
    playButton = elements.playButton;
    messageArea = elements.messageArea;
    piBalanceP = elements.piBalanceP;
    if (isPlaying) return;
    isPlaying = true;
    messageArea.textContent = "Dropping ball...";
    playButton.disabled = true;
    updateGame(canvas, ctx, ballInstance);
}

export { startGameLoop, score, isPlaying };
function safePlay(audio) {
  // Play audio but swallow promise rejections (browsers block autoplay sometimes)
  try {
    const p = audio.play();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch {
    // ignore
  }
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Called when the ball reaches the bottom of the canvas
function handleEndOfGame(canvas) {
  // Guard: ball might be null/undefined
  if (!ball || typeof ball.x !== 'number') return;

  // Determine prize index and clamp to valid range
  const rawIndex = Math.floor((ball.x / canvas.width) * prizes.length);
  const prizeIndex = clamp(rawIndex, 0, prizes.length - 1);
  const prize = prizes[prizeIndex] || 0;

  score += prize;

  safePlay(winSound);

  if (messageArea) messageArea.textContent = `You won ${prize} points! Total score: ${score}`;
  if (piBalanceP) piBalanceP.textContent = `Score: ${score}`;
  if (playButton) playButton.disabled = false;

  // Update high-scores (main.js handles storage/format)
  try {
    updateHighScores(score);
  } catch (e) {
    // avoid breaking the UI if high-score update fails
    // console.warn('updateHighScores failed', e);
  }
}

// Physics step and rendering loop (uses requestAnimationFrame timestamps)
function startGameLoop(canvas, ctx, elements = {}) {
  playButton = elements.playButton || playButton;
  messageArea = elements.messageArea || messageArea;
  piBalanceP = elements.piBalanceP || piBalanceP;

  if (isPlaying) return; // already running
  isPlaying = true;

  if (messageArea) messageArea.textContent = 'Dropping ball...';
  if (playButton) playButton.disabled = true;

  lastTimestamp = null;

  // Bind a local loop so we can cancel it via rafId
  function loop(timestamp) {
    if (!lastTimestamp) lastTimestamp = timestamp;
    let dt = (timestamp - lastTimestamp) / 1000; // convert ms -> s
    // Clamp huge steps (tab unfocus or debugging)
    if (dt > MAX_STEP) dt = MAX_STEP;
    lastTimestamp = timestamp;

    // Clear and draw board
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPegs(ctx);
    drawBall(ctx);

    // If ball exists, update physics
    if (ball && typeof ball.x === 'number') {
      // Apply gravity (scaled by dt)
      ball.vy += GRAVITY * dt * 0.001; // small scale factor to match original feel

      // Integrate position
      ball.x += ball.vx * dt * 60; // scale velocities to pixels/frame-like feel
      ball.y += ball.vy * dt * 60;

      // Peg collisions - robust resolution to avoid sticking
      for (let i = 0; i < pegs.length; i += 1) {
        const peg = pegs[i];
        const dx = ball.x - peg.x;
        const dy = ball.y - peg.y;
        const dist = Math.hypot(dx, dy);
        const minDist = ballRadius + pegRadius;

        if (dist > 0 && dist < minDist) {
          // Normal vector from peg -> ball
          const nx = dx / dist;
          const ny = dy / dist;

          // Relative velocity along the normal
          const relVel = ball.vx * nx + ball.vy * ny;

          // Only resolve if moving into the peg (prevent double responses)
          if (relVel < 0.0001) {
            // Reflect velocity about normal with restitution
            ball.vx = (ball.vx - (1 + RESTITUTION) * relVel * nx);
            ball.vy = (ball.vy - (1 + RESTITUTION) * relVel * ny);

            // Nudge ball out of overlap
            const overlap = minDist - dist;
            ball.x += nx * overlap;
            ball.y += ny * overlap;

            // Play plink sound but throttle it
            const now = performance.now();
            if (now - lastPlinkTime > PLINK_MIN_INTERVAL) {
              lastPlinkTime = now;
              safePlay(plinkSound);
            }
          }
        }
      }

      // Side walls
      if (ball.x - ballRadius < 0) {
        ball.x = ballRadius;
        ball.vx = -ball.vx * WALL_DAMPING;
      } else if (ball.x + ballRadius > canvas.width) {
        ball.x = canvas.width - ballRadius;
        ball.vx = -ball.vx * WALL_DAMPING;
      }

      // Bottom check
      if (ball.y > canvas.height - ballRadius) {
        // finalize game
        handleEndOfGame(canvas);

        // Clear ball and stop playing
        // Note: original code reassigns imported `ball` to null.
        // Many bundlers/export patterns allow mutation; keep consistent with project expectations:
        try {
          // If ball is an exported variable that can be reassigned, this will work.
          // Otherwise, projects typically provide a reset function — adapt as needed.
          // eslint-disable-next-line no-global-assign
          // (This try/catch prevents hard exceptions if assignment is not permitted.)
          ball = null;
        } catch {
          // If we can't reassign, attempt to mark it inactive if supported
          if (typeof ball === 'object' && ball !== null) {
            ball.active = false;
          }
        }

        isPlaying = false;
        lastTimestamp = null;
        rafId = null;
        return; // stop the loop; caller will re-enable button in handleEndOfGame
      }
    }

    rafId = requestAnimationFrame(loop);
  }

  rafId = requestAnimationFrame(loop);
}

// Stop loop (useful for cleanup or switching screens)
function stopGameLoop() {
  if (rafId) {
    cancelAnimationFrame(rafId);
    rafId = null;
  }
  isPlaying = false;
}

// Utility getters / resetters for external code
function getScore() {
  return score;
}

function resetScore() {
  score = 0;
  if (piBalanceP) piBalanceP.textContent = `Score: ${score}`;
}

function getIsPlaying() {
  return isPlaying;
}

export {
  startGameLoop,
  stopGameLoop,
  getScore,
  resetScore,
  getIsPlaying,
  // keep legacy exports in case other modules import them directly
  score,
  isPlaying,
};
