// frontend/game.js
// Improved, more robust game loop and collision handling for Plinko-on-Pi.
// Author: refactor by Copilot-style assistant (kept human-like, idiomatic JS)

import { drawPegs, pegs, pegRadius, prizes } from './board.js';
import { ball, ballRadius, drawBall } from './ball.js';
import { updateHighScores } from './main.js';

let isPlaying = false;
let score = 0;

// UI references (populated when game starts)
let playButton = null;
let messageArea = null;
let piBalanceP = null;

// Animation frame handle and timing
let rafId = null;
let lastTimestamp = null;

// Physics tuning
const GRAVITY = 980; // px / s^2 (scaled; you can tune)
const MAX_STEP = 0.05; // seconds - clamp dt to avoid tunneling on tab-switch
const RESTITUTION = 0.9; // bounciness on collisions
const WALL_DAMPING = 0.8; // horizontal damping when hitting side walls

// Audio
const plinkSound = new Audio('sounds/plink.wav');
plinkSound.preload = 'auto';
const winSound = new Audio('sounds/win.mp3');
winSound.preload = 'auto';

// Simple throttle for the plink sound so lots of peg collisions don't spam audio
let lastPlinkTime = 0;
const PLINK_MIN_INTERVAL = 40; // ms

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
