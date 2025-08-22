// game.js

import { drawPegs, pegs, pegRadius, prizes } from './board.js';
import { ball, ballRadius, drawBall } from './ball.js';
import { updateHighScores } from './main.js'; // Import the new high-score function

let isPlaying = false;
let score = 0;
let playButton, messageArea, piBalanceP;

// Create audio objects for sound effects
const plinkSound = new Audio('sounds/plink.wav'); // Be sure to create a 'sounds' folder and add your files
const winSound = new Audio('sounds/win.mp3');

// Function to handle what happens when the ball reaches the bottom
function handleEndOfGame(canvas) {
    if (!ball) return;

    // The prizes are located at the bottom of the canvas.
    const prizeIndex = Math.floor(
        (ball.x / canvas.width) * prizes.length
    );
    
    const prize = prizes[prizeIndex];
    score += prize; // Add the prize to the total score

    // Play the win sound
    winSound.play();

    messageArea.textContent = `You won ${prize} points! Total score: ${score}`;
    piBalanceP.textContent = `Score: ${score}`;
    playButton.disabled = false;

    // Update the high-score board
    updateHighScores(score);
}

// Main game loop
function updateGame(canvas, ctx) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPegs(ctx);
    drawBall(ctx);

    if (ball) {
        // Apply gravity
        ball.vy += 0.2;

        // Update ball position
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Collision detection with pegs
        pegs.forEach(peg => {
            const dx = ball.x - peg.x;
            const dy = ball.y - peg.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < ballRadius + pegRadius) {
                // Play the plink sound
                plinkSound.play();

                const angle = Math.atan2(dy, dx);
                const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                
                ball.vx = Math.cos(angle) * speed * 0.9;
                ball.vy = Math.sin(angle) * speed * 0.9;
            }
        });
        
        // Keep ball within horizontal bounds
        if (ball.x - ballRadius < 0 || ball.x + ballRadius > canvas.width) {
            ball.vx *= -0.8;
        }

        // Check if the ball has reached the bottom
        if (ball.y > canvas.height - ballRadius) {
            handleEndOfGame(canvas);
            ball = null;
            isPlaying = false;
            return;
        }
    }
    
    requestAnimationFrame(() => updateGame(canvas, ctx));
}

function startGameLoop(canvas, ctx, elements) {
    playButton = elements.playButton;
    messageArea = elements.messageArea;
    piBalanceP = elements.piBalanceP;
    if (isPlaying) return;
    isPlaying = true;
    messageArea.textContent = "Dropping ball...";
    playButton.disabled = true;
    updateGame(canvas, ctx);
}

export { startGameLoop, score, isPlaying };
