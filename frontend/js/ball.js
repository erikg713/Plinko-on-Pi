// frontend/ball.js
// Ball physics and drawing for Plinko-on-Pi
// - Single, well-documented Ball class
// - Time-step based update(dt) for stable simulation
// - Configurable physics constants and helpers
// - Keeps an exported `ball` instance for backward compatibility
// - Small, optimized routines for animation performance

/* Physics tunables (units: pixels, seconds) */
const DEFAULT_RADIUS = 6;
const DEFAULT_COLOR = '#f39c12';

const GRAVITY = 1600;         // px / s^2
const AIR_RESISTANCE = 0.40;  // fraction per second (0 = no drag)
const RESTITUTION = 0.45;     // bounciness on collisions (0..1)
const GROUND_FRICTION = 0.75; // multiplier applied to vx when hitting ground
const MAX_INITIAL_VX = 150;   // px / s
const STOP_VELOCITY = 12;     // px / s threshold to consider as "stopped"

/**
 * Clamp a value between min and max.
 * @param {number} v
 * @param {number} a
 * @param {number} b
 * @returns {number}
 */
function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

/**
 * Small check for near-zero to avoid jitter.
 * @param {number} v
 * @returns {boolean}
 */
function almostZero(v) {
  return Math.abs(v) < STOP_VELOCITY;
}

/**
 * Ball class implementing simple, efficient physics for animation.
 */
export class Ball {
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
    this.r = typeof opts.r === 'number' ? opts.r : DEFAULT_RADIUS;
    this.color = opts.color || DEFAULT_COLOR;

    // state flags
    this.stopped = false; // true when ball has effectively come to rest
    this.removed = false; // set externally to mark for removal
  }

  /**
   * Update physics state by dt seconds.
   * Bounds should be an object: { width, height } (px)
   * @param {number} dt - delta time in seconds
   * @param {{width:number,height:number}} bounds
   */
  update(dt, bounds) {
    if (this.stopped || this.removed) return;

    // local references for performance
    let vx = this.vx;
    let vy = this.vy;
    const r = this.r;
    const w = bounds.width;
    const h = bounds.height;

    // Apply gravity
    vy += GRAVITY * dt;

    // Apply simple air resistance (exponential-like)
    const airFactor = Math.max(0, 1 - AIR_RESISTANCE * dt);
    vx *= airFactor;
    vy *= airFactor;

    // Integrate positions
    let nx = this.x + vx * dt;
    let ny = this.y + vy * dt;

    // Horizontal wall collisions (left/right)
    if (nx - r < 0) {
      nx = r;
      vx = -vx * RESTITUTION;
    } else if (nx + r > w) {
      nx = w - r;
      vx = -vx * RESTITUTION;
    }

    // Ground collision (bottom)
    if (ny + r > h) {
      ny = h - r;

      // Only reflect vy if moving downward
      if (vy > 0) {
        vy = -vy * RESTITUTION;
      }

      // Apply ground friction to horizontal velocity
      vx *= GROUND_FRICTION;

      // If both velocities are small after collision, stop the ball to avoid micro-bounce
      if (almostZero(vx) && almostZero(vy)) {
        vx = 0;
        vy = 0;
        this.stopped = true;
      }
    }

    // Ceiling collision (rare, but keep it stable)
    if (ny - r < 0) {
      ny = r;
      if (vy < 0) vy = -vy * RESTITUTION;
    }

    // Commit updated state
    this.x = nx;
    this.y = ny;
    this.vx = vx;
    this.vy = vy;
  }

  /**
   * Draw ball into a CanvasRenderingContext2D
   * @param {CanvasRenderingContext2D} ctx
   */
  draw(ctx) {
    // Fast-path: no save/restore to keep allocations down.
    ctx.fillStyle = this.color;
    ctx.beginPath();
    ctx.arc(this.x, this.y, this.r, 0, Math.PI * 2);
    ctx.fill();
  }

  /**
   * Returns true if the ball is outside the provided bounds plus optional margin.
   * @param {{width:number,height:number}} bounds
   * @param {number} [margin=0]
   * @returns {boolean}
   */
  isOffScreen(bounds, margin = 0) {
    return (
      this.x + this.r < -margin ||
      this.x - this.r > bounds.width + margin ||
      this.y - this.r > bounds.height + margin ||
      this.y + this.r < -margin
    );
  }

  /**
   * Reset ball to a new position and optional velocity (useful for pooling).
   * @param {number} x
   * @param {number} y
   * @param {{vx?:number,vy?:number,r?:number,color?:string}} [opts]
   */
  reset(x, y, opts = {}) {
    this.x = x;
    this.y = y;
    this.vx = typeof opts.vx === 'number' ? opts.vx : 0;
    this.vy = typeof opts.vy === 'number' ? opts.vy : 0;
    if (typeof opts.r === 'number') this.r = opts.r;
    if (typeof opts.color === 'string') this.color = opts.color;
    this.stopped = false;
    this.removed = false;
  }

  /**
   * Create a shallow clone of this ball.
   * @returns {Ball}
   */
  clone() {
    return new Ball(this.x, this.y, {
      vx: this.vx,
      vy: this.vy,
      r: this.r,
      color: this.color,
    });
  }
}

/* Backward compatibility: export a single `ball` instance placeholder and helper creators */
export let ball = null;

/**
 * Create a new Ball instance placed at the top-center of given bounds and set `ball` to it.
 * @param {{width:number,height:number}} bounds
 * @param {{vx?:number,vy?:number,r?:number,color?:string}} [opts]
 * @returns {Ball}
 */
export function spawnBallAtTop(bounds, opts = {}) {
  const cx = bounds.width / 2;
  const xJitter = (Math.random() - 0.5) * Math.min(40, bounds.width * 0.1);
  const initialVx = typeof opts.vx === 'number' ? opts.vx : (Math.random() - 0.5) * MAX_INITIAL_VX;
  const initialVy = typeof opts.vy === 'number' ? opts.vy : 30 + Math.random() * 60;

  ball = new Ball(cx + xJitter, Math.max(DEFAULT_RADIUS, 8), {
    vx: initialVx,
    vy: initialVy,
    r: opts.r,
    color: opts.color,
  });

  return ball;
}

/**
 * Factory: create a new Ball without modifying the exported `ball`.
 * @param {number} x
 * @param {number} y
 * @param {{vx?:number,vy?:number,r?:number,color?:string}} [opts]
 * @returns {Ball}
 */
export function createBall(x, y, opts = {}) {
  return new Ball(x, y, opts);
}const defaultBallColor = '#f39c12';

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
    
