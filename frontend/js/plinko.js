/**
 * Improved Plinko frontend using Matter.js
 * - Encapsulated into a PlinkoController class for cleaner state management
 * - Uses collision sensors at the bottom to reliably determine slot hits
 * - Prevents duplicate event listeners and supports concurrent safety
 * - Promise-based dropBall with optional callback (keeps backward-compatible API)
 * - Configurable options and responsive canvas sizing
 *
 * Usage (backwards compatible):
 *   setupPlinko();
 *   dropBall(multiplier => console.log('Payout multiplier:', multiplier));
 *
 * Or with promises:
 *   setupPlinko();
 *   plinko.dropBall().then(multiplier => console.log(multiplier));
 */

let Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Events = Matter.Events,
    Composite = Matter.Composite;

class PlinkoController {
  constructor(canvasId = "plinkoCanvas", opts = {}) {
    this.canvasId = canvasId;
    this.options = Object.assign({
      width: 600,
      height: 800,
      background: "#222",
      pegRadius: 5,
      pegSpacingX: 50,
      pegSpacingY: 80,
      pegOffsetX: 25,
      rows: 6,
      slotMultipliers: [0.5, 1, 2, 5, 10],
      ballRadius: 10,
      ballRestitution: 0.5,
      groundHeight: 20,
      wallThickness: 10,
      topDropY: 50,
      defaultDropX: 300,
      devicePixelRatioScaling: true
    }, opts);

    this.engine = null;
    this.world = null;
    this.render = null;
    this.runner = null;

    this.slots = []; // { body, x, width, multiplier }
    this.pegBodies = [];
    this.staticBodies = [];
    this.currentBall = null;

    this._collisionHandler = this._onCollision.bind(this);
    this._afterUpdateHandler = this._afterUpdate.bind(this);

    // Create a publicly accessible instance (for convenience)
    window.plinko = this;
  }

  init() {
    // Avoid double init
    if (this.engine) return;

    const canvas = document.getElementById(this.canvasId);
    if (!canvas) {
      throw new Error(`Canvas element with id "${this.canvasId}" not found.`);
    }

    // Handle DPR scaling for crisp rendering
    if (this.options.devicePixelRatioScaling) {
      const dpr = window.devicePixelRatio || 1;
      canvas.style.width = `${this.options.width}px`;
      canvas.style.height = `${this.options.height}px`;
      canvas.width = Math.round(this.options.width * dpr);
      canvas.height = Math.round(this.options.height * dpr);
    } else {
      canvas.width = this.options.width;
      canvas.height = this.options.height;
    }

    this.engine = Engine.create();
    this.world = this.engine.world;

    this.render = Render.create({
      element: document.body,
      canvas: canvas,
      engine: this.engine,
      options: {
        width: this.options.width,
        height: this.options.height,
        wireframes: false,
        background: this.options.background,
      }
    });

    // Create basic boundaries
    const w = this.options.width;
    const h = this.options.height;
    const t = this.options.wallThickness;
    const gh = this.options.groundHeight;

    // Ground
    const ground = Bodies.rectangle(w / 2, h - gh / 2, w, gh, { isStatic: true, render: { fillStyle: '#111' } });
    // Left and right walls
    const wallLeft = Bodies.rectangle(-t / 2, h / 2, t, h, { isStatic: true, render: { fillStyle: '#111' } });
    const wallRight = Bodies.rectangle(w + t / 2, h / 2, t, h, { isStatic: true, render: { fillStyle: '#111' } });

    this.staticBodies.push(ground, wallLeft, wallRight);
    World.add(this.world, [ground, wallLeft, wallRight]);

    // Pegs
    this._createPegs();

    // Slots and slot sensors
    this._createSlots();

    // Start the renderer & runner
    Render.run(this.render);
    this.runner = Runner.create();
    Runner.run(this.runner, this.engine);

    // Register engine event listeners once
    Events.on(this.engine, 'collisionStart', this._collisionHandler);
    Events.on(this.engine, 'afterUpdate', this._afterUpdateHandler);
  }

  _createPegs() {
    const opts = this.options;
    const pegBodies = [];
    const cols = Math.ceil(opts.width / opts.pegSpacingX) + 2; // extra for margins
    const rows = opts.rows;

    for (let row = 0; row < rows; row++) {
      const y = 100 + row * opts.pegSpacingY;
      // staggered pattern
      const offset = (row % 2 === 0) ? opts.pegOffsetX : 0;

      for (let col = 0; col < cols; col++) {
        const x = offset + col * opts.pegSpacingX;
        // keep pegs within bounds
        if (x < opts.pegRadius + 5 || x > opts.width - (opts.pegRadius + 5)) continue;

        pegBodies.push(Bodies.circle(x, y, opts.pegRadius, {
          isStatic: true,
          render: { fillStyle: '#aaa' }
        }));
      }
    }

    this.pegBodies = pegBodies;
    World.add(this.world, pegBodies);
  }

