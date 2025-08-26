/**
 * frontend/main.js
 * Clean, robust, and optimized entry point for the Plinko frontend.
 *
 * Changes / improvements:
 * - Single, consistent import set (no duplicates).
 * - Promise-wrapped Pi SDK usage with graceful fallback (demo flow).
 * - High-DPI canvas scaling + debounced resize.
 * - Defensive DOM access and informative console warnings.
 * - Safe localStorage access and normalized high-score handling.
 * - Clear separation of concerns and small helper functions.
 *
 * Notes:
 * - This file expects `createPegs`, `drawPegs` from ./board.js,
 *   `startGameLoop` from ./game.js and a `Ball` class from ./ball.js.
 * - `startGameLoop` is still responsible for the actual animation; this
 *   module wires UI, payments, canvas sizing and high-scores.
 */

import { createPegs, drawPegs } from './board.js';
import { Ball } from './ball.js';
import { startGameLoop } from './game.js';

/* -------------------------
   Constants
   -------------------------*/
const MAX_HIGH_SCORES = 5;
const HIGHSCORES_KEY = 'plinkoHighScores';
const DEFAULT_USERNAME = 'Guest';
const PI_SCOPES = ['username'];
const PAYMENT_AMOUNT = 0.001;
const PAYMENT_MEMO = 'Plinko game play';
const RESIZE_DEBOUNCE_MS = 150;

/* -------------------------
   DOM references (defensive)
   -------------------------*/
const q = (id) => document.getElementById(id);

const canvas = q('plinko-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const playButton = q('play-button');
const messageArea = q('message-area');
const piUsernameSpan = q('pi-username');
const piBalanceP = q('pi-balance');
const highScoresList = q('high-scores-list');

if (!canvas || !ctx) {
    console.error('Canvas or 2D context not available: plinko-canvas missing');
}

/* -------------------------
   State
   -------------------------*/
let pegs = [];
let score = 0;
let piUsername = DEFAULT_USERNAME;

/* -------------------------
   Small helpers
   -------------------------*/
const noop = () => {};
const safeText = (el, txt) => { if (el) el.textContent = txt; };
const setDisabled = (el, v) => { if (el) el.disabled = !!v; };

/**
 * Debounce wrapper
 */
function debounce(fn, wait = RESIZE_DEBOUNCE_MS) {
    let timer = null;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), wait);
    };
}

/* -------------------------
   localStorage - high scores (safe)
   -------------------------*/
function safeJSONParse(value, fallback = []) {
    try {
        return JSON.parse(value);
    } catch (err) {
        console.warn('safeJSONParse failed, using fallback', err);
        return fallback;
    }
}

function readRawHighScores() {
    try {
        const raw = localStorage.getItem(HIGHSCORES_KEY);
        return raw ? safeJSONParse(raw, []) : [];
    } catch (err) {
        console.warn('Failed to read high scores from localStorage', err);
        return [];
    }
}

function writeHighScores(list) {
    try {
        localStorage.setItem(HIGHSCORES_KEY, JSON.stringify(list));
    } catch (err) {
        console.warn('Failed to write high scores to localStorage', err);
    }
}

