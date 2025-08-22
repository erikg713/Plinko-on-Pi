// A simple Plinko game engine using a canvas.
const canvas = document.getElementById('plinko-canvas');
const ctx = canvas.getContext('2d');
const playButton = document.getElementById('play-button');
const messageArea = document.getElementById('message-area');
const piUsernameSpan = document.getElementById('pi-username');
const piBalanceP = document.getElementById('pi-balance');

// Game constants
const pegRadius = 5;
const pegColor = '#ecf0f1';
const ballRadius = 6;
const ballColor = '#f39c12';
const numRows = 12;
const rowSpacing = 30;
const pegSpacing = 25;
const prizes = [5, 10, 25, 50, 100, 50, 25, 10, 5]; // Example in-game points

// Game variables
let pegs = [];
let ball = null;
let isPlaying = false;
let score = 0; // The in-game score

// Function to create the plinko board pegs
function createPegs() {
    pegs = [];
    for (let i = 0; i < numRows; i++) {
        const numPegsInRow = i + 1;
        const startX = (canvas.width - (numPegsInRow * pegSpacing)) / 2;
        const y = rowSpacing + i * rowSpacing;
        for (let j = 0; j < numPegsInRow; j++) {
            pegs.push({
                x: startX + j * pegSpacing + pegSpacing / 2,
                y: y
            });
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
