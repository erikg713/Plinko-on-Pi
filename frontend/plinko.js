let Engine = Matter.Engine,
    Render = Matter.Render,
    Runner = Matter.Runner,
    World = Matter.World,
    Bodies = Matter.Bodies,
    Events = Matter.Events;

let engine, world, render, slots, ball;
let slotMultipliers = [0.5, 1, 2, 5, 10]; // payout multipliers

function setupPlinko() {
  engine = Engine.create();
  world = engine.world;

  render = Render.create({
    element: document.body,
    canvas: document.getElementById("plinkoCanvas"),
    engine: engine,
    options: {
      width: 600,
      height: 800,
      wireframes: false,
      background: "#222"
    }
  });

  // Ground
  World.add(world, Bodies.rectangle(300, 790, 600, 20, { isStatic: true }));

  // Pegs
  for (let y = 100; y < 600; y += 80) {
    for (let x = (y / 80) % 2 === 0 ? 75 : 50; x < 600; x += 50) {
      World.add(world, Bodies.circle(x, y, 5, { isStatic: true }));
    }
  }

  // Slots at bottom
  slots = [];
  for (let i = 0; i < slotMultipliers.length; i++) {
    let x = (i + 1) * (600 / (slotMultipliers.length + 1));
    let wallLeft = Bodies.rectangle(x - 30, 770, 10, 60, { isStatic: true });
    let wallRight = Bodies.rectangle(x + 30, 770, 10, 60, { isStatic: true });
    slots.push({ x, multiplier: slotMultipliers[i] });
    World.add(world, [wallLeft, wallRight]);
  }

  Render.run(render);
  Runner.run(Runner.create(), engine);
}

function dropBall(callback) {
  ball = Bodies.circle(300, 50, 10, { restitution: 0.5 });
  World.add(world, ball);

  Events.on(engine, "afterUpdate", function () {
    if (ball.position.y > 750) {
      // Find nearest slot
      let nearest = slots.reduce((prev, curr) =>
        Math.abs(curr.x - ball.position.x) < Math.abs(prev.x - ball.position.x)
          ? curr
          : prev
      );
      callback(nearest.multiplier);
      World.remove(world, ball);
    }
  });
}