function getHighScores() {
    const raw = readRawHighScores();
    if (!Array.isArray(raw)) return [];
    return raw
        .map((s) => ({
            username: (s && s.username) ? String(s.username) : DEFAULT_USERNAME,
            score: Number(s && s.score) || 0
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, MAX_HIGH_SCORES);
}

function updateHighScores(currentScore) {
    // Only persist for authenticated users (non-default username)
    if (!piUsername || piUsername === DEFAULT_USERNAME) {
        console.debug('High score not saved: user unauthenticated or default');
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

function displayHighScores() {
    if (!highScoresList) return;
    const scores = getHighScores();
    highScoresList.innerHTML = '';
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
   Pi SDK wrappers (promise-based)
   -------------------------*/
function isPiAvailable() {
    return typeof window !== 'undefined' && typeof window.Pi === 'object';
}

function authenticatePi(scopes = PI_SCOPES) {
    return new Promise((resolve, reject) => {
        if (!isPiAvailable() || typeof Pi.authenticate !== 'function') {
            return reject(new Error('Pi SDK is not available'));
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
        if (!isPiAvailable() || typeof Pi.createPayment !== 'function') {
            return reject(new Error('Pi payment SDK is not available'));
        }
        try {
            Pi.createPayment({ amount, memo, metadata }, resolve, (err) => reject(new Error(err || 'Payment failed')));
        } catch (err) {
            reject(err);
        }
    });
}

/* -------------------------
   Canvas sizing & pegs
   -------------------------*/
function resizeCanvasToDisplaySize() {
    if (!canvas || !ctx) return;
    const dpr = Math.max(1, window.devicePixelRatio || 1);
    // get bounding client size (CSS pixels)
    const rect = canvas.getBoundingClientRect();
    // Provide sensible fallback if CSS is not set
    const cssWidth = Math.max(300, Math.round(rect.width || canvas.clientWidth || 300));
    const cssHeight = Math.max(200, Math.round(rect.height || canvas.clientHeight || 200));
    const displayWidth = Math.round(cssWidth * dpr);
    const displayHeight = Math.round(cssHeight * dpr);

    if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${cssHeight}px`;
        // Reset transform and scale once for drawing convenience
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
}

/* -------------------------
   Core app flow
   -------------------------*/
async function init() {
    // Guard DOM
    if (!canvas || !ctx || !playButton || !messageArea) {
        console.warn('Missing essential DOM nodes; initialization will be limited.');
    }

    // Prepare canvas size & redraw on resize
    resizeCanvasToDisplaySize();
    window.addEventListener('resize', debounce(() => {
        resizeCanvasToDisplaySize();
        pegs = createPegs(canvas);
        drawPegs(ctx, pegs);
    }, RESIZE_DEBOUNCE_MS));

    // Initial UI
    setDisabled(playButton, true);
    safeText(piUsernameSpan, piUsername);
    safeText(piBalanceP, `Score: ${score}`);
    displayHighScores();

    // Create pegs and draw once
    try {
        pegs = createPegs(canvas);
        drawPegs(ctx, pegs);
    } catch (err) {
        console.error('Failed to create/draw pegs:', err);
    }

    // Try to authenticate with Pi, but tolerate failure (demo mode)
    try {
        const user = await authenticatePi(PI_SCOPES);
        handleAuthSuccess(user);
    } catch (err) {
        handleAuthFailure(err);
    }
}

/* -------------------------
   Payment & play handling
   -------------------------*/
async function handlePlayClick() {
    setDisabled(playButton, true);
    safeText(messageArea, 'Initiating payment...');

    // If Pi isn't present, offer a demo fallback (no real payment).
    if (!isPiAvailable()) {
        // Non-blocking: simulate a short delay for better UX.
        await new Promise((r) => setTimeout(r, 300));
        // Start demo play without a real payment.
        safeText(messageArea, 'Demo payment (offline). Dropping ball...');
        startGameAfterPayment({ demo: true });
        return;
    }

    try {
        const payment = await createPiPayment({
            amount: PAYMENT_AMOUNT,
            memo: PAYMENT_MEMO,
            metadata: { game: 'Plinko', type: 'single_play_cost' }
        });
        startGameAfterPayment(payment);
    } catch (err) {
        handlePaymentFailure(err);
    }
}

function startGameAfterPayment(payment) {
    safeText(messageArea, 'Payment successful! Dropping ball...');
    // Create Ball instance for this run and start the game loop
    try {
        const ball = new Ball(canvas);
        const elements = { playButton, messageArea, piBalanceP };
        // startGameLoop is expected to handle animations and finalization.
        startGameLoop({ canvas, ctx, pegs, ball, elements, onRunComplete: onRunComplete });
    } catch (err) {
        console.error('Failed to start game loop:', err);
        safeText(messageArea, 'Failed to start game. See console.');
        setDisabled(playButton, false);
    }
}

function handlePaymentFailure(err) {
    console.error('Payment failed:', err);
    safeText(messageArea, 'Payment failed. Please try again.');
    setDisabled(playButton, false);
}

/* -------------------------
   Auth handlers
   -------------------------*/
function handleAuthSuccess(user) {
    piUsername = (user && user.username) ? String(user.username) : DEFAULT_USERNAME;
    safeText(piUsernameSpan, piUsername);
    safeText(messageArea, `Hello, ${piUsername}! Click 'Play' to start.`);
    setDisabled(playButton, false);
}

function handleAuthFailure(err) {
    console.warn('Pi authentication unavailable:', err);
    piUsername = DEFAULT_USERNAME;
    safeText(piUsernameSpan, piUsername);
    safeText(messageArea, 'Authentication unavailable. Demo mode enabled.');
    // Allow play in demo mode
    setDisabled(playButton, false);
}

/* -------------------------
   Run completion callback
   -------------------------*/
/**
 * Called by the game when a run finishes.
 * - `finalScore` should be numeric.
 */
function onRunComplete(finalScore = 0) {
    score = Number(finalScore) || 0;
    safeText(piBalanceP, `Score: ${score}`);
    // Persist/update high scores if applicable
    try {
        updateHighScores(score);
    } catch (err) {
        console.warn('Failed to update high scores:', err);
    }
    // Re-enable play
    setDisabled(playButton, false);
}

/* -------------------------
   Wiring event listeners
   -------------------------*/
window.addEventListener('load', init);
if (playButton) playButton.addEventListener('click', handlePlayClick);

/* -------------------------
   Exports
   -------------------------*/
export { updateHighScores };    canvas.height = canvas.offsetHeight;
    pegs = createPegs(canvas);
    drawPegs(ctx);
    displayHighScores();

    piBalanceP.textContent = `Score: ${score}`;
    playButton.disabled = false;

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
    
    // Create a new Ball object and pass it to the game loop
    ballInstance = new Ball(canvas);
    const elements = { playButton, messageArea, piBalanceP };
    startGameLoop(canvas, ctx, elements, ballInstance);
}

function onPaymentFailure(error) {
    console.error("Payment failed:", error);
    messageArea.textContent = "Payment failed. Please try again.";
    playButton.disabled = false;
}

// ... high score functions are the same as before ...

function getHighScores() {
    const scores = JSON.parse(localStorage.getItem('plinkoHighScores')) || [];
    return scores.sort((a, b) => b.score - a.score).slice(0, 5);
}

function updateHighScores(currentScore) {
    if (piUsername === "Guest") return;
    const scores = getHighScores();
    const newScore = { username: piUsername, score: currentScore };
    scores.push(newScore);
    const updatedScores = scores.sort((a, b) => b.score - a.score).slice(0, 5);
    localStorage.setItem('plinkoHighScores', JSON.stringify(updatedScores));
    displayHighScores();
}

function displayHighScores() {
    const scores = getHighScores();
    highScoresList.innerHTML = '';
    scores.forEach((score, index) => {
        const listItem = document.createElement('li');
        listItem.textContent = `${index + 1}. ${score.username}: ${score.score}`;
        highScoresList.appendChild(listItem);
    });
}

export { updateHighScores };

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
