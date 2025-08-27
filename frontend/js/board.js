// frontend/board.js
// Improved, human-style, and optimized Plinko board utilities.
// - More flexible API (configurable rows, spacing, staggering, prizes).
// - Backwards-compatible exports for createPegs / drawPegs and peg constants.
// - Helpers for bins/prize lookup and a simple drawBins function.
// - Small performance improvements: batch paths and reuse computed values.

/**
 * Default configuration for the board.
 * You can override these by passing an options object to createPegs().
 */
const defaultOptions = {
    pegRadius: 5,
    pegColor: '#ecf0f1',
    numRows: 12,
    rowSpacing: 30,
    pegSpacing: 25,
    stagger: true, // alternate offset on each row for a typical Plinko layout
    // default in-game point prizes for bins (centered distribution example)
    prizes: [5, 10, 25, 50, 100, 50, 25, 10, 5],
    binLineColor: '#bdc3c7',
    binLabelColor: '#2c3e50',
    binLabelFont: '12px sans-serif'
};

// Mutable module exports kept for backward compatibility with existing imports.
export let pegs = [];
export let prizes = defaultOptions.prizes.slice();
export let pegRadius = defaultOptions.pegRadius;
export let pegSpacing = defaultOptions.pegSpacing;

/**
 * Create pegs for a plinko board given an HTMLCanvasElement and optional overrides.
 * The layout centers each row and optionally staggers rows by half the peg spacing.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {Object} [opts] - Partial overrides of defaultOptions
 * @returns {Array<{x:number,y:number}>} - Array of peg positions (in canvas coordinates)
 */
function createPegs(canvas, opts = {}) {
    const cfg = Object.assign({}, defaultOptions, opts);

    // keep exported values in sync for compatibility
    pegRadius = cfg.pegRadius;
    pegSpacing = cfg.pegSpacing;
    prizes = Array.isArray(cfg.prizes) ? cfg.prizes.slice() : defaultOptions.prizes.slice();

    pegs = [];

    // Safety checks
    const width = Math.max(0, canvas.width);
    const height = Math.max(0, canvas.height);

    // Precompute vertical positions; ensure we don't place pegs off-canvas
    for (let row = 0; row < cfg.numRows; row++) {
        // Number of pegs in a row grows with row index (original behaviour).
        // For a more uniform look you may want to use floor(width / pegSpacing) instead.
        const numPegs = row + 1;
        const totalRowWidth = numPegs * cfg.pegSpacing;
        let startX = (width - totalRowWidth) / 2;

        // Apply staggering: offset every other row by half pegSpacing
        if (cfg.stagger && (row % 2 === 1)) {
            startX += cfg.pegSpacing / 2;
        }

        const y = cfg.rowSpacing + row * cfg.rowSpacing;
        if (y - cfg.pegRadius > height) break; // don't add rows that would be off-canvas

        for (let col = 0; col < numPegs; col++) {
            const x = startX + col * cfg.pegSpacing + cfg.pegSpacing / 2;
            // Only append pegs that are within canvas bounds (allow small overflow)
            if (x + cfg.pegRadius < 0 || x - cfg.pegRadius > width) continue;
            pegs.push({ x: Math.round(x), y: Math.round(y) });
        }
    }

    return pegs;
}

/**
 * Draw pegs onto a canvas 2D rendering context.
 * Uses a single path per draw call to reduce context overhead.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} [opts] - Optional override for pegColor and pegRadius
 */
function drawPegs(ctx, opts = {}) {
    const pegColor = opts.pegColor || defaultOptions.pegColor;
    const r = typeof opts.pegRadius === 'number' ? opts.pegRadius : pegRadius;

    if (!pegs || pegs.length === 0) return;

    ctx.fillStyle = pegColor;
    ctx.beginPath();
    for (let i = 0, len = pegs.length; i < len; i++) {
        const p = pegs[i];
        // Draw circle using arc for each peg, but keep in one path
        ctx.moveTo(p.x + r, p.y);
        ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    }
    ctx.fill();
}

