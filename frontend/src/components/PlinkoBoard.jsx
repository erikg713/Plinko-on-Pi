import React, { useEffect, useRef } from "react";

/*
 * PlinkoBoard — canvas rendering + ball animation.
 *
 * The outcome is ALWAYS decided server-side. This component only
 * visualizes: pegs, bins, and an animated ball that follows the
 * server-provided path (e.g. "LRLR..."). It never computes a
 * multiplier or payout.
 */

const CURVES = {
  low: [1.5, 1.25, 1.1, 1.0, 0.8, 1.0, 1.1, 1.25, 1.5],
  medium: [3.0, 1.8, 1.3, 0.9, 0.5, 0.9, 1.3, 1.8, 3.0],
  high: [10.0, 3.0, 1.5, 0.5, 0.2, 0.5, 1.5, 3.0, 10.0],
};

function binMultipliers(rows, risk) {
  const curve = CURVES[risk] || CURVES.low;
  const slots = rows + 1;
  const out = [];
  for (let b = 0; b < slots; b += 1) {
    const idx = Math.min(
      curve.length - 1,
      Math.floor((b / Math.max(slots - 1, 1)) * curve.length)
    );
    out.push(curve[idx] || 1);
  }
  return out;
}

function binColor(mult) {
  if (mult >= 10) return "#ffd166";
  if (mult >= 3) return "#ff9f6e";
  if (mult >= 1.5) return "#7c5cff";
  if (mult >= 1) return "#3d6bff";
  return "#2a3358";
}

function layout(rows, width) {
  const margin = 18;
  const top = 26;
  const usable = width - margin * 2;
  const spacing = usable / (rows + 1);
  const rowGap = spacing * 0.92;
  const pegRadius = Math.max(3, spacing * 0.09);
  const height = top + rows * rowGap + 74;

  const peg = (r, k) => ({
    x: width / 2 + (k - r / 2) * spacing,
    y: top + r * rowGap,
  });

  return { spacing, rowGap, pegRadius, height, top, margin, peg };
}

export default function PlinkoBoard({
  rows = 12,
  risk = "low",
  path = "",
  animating = false,
  highlightBin = -1,
  onAnimationDone,
}) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 340;
    const { spacing, rowGap, pegRadius, height, top, peg } = layout(
      rows,
      cssWidth
    );

    canvas.width = cssWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const bins = binMultipliers(rows, risk);
    const binTop = top + rows * rowGap + 10;
    const binHeight = 44;

    function drawStatic(ball) {
      ctx.clearRect(0, 0, cssWidth, height);

      // pegs
      ctx.fillStyle = "#3d4a7a";
      for (let r = 0; r < rows; r += 1) {
        for (let k = 0; k <= r; k += 1) {
          const p = peg(r, k);
          ctx.beginPath();
          ctx.arc(p.x, p.y, pegRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // bins
      const binWidth = spacing * 0.92;
      for (let b = 0; b <= rows; b += 1) {
        const cx = cssWidth / 2 + (b - rows / 2) * spacing;
        const mult = bins[b];
        const isHit = b === highlightBin;
        ctx.fillStyle = binColor(mult);
        ctx.globalAlpha = isHit ? 1 : 0.85;
        const bx = cx - binWidth / 2;
        const by = binTop;
        const r = 7;
        ctx.beginPath();
        ctx.roundRect(bx, by, binWidth, binHeight, r);
        ctx.fill();
        if (isHit) {
          ctx.strokeStyle = "#ffffff";
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#0b0e1a";
        ctx.font = `700 ${mult >= 10 ? 10 : 11}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(
          `${mult}x`,
          cx,
          by + binHeight / 2
        );
      }

      // ball
      if (ball) {
        const g = ctx.createRadialGradient(
          ball.x - 3,
          ball.y - 3,
          1,
          ball.x,
          ball.y,
          11
        );
        g.addColorStop(0, "#ffffff");
        g.addColorStop(0.4, "#ffd166");
        g.addColorStop(1, "#ff9f1c");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(ball.x, ball.y, 9, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // cancel any previous animation
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }

    if (!animating || !path || path.length !== rows) {
      drawStatic(null);
      return;
    }

    // Build waypoints from the server path: row by row.
    const waypoints = [];
    let k = 0;
    const start = peg(0, 0);
    waypoints.push({ x: start.x, y: start.y - rowGap * 0.9 });
    for (let r = 0; r < rows; r += 1) {
      const p = peg(r, k);
      waypoints.push({ x: p.x, y: p.y - pegRadius - 8 });
      if (path[r] === "R") k += 1;
    }
    const endBinX =
      cssWidth / 2 + (k - rows / 2) * spacing;
    waypoints.push({ x: endBinX, y: binTop + binHeight / 2 });

    const stepMs = 105;
    const totalMs = waypoints.length * stepMs;
    const t0 = performance.now();

    function ease(t) {
      return t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;
    }

    function frame(now) {
      const t = Math.min((now - t0) / totalMs, 1);
      const segFloat = t * (waypoints.length - 1);
      const seg = Math.min(
        Math.floor(segFloat),
        waypoints.length - 2
      );
      const segT = ease(segFloat - seg);
      const a = waypoints[seg];
      const b = waypoints[seg + 1];
      // small hop arc between pegs
      const hop = Math.sin(segT * Math.PI) * -7;
      const ball = {
        x: a.x + (b.x - a.x) * segT,
        y: a.y + (b.y - a.y) * segT + hop,
      };
      drawStatic(ball);

      if (t < 1) {
        animRef.current = requestAnimationFrame(frame);
      } else {
        animRef.current = null;
        if (onAnimationDone) onAnimationDone();
      }
    }

    animRef.current = requestAnimationFrame(frame);

    return () => {
      if (animRef.current) {
        cancelAnimationFrame(animRef.current);
        animRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, risk, path, animating, highlightBin]);

  return (
    <canvas ref={canvasRef} className="plinko" />
  );
}

export { binMultipliers };
