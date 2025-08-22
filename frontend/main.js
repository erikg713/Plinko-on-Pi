/**
 * frontend/main.js
 * Improved, hardened and optimized entry point for the Plinko frontend.
 *
 * Goals:
 * - Clear structure and small helper functions.
 * - Defensive guards around Pi SDK and localStorage.
 * - High-DPI canvas scaling and debounced resize.
 * - Promise wrappers for callback-style Pi SDK (keeps call-sites async-friendly).
 * - Better naming, constants and detailed inline comments for maintainability.
 */

import { createPegs, drawPegs } from './board.js';
import { dropBall, ballRadius } from './ball.js';
import { startGameLoop } from './game.js';

const MAX_HIGH_SCORES = 5;
const HIGHSCORES_KEY = 'plinkoHighScores';
const DEFAULT_USERNAME = 'Guest';
const PI_SCOPES = ['username'];
const PAYMENT_AMOUNT = 0.001;
const PAYMENT_MEMO = 'Plinko game play';

const canvas = document.getElementById('plinko-canvas');
const ctx = canvas.getContext('2d');
const playButton = document.getElementById('play-button');
const messageArea = document.getElementById('message-area');
const piUsernameSpan = document.getElementById('pi-username');
const piBalanceP = document.getElementById('pi-balance');
const highScoresList = document.getElementById('high-scores-list');

let pegs = [];
let score = 0;
let piUsername = DEFAULT_USERNAME;

/* -------------------------
   Utility helpers
   -------------------------*/

/**
 * Debounce wrapper
 */
function debounce(fn, wait = 150) {
    let t = null;
    return (...args) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...args), wait);
    };
}

/**
 * Safe JSON parse wrapper (falls back to defaultValue on error)
 */
function safeJSONParse(value, defaultValue) {
    try {
        return JSON.parse(value);
    } catch (err) {
        console.warn('JSON parse failed, using default.', err);
        return defaultValue;
    }
}

/* -------------------------
   LocalStorage: High Scores
   -------------------------*/

function readRawHighScores() {
    try {
        const raw = localStorage.getItem(HIGHSCORES_KEY);
        return safeJSONParse(raw, []);
    } catch (err) {
        console.warn('localStorage read failed:', err);
        return [];
    }
}

function writeHighScores(list) {
    try {
        localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
    } catch (err) {
        console.warn('localStorage write failed:', err);
    }
}

/**
 * Return top MAX_HIGH_SCORES sorted descending by score.
 */
function getHighScores() {
    const scores = Array.isArray(readRawHighScores()) ? readRawHighScores() : [];
    return scores
        .map(s => ({ username: s.username ?? DEFAULT_USERNAME, score: Number(s.score) || 0 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_HIGH_SCORES);
}

/**
 * Update and persist high scores; only saves for authenticated users.
 */
function updateHighScores(currentScore) {
    if (!piUsername || piUsername === DEFAULT_USERNAME) {
        console.debug('Skipping high score save for unauthenticated user.');
        return;
    }

    const scores = getHighScores();
    scores.push({ username: piUsername, score: Number(currentScore) || 0 });

    const updated = scores
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_HIGH_SCORES);

    writeHighScores(updated);
    displayHighScores();
}

/**
 * Render high scores list in the DOM
 */
function displayHighScores() {
    const scores = getHighScores();
    highScoresList.innerHTML = ''; // clear
    if (scores.length === 0) {
        const li = document.createElement('li');
        li.textContent = 'No high scores yet';
        highScoresList.appendChild(li);
        return;
    }
    scores.forEach((s, i) => {
        const li = document.createElement('li');
        li.textContent = `${i + 1}. ${s.username}: ${s.score}`;
        highScoresList.appendChild(li);
    });
}

/* -------------------------
   Pi SDK helpers (promise-wrapped)
   -------------------------*/

function authenticatePi(scopes = PI_SCOPES) {
    return new Promise((resolve, reject) => {
        if (typeof window.Pi === 'undefined' || typeof Pi.authenticate !== 'function') {
            return reject(new Error('Pi SDK is not available in this environment.'));
        }
        try {
            Pi.authenticate(scopes, resolve, (err) => reject(new Error(err || 'Authentication failed')));
        } catch (err) {
            reject(err);
        }
    });
}

function createPiPayment({ amount = PAYMENT_AMOUNT, memo = PAYMENT_MEMO, metadata = {} } = {}) {
    return new Promise((resolve, reject) => {
        if (typeof window.Pi === 'undefined' || typeof Pi.createPayment !== 'function') {
            return reject(new Error('Pi payment SDK is not available.'));
        }
        try {
            Pi.createPayment({ amount, memo, metadata }, resolve, (err) => reject(new Error(err || 'Payment creation failed')));
        } catch (err) {
            reject(err);
        }
    });
}

/* -------------------------
   Canvas helpers
   -------------------------*/

/**
 * Size and scale canvas for high-DPI displays.
 */
function resizeCanvasToDisplaySize() {
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(300, canvas.clientWidth); // ensure a sensible min
    const height = Math.max(200, canvas.clientHeight);
    const displayWidth = Math.floor(width * dpr);
    const displayHeight = Math.floor(height * dpr);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        canvas.style.width = `${width}px`;
        canvas.style.height = `${height}px`;
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // scale drawing operations
    }
}

