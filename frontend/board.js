// board.js

const pegRadius = 5;
const pegColor = '#ecf0f1';
const numRows = 12;
const rowSpacing = 30;
const pegSpacing = 25;
const prizes = [5, 10, 25, 50, 100, 50, 25, 10, 5]; // Example in-game points

let pegs = [];

// Function to create the plinko board pegs
function createPegs(canvas) {
    pegs = [];
    for (let i = 0; i < numRows; i++) {
        const numPegsInRow = i + 1;
        const startX = (canvas.width - (numPegsInRow * pegSpacing)) / 2;
        const y = rowSpacing + i * rowSpacing;
        for (let j = 0; j < numPegsInRow; j++) {
            pegs.push({
                x: startX + j * pegSpacing + pegSpacing / 2,
                y: y
            });
        }
    }
    return pegs;
}

// Function to draw the pegs on the canvas
function drawPegs(ctx) {
    ctx.fillStyle = pegColor;
    pegs.forEach(peg => {
        ctx.beginPath();
        ctx.arc(peg.x, peg.y, pegRadius, 0, Math.PI * 2);
        ctx.fill();
    });
}

export { createPegs, drawPegs, pegs, prizes, pegRadius, pegSpacing };
