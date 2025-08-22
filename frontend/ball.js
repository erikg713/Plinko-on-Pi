// ball.js

const ballRadius = 6;
const ballColor = '#f39c12';

let ball = null;

// Function to drop a new ball
function dropBall(canvas) {
    ball = {
        x: canvas.width / 2,
        y: 0,
        vx: (Math.random() - 0.5) * 5, // Random horizontal velocity
        vy: 2
    };
    return ball;
}

// Function to draw the ball
function drawBall(ctx) {
    if (!ball) return;
    ctx.fillStyle = ballColor;
    ctx.beginPath();
    ctx.arc(ball.x, ball.y, ballRadius, 0, Math.PI * 2);
    ctx.fill();
}

export { ball, ballRadius, dropBall, drawBall };
