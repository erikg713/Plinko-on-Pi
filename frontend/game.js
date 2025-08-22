// game.js

import { drawPegs, pegs, pegRadius, prizes } from './board.js';
import { ball, ballRadius, drawBall } from './ball.js';

let isPlaying = false;
let score = 0;
let playButton, messageArea, piBalanceP;

// Function to handle what happens when the ball reaches the bottom
function handleEndOfGame(canvas) {
    if (!ball) return;

    // The prizes are located at the bottom of the canvas.
    const prizeIndex = Math.floor(
        (ball.x / canvas.width) * prizes.length
    );
    
    const prize = prizes[prizeIndex];
    score += prize; // Add the prize to the total score

    messageArea.textContent = `You won ${prize} points! Total score: ${score}`;
    piBalanceP.textContent = `Score: ${score}`;
    playButton.disabled = false;
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
        }
    }
}

// Function to draw the pegs on the canvas
function drawPegs() {
    ctx.fillStyle = pegColor;
    pegs.forEach(peg => {
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, pegRadius, 0, Math.PI * 2);
        ctx.fill();
    });
}

// Function to drop a new ball
function dropBall() {
    if (isPlaying) return;
    isPlaying = true;
    messageArea.textContent = "Dropping ball...";
    playButton.disabled = true;

    // Create a new ball at the top center
    ball = {
        x: canvas.width / 2,
        y: 0,
        vx: (Math.random() - 0.5) * 5, // Random horizontal velocity
        vy: 2
    };

    requestAnimationFrame(updateGame);
}

// Main game loop
function updateGame() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawPegs();
    drawBall();

    if (ball) {
        // Update ball position
        ball.x += ball.vx;
        ball.y += ball.vy;

        // Simple collision detection with pegs
        pegs.forEach(peg => {
            const dx = ball.x - peg.x;
            const dy = ball.y - peg.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < ballRadius + pegRadius) {
                // Ball hit a peg, change its velocity
                const angle = Math.atan2(dy, dx);
                const speed = Math.sqrt(ball.vx * ball.vx + ball.vy * ball.vy);
                
                ball.vx = Math.cos(angle) * speed * -1;
                ball.vy = Math.sin(angle) * speed * -1;
            }
        });
        
        // Keep ball within horizontal bounds
        if (ball.x < ballRadius || ball.x > canvas.width - ballRadius) {
            ball.vx *= -1;
        }

        // Check if the ball has reached the bottom
        if (ball.y > canvas.height - ballRadius) {
            handleEndOfGame();
            ball = null;
            isPlaying = false;
            return; // End the game loop
        }
    }
    
    requestAnimationFrame(updateGame);
}

// Function to draw the ball
function drawBall() {
    if (!ball) return;
    ctx.fillStyle = ballColor;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
    ctx.fill();
}

// Function to handle what happens when the ball reaches the bottom
function handleEndOfGame() {
    // The prizes are located at the bottom of the canvas. We'll determine which one the ball hit.
    const prizeIndex = Math.floor(
        (ball.x / canvas.width) * prizes.length
    );
    
    const prize = prizes[prizeIndex];
    score += prize; // Add the prize to the total score

    messageArea.textContent = `You won ${prize} points! Total score: ${score}`;
    piBalanceP.textContent = `Score: ${score}`; // Update the score display
    playButton.disabled = false;
}

// Event listeners
window.onload = () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    createPegs();
    drawPegs();
    // Since we're not using the Pi SDK, we can just set some default text
    piUsernameSpan.textContent = "Player 1";
    piBalanceP.textContent = `Score: ${score}`;
    playButton.disabled = false;
};

playButton.addEventListener('click', () => {
    if (!isPlaying) {
        dropBall();
    }
});
    const prizeIndex = Math.floor(
        (ball.x / canvas.width) * prizes.length
    );
    
    const prize = prizes[prizeIndex];
    score += prize; // Add the prize to the total score

    messageArea.textContent = `You won ${prize} points! Total score: ${score}`;
    piBalanceP.textContent = `Score: ${score}`; // Update the score display
    playButton.disabled = false;
}

// Event listeners
window.onload = () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    createPegs();
    drawPegs();
    // Since we're not using the Pi SDK, we can just set some default text
    piUsernameSpan.textContent = "Player 1";
    piBalanceP.textContent = `Score: ${score}`;
    playButton.disabled = false;
};

playButton.addEventListener('click', () => {
    if (!isPlaying) {
        dropBall();
    }
});