/**
 * Draw vertical bin divisions and labels for the prizes array.
 * This provides a visual mapping from x coordinate -> prize.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {HTMLCanvasElement} canvas
 * @param {Object} [opts] - Optional overrides for styling (binLineColor, binLabelColor, font)
 */
function drawBins(ctx, canvas, opts = {}) {
    const cfg = Object.assign({}, {
        binLineColor: defaultOptions.binLineColor,
        binLabelColor: defaultOptions.binLabelColor,
        font: defaultOptions.binLabelFont
    }, opts);

    const binCount = Math.max(1, prizes.length);
    const binWidth = canvas.width / binCount;

    ctx.save();
    ctx.strokeStyle = cfg.binLineColor;
    ctx.fillStyle = cfg.binLabelColor;
    ctx.lineWidth = 1;
    ctx.font = cfg.font;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    // Draw vertical lines and labels
    for (let i = 0; i <= binCount; i++) {
        const x = Math.round(i * binWidth);
        ctx.beginPath();
        ctx.moveTo(x + 0.5, 0); // 0.5 to make 1px lines crisper on canvas
        ctx.lineTo(x + 0.5, canvas.height);
        ctx.stroke();
    }

    // Draw prize labels near the bottom of the canvas (above the edge)
    const labelY = canvas.height - Math.max(12, Math.round(canvas.height * 0.04));
    for (let i = 0; i < binCount; i++) {
        const centerX = Math.round((i + 0.5) * binWidth);
        const label = String(prizes[i]);
        ctx.fillText(label, centerX, labelY);
    }

    ctx.restore();
}

/**
 * Given an x coordinate on the canvas, return the bin index (0..prizes.length-1).
 *
 * @param {number} x - x coordinate in canvas space
 * @param {HTMLCanvasElement} canvas
 * @returns {number}
 */
function getBinIndex(x, canvas) {
    const count = Math.max(1, prizes.length);
    const w = canvas.width / count;
    // clamp to valid range
    const idx = Math.floor(x / w);
    return Math.min(Math.max(0, idx), count - 1);
}

/**
 * Return the prize value for an x coordinate on the canvas.
 *
 * @param {number} x - x coordinate in canvas space
 * @param {HTMLCanvasElement} canvas
 * @returns {number}
 */
function getPrizeForX(x, canvas) {
    const idx = getBinIndex(x, canvas);
    return prizes[idx];
}

/**
 * Replace the prizes array used for bins.
 * Helpful when updating the game's reward structure at runtime.
 *
 * @param {Array<number>} newPrizes
 */
function setPrizes(newPrizes) {
    if (!Array.isArray(newPrizes) || newPrizes.length === 0) {
        throw new Error('setPrizes expects a non-empty array');
    }
    prizes = newPrizes.slice();
}

/**
 * Small utility: scale canvas for high-DPI displays.
 * Call this once per canvas before drawing to ensure crisp rendering.
 *
 * @param {HTMLCanvasElement} canvas
 * @param {CanvasRenderingContext2D} ctx
 */
function scaleCanvasForHiDPI(canvas, ctx) {
    const dpr = window.devicePixelRatio || 1;
    if (dpr === 1) return;
    const logicalWidth = canvas.width;
    const logicalHeight = canvas.height;
    canvas.width = Math.round(logicalWidth * dpr);
    canvas.height = Math.round(logicalHeight * dpr);
    canvas.style.width = logicalWidth + 'px';
    canvas.style.height = logicalHeight + 'px';
    ctx.scale(dpr, dpr);
}

// Backwards-compatible exports
export {
    createPegs,
    drawPegs,
    drawBins,
    getBinIndex,
    getPrizeForX,
    setPrizes,
    scaleCanvasForHiDPI
};

/*
Example usage:

import { createPegs, drawPegs, drawBins, getPrizeForX, scaleCanvasForHiDPI } from './board.js';

const canvas = document.getElementById('plinko');
const ctx = canvas.getContext('2d');
scaleCanvasForHiDPI(canvas, ctx);
createPegs(canvas, { numRows: 10, pegSpacing: 28, prizes: [10,20,50,100,50,20,10] });
drawPegs(ctx);
drawBins(ctx, canvas);
*/
