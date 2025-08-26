// frontend/ball.js
// Improved, production-friendly ball module for Plinko-on-Pi
// - Encapsulates ball behavior in a Ball class
// - Uses time-based physics (dt in seconds) for stable animation
// - Adds configurable physics constants (gravity, air resistance, restitution)
// - Keeps a single exported `ball` for backward compatibility while providing helper APIs
// - Clear JSDoc and small utility helpers for readability and maintainability

// ball.js

const ballRadius = 6;
const ballColor = '#f39c12';

// Define the Ball class
class Ball {
    constructor(canvas) {
        // Initialize ball properties
        this.x = canvas.width / 2;
        this.y = 0;
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = 2;
        this.radius = ballRadius;
        this.color = ballColor;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fill();
    }
}

export { Ball };

const ballRadius = 6;
const defaultBallColor = '#f39c12';

// Physics tunables (pixels / second^2, etc.)
const GRAVITY = 1600; // px/s^2
const AIR_RESISTANCE = 0.4; // fraction per second (0 = no drag, 1 = immediate stop)
const RESTITUTION = 0.45; // bounciness on collisions (0..1)
const GROUND_FRICTION = 0.7; // multiplier applied to vx when hitting ground
const MAX_INITIAL_VX = 150; // px/s

let ball = null; // exported current ball for compatibility with existing code

/**
 * Clamp value between min and max.
 * @param {number} v
 * @param {number} a
 * @param {number} b
 */
function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
}

/**
 * Ball class implementing simple physics.
 */
class Ball {
    /**
     * @param {number} x - initial x (px)
     * @param {number} y - initial y (px)
     * @param {object} [opts]
     * @param {number} [opts.vx] - initial x velocity (px/s)
     * @param {number} [opts.vy] - initial y velocity (px/s)
     * @param {number} [opts.r] - radius in px
     * @param {string} [opts.color] - CSS color
     */
    constructor(x, y, opts = {}) {
        this.x = x;
        this.y = y;
        this.vx = typeof opts.vx === 'number' ? opts.vx : 0;
        this.vy = typeof opts.vy === 'number' ? opts.vy : 0;
        this.r = typeof opts.r === 'number' ? opts.r : ballRadius;
        this.color = opts.color || defaultBallColor;
        this.stopped = false; // becomes true when ball has essentially come to rest
        this.removed = false; // flag for off-screen removal if needed externally
    }

    /**
     *
    
