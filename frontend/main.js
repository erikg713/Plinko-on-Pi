import { createPegs, drawPegs } from './board.js';
import { dropBall, ballRadius } from './ball.js';
import { startGameLoop } from './game.js';

// Get elements from the DOM
const canvas = document.getElementById('plinko-canvas');
const ctx = canvas.getContext('2d');
const playButton = document.getElementById('play-button');
const messageArea = document.getElementById('message-area');
const piUsernameSpan = document.getElementById('pi-username');
const piBalanceP = document.getElementById('pi-balance');

let pegs = [];
let score = 0;

// Event listeners
window.onload = () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    pegs = createPegs(canvas);
    drawPegs(ctx);

    // Initial display text
    piBalanceP.textContent = `Score: ${score}`;
    playButton.disabled = false;

    // Call the Pi SDK to authenticate the user
    Pi.authenticate(["username"], onAuthSuccess, onAuthFailure);
};

// Callback function for a successful authentication
function onAuthSuccess(user) {
    piUsernameSpan.textContent = user.username;
    messageArea.textContent = `Hello, ${user.username}! Click 'Play' to start.`;
    playButton.disabled = false;
}

// Callback function for a failed authentication
function onAuthFailure(error) {
    console.error("Pi authentication failed:", error);
    messageArea.textContent = "Authentication failed. Please use the Pi Browser.";
    playButton.disabled = true; // Disable the button if auth fails
}

playButton.addEventListener('click', () => {
    // Disable the button to prevent multiple clicks
    playButton.disabled = true;
    messageArea.textContent = "Initiating payment...";

    // Create a new payment request
    const payment = Pi.createPayment({
        amount: 0.001, // The cost to play the game
        memo: "Plinko game play",
        metadata: {
            game: "Plinko",
            type: "single_play_cost"
        }
    }, onPaymentSuccess, onPaymentFailure);
});

// Callback for a successful payment
function onPaymentSuccess(payment) {
    messageArea.textContent = "Payment successful! Dropping ball...";
    
    // Call the game start logic
    dropBall(canvas);
    const elements = { playButton, messageArea, piBalanceP };
    startGameLoop(canvas, ctx, elements);
}

// Callback for a failed payment
function onPaymentFailure(error) {
    console.error("Payment failed:", error);
    messageArea.textContent = "Payment failed. Please try again.";
    playButton.disabled = false; // Re-enable the button
}
