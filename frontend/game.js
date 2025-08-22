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
const prizes = [1, 2, 5, 10, 5, 2, 1, 0.5]; // Example prize values in π

// --- Game Logic ---
let pegs = [];
let ball = null;
let isPlaying = false;

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
                
                // Simple bounce off the peg
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
            handleWinLoss();
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

// --- Pi Network SDK Integration ---

// Function to authenticate the user and get their username
async function authenticateUser() {
    try {
        const auth = await Pi.authenticate();
        piUsernameSpan.textContent = auth.user.username;
        piBalanceP.textContent = "Please play to see your earnings!";
        playButton.disabled = false;
    } catch (error) {
        console.error("Authentication failed:", error);
        messageArea.textContent = "Authentication failed. Please try again in the Pi Browser.";
    }
}

// Function to handle the payment transaction
async function createPayment() {
    messageArea.textContent = "Processing payment...";
    playButton.disabled = true;

    const paymentData = {
        amount: 1, // Cost to play in π
        memo: "Plinko Game Play",
        metadata: {
            app: "plinko-game"
        }
    };
    
    try {
        const payment = await Pi.createPayment(paymentData);
        // If payment is successful, start the game
        messageArea.textContent = "Payment successful! Dropping the ball now.";
        dropBall();
    } catch (error) {
        console.error("Payment failed:", error);
        messageArea.textContent = "Payment failed. Please try again.";
        playButton.disabled = false;
    }
}

// This function would handle what happens when a ball wins or loses
function handleWinLoss() {
    // This is a simplified example. A more robust solution would track where the ball landed.
    const winningPrize = prizes[Math.floor(Math.random() * prizes.length)];
    
    messageArea.textContent = `Congratulations! You won ${winningPrize} π!`;

    // Now, we would create a payout transaction.
    // In a real application, this would be a server-side transaction to prevent cheating.
    // For this simple example, we'll just show the message.
    
    // Pi.createPayment({
    //     amount: winningPrize,
    //     memo: "Plinko Game Winnings",
    //     metadata: {
    //         app: "plinko-game",
    //         isWinning: true
    //     }
    // });
    
    playButton.disabled = false;
}

// Event listeners
window.onload = () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    createPegs();
    drawPegs();
    authenticateUser(); // Authenticate the user when the page loads
};

playButton.addEventListener('click', () => {
    if (!isPlaying) {
        createPayment();
    }
});
