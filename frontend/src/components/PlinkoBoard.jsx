import React, { useEffect, useRef } from "react";

/*
 * PlinkoBoard — canvas rendering + ball animation (skill edition).
 *
 * Bins show POINT values (never multipliers, never Pi). The ball
 * path is produced by the client's own physics simulation from
 * the player's chosen drop position — the server never decides
 * the outcome; it only verifies and scores the submission.
 *
 * Props:
 *   rows, risk ("spread"), path, animating, highlightBin,
 *   targetBin (gold ring), dropX (0..1 aim marker),
 *   theme ("midnight" | "neon" | "gold"), onAnimationDone
 */

const CURVES = {
  low: [1.5, 1.25, 1.1, 1.0, 0.8, 1.0, 1.1, 1.25, 1.5],
  medium: [3.0, 1.8, 1.3, 0.9, 0.5, 0.9, 1.3, 1.8, 3.0],
  high: [10.0, 3.0, 1.5, 0.5, 0.2, 0.5, 1.5, 3.0, 10.0],
};

/*
 * Bin POINT values. MUST match backend/routes/runs.js binPoints.
 * Points are scores only — never convertible to Pi or value.
 */
function binPoints(rows, risk) {
  const curve = CURVES[risk] || CURVES.low;
  const slots = rows + 1;
  const out = [];
  for (let b = 0; b < slots; b += 1) {
    const idx = Math.min(
      curve.length - 1,
      Math.floor((b / Math.max(slots - 1, 1)) * curve.length)
    );
    out.push(Math.round((curve[idx] || 1) * 10));
  }
  return out;
}

const THEMES = {
  midnight: {
    peg: "#3d4a7a",
    ball0: "#ffffff",
    ball1: "#ffd166",
    ball2: "#ff9f1c",
    aim: "#7c5cff",
    target: "#ffd166",
  },
  neon: {
    peg: "#00e5a0",
    ball0: "#ffffff",
    ball1: "#00e5ff",
    ball2: "#0077ff",
    aim: "#ff2fb3",
    target: "#ffe14d",
  },
  gold: {
    peg: "#8a6d3b",
    ball0: "#fffbe8",
    ball1: "#ffd166",
    ball2: "#b8860b",
    aim: "#ffd166",
    target: "#fff3b0",
  },
};

function binColor(points) {
  if (points >= 100) return "#ffd166";
  if (points >= 30) return "#ff9f6e";
  if (points >= 15) return "#7c5cff";
  if (points >= 10) return "#3d6bff";
  return "#2a3358";
}

function layout(rows, width) {
  const margin = 18;
  const top = 34;
  const usable = width - margin * 2;
  const spacing = usable / (rows + 1);
  const rowGap = spacing * 0.92;
  const pegRadius = Math.max(3, spacing * 0.09);
  const height = top + rows * rowGap + 74;

  const peg = (r, k) => ({
    x: width / 2 + (k - r / 2) * spacing,
    y: top + r * rowGap,
  });

  return { spacing, rowGap, pegRadius, height, top, margin, usable, peg };
}

export default function PlinkoBoard({
  rows = 12,
  risk = "low",
  path = "",
  animating = false,
  highlightBin = -1,
  targetBin = -1,
  dropX = null,
  theme = "midnight",
  onAnimationDone,
}) {
  const canvasRef = useRef(null);
  const animRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const t = THEMES[theme] || THEMES.midnight;
    const dpr = window.devicePixelRatio || 1;
    const cssWidth = canvas.clientWidth || 340;
    const { spacing, rowGap, pegRadius, height, top, margin, usable, peg } =
      layout(rows, cssWidth);

    canvas.width = cssWidth * dpr;
    canvas.height = height * dpr;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext("2d");
    ctx.scale(dpr, dpr);

    const bins = binPoints(rows, risk);
    const binTop = top + rows * rowGap + 10;
    const binHeight = 44;

    function drawStatic(ball) {
      ctx.clearRect(0, 0, cssWidth, height);

      // aim marker (player's chosen drop position)
      if (typeof dropX === "number" && !animating) {
        const ax = margin + dropX * usable;
        ctx.fillStyle = t.aim;
        ctx.beginPath();
        ctx.moveTo(ax - 7, 4);
        ctx.lineTo(ax + 7, 4);
        ctx.lineTo(ax, 14);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = t.aim;
        ctx.globalAlpha = 0.35;
        ctx.setLineDash([4, 4]);
        ctx.beginPath();
        ctx.moveTo(ax, 14);
        ctx.lineTo(ax, top - 4);
        ctx.stroke();
        ctx.setLineDash([]);
        ctx.globalAlpha = 1;
      }

      // pegs
      ctx.fillStyle = t.peg;
      for (let r = 0; r < rows; r += 1) {
        for (let k = 0; k <= r; k += 1) {
          const p = peg(r, k);
          ctx.beginPath();
          ctx.arc(p.x, p.y, pegRadius, 0, Math.PI * 2);
          ctx.fill();
        }
      }

      // bins (point values)
      const binWidth = spacing * 0.92;
      for (let b = 0; b <= rows; b += 1) {
        const cx = cssWidth / 2 + (b - rows / 2) * spacing;
        const pts = bins[b];
        const isHit = b === highlightBin;
        const isTarget = b === targetBin;
        ctx.fillStyle = binColor(pts);
        ctx.globalAlpha = isHit || isTarget ? 1 : 0.85;
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
        if (isTarget && !isHit) {
          ctx.strokeStyle = t.target;
          ctx.lineWidth = 2.5;
          ctx.setLineDash([5, 3]);
          ctx.stroke();
          ctx.setLineDash([]);
        }
        ctx.globalAlpha = 1;
        ctx.fillStyle = "#0b0e1a";
        ctx.font = `700 ${pts >= 100 ? 10 : 11}px system-ui`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(`${pts}`, cx, by + binHeight / 2 - (isTarget ? 5 : 0));
        if (isTarget) {
          ctx.font = "700 9px system-ui";
          ctx.fillText("TARGET", cx, by + binHeight / 2 + 9);
        }
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
        g.addColorStop(0, t.ball0);
        g.addColorStop(0.4, t.ball1);
        g.addColorStop(1, t.ball2);
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

    // Build waypoints from the client-simulated path, starting at
    // the player's chosen drop position.
    const waypoints = [];
    let k = 0;
    const startX =
      typeof dropX === "number" ? margin + dropX * usable : peg(0, 0).x;
    waypoints.push({ x: startX, y: top - rowGap * 0.9 });
    for (let r = 0; r < rows; r += 1) {
      const p = peg(r, k);
      waypoints.push({ x: p.x, y: p.y - pegRadius - 8 });
      if (path[r] === "R") k += 1;
    }
    const endBinX = cssWidth / 2 + (k - rows / 2) * spacing;
    waypoints.push({ x: endBinX, y: binTop + binHeight / 2 });

    const stepMs = 105;
    const totalMs = waypoints.length * stepMs;
    const t0 = performance.now();

    function ease(tn) {
      return tn < 0.5
        ? 2 * tn * tn
        : 1 - Math.pow(-2 * tn + 2, 2) / 2;
    }

    function frame(now) {
      const tprog = Math.min((now - t0) / totalMs, 1);
      const segFloat = tprog * (waypoints.length - 1);
      const seg = Math.min(Math.floor(segFloat), waypoints.length - 2);
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

      if (tprog < 1) {
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
  }, [rows, risk, path, animating, highlightBin, targetBin, dropX, theme]);

  return <canvas ref={canvasRef} className="plinko" />;
}

export { binPoints };