/* -------------------------
   Application logic
   -------------------------*/

async function init() {
    try {
        // Prepare canvas
        resizeCanvasToDisplaySize();
        window.addEventListener('resize', debounce(() => {
            resizeCanvasToDisplaySize();
            pegs = createPegs(canvas);
            drawPegs(ctx);
        }));

        // Initial UI state
        playButton.disabled = true;
        piBalanceP.textContent = `Score: ${score}`;
        displayHighScores();

        // Create pegs for this canvas
        pegs = createPegs(canvas);
        drawPegs(ctx);

        // Attempt to authenticate with Pi SDK, but tolerate failure.
        try {
            const user = await authenticatePi(PI_SCOPES);
            onAuthSuccess(user);
        } catch (authErr) {
            onAuthFailure(authErr);
        }
    } catch (err) {
        console.error('Initialization failed:', err);
        messageArea.textContent = 'Initialization error. Check console for details.';
    }
}

/* -------------------------
   Event handlers
   -------------------------*/

function onAuthSuccess(user) {
    piUsername = (user && user.username) ? String(user.username) : DEFAULT_USERNAME;
    piUsernameSpan.textContent = piUsername;
    messageArea.textContent = `Hello, ${piUsername}! Click 'Play' to start.`;
    playButton.disabled = false;
}

function onAuthFailure(error) {
    console.warn('Pi authentication failed:', error);
    piUsername = DEFAULT_USERNAME;
    piUsernameSpan.textContent = piUsername;
    messageArea.textContent = 'Authentication unavailable. You can still play in demo mode.';
    // Allow play even without Pi for demo mode; if you prefer to block, set disabled = true.
    playButton.disabled = false;
}

/**
 * Kick off a payment and then start the game on success.
 */
async function handlePlayClick() {
    playButton.disabled = true;
    messageArea.textContent = 'Initiating payment...';

    try {
        const payment = await createPiPayment({
            amount: PAYMENT_AMOUNT,
            memo: PAYMENT_MEMO,
            metadata: { game: 'Plinko', type: 'single_play_cost' }
        });
        // Payment succeeded
        onPaymentSuccess(payment);
    } catch (err) {
        onPaymentFailure(err);
    }
}

function onPaymentSuccess(payment) {
    messageArea.textContent = 'Payment successful! Dropping ball...';

    // dropBall may be synchronous or asynchronous depending on implementation;
    // call it and start the game loop — catch any synchronous errors so UI recovers.
    try {
        dropBall(canvas);
    } catch (err) {
        console.error('dropBall failed:', err);
    }

    const elements = { playButton, messageArea, piBalanceP };
    try {
        startGameLoop(canvas, ctx, elements);
    } catch (err) {
        console.error('startGameLoop failed:', err);
        messageArea.textContent = 'Game failed to start. See console.';
        playButton.disabled = false;
    }
}

function onPaymentFailure(error) {
    console.error('Payment failed:', error);
    messageArea.textContent = 'Payment failed. Please try again.';
    playButton.disabled = false;
}

/* -------------------------
   Wiring
   -------------------------*/

window.addEventListener('load', init);
playButton.addEventListener('click', handlePlayClick);

// Exported for the rest of the app (game.js calls this when a run finishes).
export { updateHighScores };
