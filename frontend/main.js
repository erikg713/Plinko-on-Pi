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
const highScoresList = document.getElementById('high-scores-list');

let pegs = [];
let score = 0;
let piUsername = "Guest"; // Store the Pi username

// Event listeners
window.onload = () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    pegs = createPegs(canvas);
    drawPegs(ctx);
    displayHighScores(); // Display scores on load

    // Initial display text
    piBalanceP.textContent = `Score: ${score}`;
    playButton.disabled = false;

    // Call the Pi SDK to authenticate the user
    Pi.authenticate(["username"], onAuthSuccess, onAuthFailure);
};

function onAuthSuccess(user) {
    piUsername = user.username;
    piUsernameSpan.textContent = piUsername;
    messageArea.textContent = `Hello, ${piUsername}! Click 'Play' to start.`;
    playButton.disabled = false;
}

function onAuthFailure(error) {
    console.error("Pi authentication failed:", error);
    messageArea.textContent = "Authentication failed. Please use the Pi Browser.";
    playButton.disabled = true;
}

playButton.addEventListener('click', () => {
    playButton.disabled = true;
    messageArea.textContent = "Initiating payment...";

    const payment = Pi.createPayment({
        amount: 0.001,
        memo: "Plinko game play",
        metadata: {
            game: "Plinko",
            type: "single_play_cost"
        }
    }, onPaymentSuccess, onPaymentFailure);
});

function onPaymentSuccess(payment) {
    messageArea.textContent = "Payment successful! Dropping ball...";
    dropBall(canvas);
    const elements = { playButton, messageArea, piBalanceP };
    startGameLoop(canvas, ctx, elements);
}

function onPaymentFailure(error) {
    console.error("Payment failed:", error);
    messageArea.textContent = "Payment failed. Please try again.";
    playButton.disabled = false;
}

// Function to get high scores from localStorage
function getHighScores() {
    const scores = JSON.parse(localStorage.getItem('plinkoHighScores')) || [];
    return scores.sort((a, b) => b.score - a.score).slice(0, 5); // Get top 5 scores
}

// Function to save and display scores
function updateHighScores(currentScore) {
    if (piUsername === "Guest") return; // Don't save scores for unauthenticated users

    const scores = getHighScores();
    const newScore = { username: piUsername, score: currentScore };
    scores.push(newScore);

    // Sort and save the new list
    const updatedScores = scores.sort((a, b) => b.score - a.score).slice(0, 5);
    localStorage.setItem('plinkoHighScores', JSON.stringify(updatedScores));

    displayHighScores();
}

// Function to display scores on the page
function displayHighScores() {
    const scores = getHighScores();
    highScoresList.innerHTML = ''; // Clear the list
    scores.forEach((score, index) => {
        const listItem = document.createElement('li');
        listItem.textContent = `${index + 1}. ${score.username}: ${score.score}`;
        highScoresList.appendChild(listItem);
    });
}

// Export the update function so it can be called from game.js
export { updateHighScores };