  _createSlots() {
    const opts = this.options;
    const multipliers = opts.slotMultipliers;
    const count = multipliers.length;
    const slotWidth = Math.floor(opts.width / count);

    this.slots = [];

    // create vertical dividers and slot sensors
    const staticBodies = [];
    for (let i = 0; i < count; i++) {
      const xCenter = i * slotWidth + slotWidth / 2;
      const leftEdge = i * slotWidth;
      const rightEdge = leftEdge + slotWidth;

      // divider walls (skip first left and last right edges)
      if (i > 0) {
        const dividerX = leftEdge;
        const divider = Bodies.rectangle(dividerX, opts.height - 100, 10, 180, {
          isStatic: true,
          render: { fillStyle: '#444' }
        });
        staticBodies.push(divider);
      }

      // sensor: thin rectangle placed slightly above the ground to detect ball entering
      const sensor = Bodies.rectangle(xCenter, opts.height - opts.groundHeight - 10, slotWidth - 10, 10, {
        isStatic: true,
        isSensor: true,
        label: `slot:${multipliers[i]}`,
        render: { fillStyle: 'transparent' } // invisible
      });

      this.slots.push({
        body: sensor,
        x: xCenter,
        width: slotWidth,
        multiplier: multipliers[i]
      });

      staticBodies.push(sensor);

      // optional visual slot label (non-physical): draw a small rectangle top edge for UI (rendered as static body)
      const labelRect = Bodies.rectangle(xCenter, opts.height - opts.groundHeight - 50, slotWidth - 10, 30, {
        isStatic: true,
        isSensor: true,
        render: {
          fillStyle: '#333',
          strokeStyle: '#666',
          lineWidth: 1
        }
      });
      // We'll not rely on collision for labelRect; it's purely visual
      staticBodies.push(labelRect);
    }

    this.staticBodies = this.staticBodies.concat(staticBodies);
    World.add(this.world, staticBodies);

    // Add optional multipliers text overlay using render.text (Matter.Render doesn't support text directly)
    // We'll draw labels using a small plugin approach in afterRender if needed.
    // For now, it's sufficient to have slot detection via sensors.
  }

  _onCollision(event) {
    const pairs = event.pairs;
    for (let i = 0; i < pairs.length; i++) {
      const pair = pairs[i];
      const bodies = [pair.bodyA, pair.bodyB];

      // If there's no currentBall, skip
      if (!this.currentBall) continue;

      // Check if any body is a slot sensor and the other is the current ball
      for (const b of bodies) {
        if (b.isSensor && b.label && b.label.startsWith('slot:')) {
          // Determine the other body
          const other = (b === pair.bodyA) ? pair.bodyB : pair.bodyA;
          if (other === this.currentBall) {
            const multiplier = parseFloat(b.label.split(':')[1]) || 1;
            this._resolveDrop(multiplier);
            return; // one resolution per collision set
          }
        }
      }
    }
  }

  _afterUpdate() {
    // Safety: if ball falls off world (y too big) or stops, resolve with nearest slot
    if (!this.currentBall) return;

    const y = this.currentBall.position.y;
    if (y > this.options.height + 200) {
      // fallback resolution
      const nearest = this._nearestSlotForX(this.currentBall.position.x);
      this._resolveDrop(nearest.multiplier);
    }
  }

  _nearestSlotForX(x) {
    let best = this.slots[0];
    let bestDist = Math.abs(x - best.x);
    for (let i = 1; i < this.slots.length; i++) {
      const s = this.slots[i];
      const d = Math.abs(x - s.x);
      if (d < bestDist) {
        best = s;
        bestDist = d;
      }
    }
    return best;
  }

  _resolveDrop(multiplier) {
    if (!this._dropResolve) return;
    // remove ball from world and clear references
    try {
      World.remove(this.world, this.currentBall);
    } catch (e) { /* ignore if already removed */ }
    this.currentBall = null;

    // capture resolver and clear before calling to avoid re-entrancy
    const resolve = this._dropResolve;
    const cb = this._dropCallback;
    this._dropResolve = null;
    this._dropReject = null;
    this._dropCallback = null;

    if (typeof cb === "function") {
      try { cb(multiplier); } catch (e) { console.error(e); }
    }
    resolve(multiplier);
  }

  dropBall(dropX = null, callback = null) {
    // Prevent dropping if a ball is already active
    if (this.currentBall) {
      const err = new Error("A ball is already in play.");
      if (callback) {
        // call callback with 0 multiplier to indicate no-op (legacy behavior could vary)
        callback(0);
      }
      return Promise.reject(err);
    }

    const x = (typeof dropX === 'number') ? dropX : this.options.defaultDropX;
    const y = this.options.topDropY;

    const ball = Bodies.circle(x, y, this.options.ballRadius, {
      restitution: this.options.ballRestitution,
      label: 'plinkoBall',
      render: { fillStyle: '#f5c542' }
    });

    this.currentBall = ball;
    World.add(this.world, ball);

    // Promise that will resolve when sensor collision or fallback triggers
    return new Promise((resolve, reject) => {
      this._dropResolve = resolve;
      this._dropReject = reject;
      this._dropCallback = callback;
    });
  }

  reset() {
    // remove dynamic bodies (ball)
    if (this.currentBall) {
      try { World.remove(this.world, this.currentBall); } catch (e) {}
      this.currentBall = null;
    }

    // remove pegs and static slot items
    if (this.pegBodies.length) {
      for (const b of this.pegBodies) {
        try { World.remove(this.world, b); } catch (e) {}
      }
      this.pegBodies = [];
    }

    if (this.staticBodies.length) {
      for (const b of this.staticBodies) {
        try { World.remove(this.world, b); } catch (e) {}
      }
      this.staticBodies = [];
    }

    // stop runner and renderer
    if (this.runner) {
      Runner.stop(this.runner);
      this.runner = null;
    }
    if (this.render) {
      Render.stop(this.render);
      // do not remove the canvas element; let page manage it
      this.render.canvas = null;
      this.render.context = null;
      this.render = null;
    }

    if (this.engine) {
      Events.off(this.engine, 'collisionStart', this._collisionHandler);
      Events.off(this.engine, 'afterUpdate', this._afterUpdateHandler);
      this.engine = null;
      this.world = null;
    }

    // clear slots
    this.slots = [];
  }

  destroy() {
    this.reset();
    // clear global reference if set
    if (window.plinko === this) window.plinko = null;
  }
}

/* Backwards-compatible top-level functions and a default controller
