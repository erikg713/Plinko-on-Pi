import React, { useEffect, useRef } from "react";
import Matter from "matter-js";
import { placeBet } from "../api";

export default function PlinkoBoard({ user }) {
  const canvasRef = useRef();

  useEffect(() => {
    const engine = Matter.Engine.create();
    const render = Matter.Render.create({
      element: canvasRef.current,
      engine: engine,
      options: { width: 400, height: 600, wireframes: false }
    });

    // Build board pegs
    const pegs = [];
    for (let row = 0; row < 10; row++) {
      for (let col = 0; col <= row; col++) {
        const peg = Matter.Bodies.circle(200 + (col - row / 2) * 40, 50 + row * 50, 5, { isStatic: true });
        pegs.push(peg);
      }
    }

    const ground = Matter.Bodies.rectangle(200, 590, 400, 20, { isStatic: true });
    Matter.World.add(engine.world, [...pegs, ground]);

    Matter.Engine.run(engine);
    Matter.Render.run(render);

    return () => {
      Matter.Render.stop(render);
      Matter.Engine.clear(engine);
    };
  }, []);

  const handleDropBall = async (betAmount) => {
    if (!user) return alert("Login with Pi Browser first!");

    try {
      const result = await placeBet(user.uid, betAmount);
      alert(`🎉 You won ${result.winnings} Pi!`);
    } catch (err) {
      console.error(err);
      alert("❌ Bet failed");
    }
  };

  return (
    <div>
      <h2>Drop your ball</h2>
      <button onClick={() => handleDropBall(1)}>Bet 1 Pi</button>
      <button onClick={() => handleDropBall(5)}>Bet 5 Pi</button>
      <div ref={canvasRef}></div>
    </div>
  );
}
