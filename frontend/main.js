// main.js

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
let score = 0; // The in-game score

// Event listeners
window.onload = () => {
    canvas.width = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
    pegs = createPegs(canvas);
    drawPegs(ctx);

    // Initial display text
    piUsernameSpan.textContent = "Player 1";
    piBalanceP.textContent = `Score: ${score}`;
    playButton.disabled = false;
};

playButton.addEventListener('click', () => {
    // Drop the ball and start the game loop
    dropBall(canvas);
    const elements = { playButton, messageArea, piBalanceP };
    startGameLoop(canvas, ctx, elements);
});
