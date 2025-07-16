const canvas = document.getElementById('tetris');
const context = canvas.getContext('2d');
context.scale(20, 20);

const nextCanvas = document.getElementById('next');
const nextContext = nextCanvas.getContext('2d');
nextContext.scale(20, 20);

const holdCanvas = document.getElementById('hold');
const holdContext = holdCanvas.getContext('2d');
holdContext.scale(20, 20);

const arena = createMatrix(12, 20);

const player = {
    pos: { x: 5, y: 0 },
    matrix: null,
    score: 0
};

let nextPiece = null;
let holdPiece = null;
let canHold = true;

let dropCounter = 0;
let dropInterval = 1000;
let lastTime = 0;

let isPaused = false; // ✅ Pause state toggle

let highScore = localStorage.getItem('highScore') || 0;


function createMatrix(w, h) {
    const matrix = [];
    while (h--) {
        matrix.push(new Array(w).fill(0));
    }
    return matrix;
}

function createPiece(type) {
    if (type === 'T') return [[0, 1, 0], [1, 1, 1], [0, 0, 0]];
    if (type === 'O') return [[2, 2], [2, 2]];
    if (type === 'L') return [[0, 0, 3], [3, 3, 3], [0, 0, 0]];
    if (type === 'J') return [[4, 0, 0], [4, 4, 4], [0, 0, 0]];
    if (type === 'I') return [[0, 0, 0, 0], [5, 5, 5, 5], [0, 0, 0, 0], [0, 0, 0, 0]];
    if (type === 'S') return [[0, 6, 6], [6, 6, 0], [0, 0, 0]];
    if (type === 'Z') return [[7, 7, 0], [0, 7, 7], [0, 0, 0]];
}

function drawMatrix(matrix, offset, ctx = context) {
    const colors = [
        null,
        '#A020F0', // T - purple
        '#FFD700', // O - yellow
        '#FF8C00', // L - orange
        '#1E90FF', // J - blue
        '#00FFFF', // I - cyan
        '#FF69B4', // S - pink 
        '#FF0000', // Z - red
    ];


    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                const baseX = x + offset.x;
                const baseY = y + offset.y;

                // Draw base box with gradient
                const gradient = ctx.createLinearGradient(
                    baseX, baseY,
                    baseX + 1, baseY + 1
                );
                gradient.addColorStop(0, '#fff');              // highlight
                gradient.addColorStop(0.3, colors[value]);     // base color
                gradient.addColorStop(1, '#000');              // shadow

                ctx.fillStyle = gradient;
                ctx.fillRect(baseX, baseY, 1, 1);

                // Draw inner border to separate each block visually
                ctx.strokeStyle = '#333'; // dark inner border
                ctx.lineWidth = 0.05;
                ctx.strokeRect(baseX + 0.02, baseY + 0.02, 0.96, 0.96);

                // Optional outer stroke for better separation
                ctx.strokeStyle = '#000'; // outer border
                ctx.lineWidth = 0.02;
                ctx.strokeRect(baseX, baseY, 1, 1);
            }
        });
    });
}


function drawMatrixGhost(matrix, offset) {
    const ghostColor = 'rgba(255, 255, 255, 0.2)'; // white translucent
    matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                context.fillStyle = ghostColor;
                context.fillRect(x + offset.x, y + offset.y, 1, 1);
            }
        });
    });
}


function drawGrid() {
    context.strokeStyle = '#222'; // grid line color
    for (let x = 0; x < canvas.width / 20; x++) {
        context.beginPath();
        context.moveTo(x * 20, 0);
        context.lineTo(x * 20, canvas.height);
        context.stroke();
    }
    for (let y = 0; y < canvas.height / 20; y++) {
        context.beginPath();
        context.moveTo(0, y * 20);
        context.lineTo(canvas.width, y * 20);
        context.stroke();
    }
}

function drawGhost() {
    const ghost = {
        matrix: player.matrix,
        pos: { x: player.pos.x, y: player.pos.y }
    };

    while (!collide(arena, ghost)) {
        ghost.pos.y++;
    }
    ghost.pos.y--;

    drawMatrixGhost(ghost.matrix, ghost.pos);
}

function drawGrid() {
    context.strokeStyle = '#333'; // subtle dark lines (change as you like)
    context.lineWidth = 0.05;

    const cols = arena[0].length;
    const rows = arena.length;

    for (let x = 0; x < cols; x++) {
        for (let y = 0; y < rows; y++) {
            context.strokeRect(x, y, 1, 1); // grid cell at each block
        }
    }
}

function ghostPosition() {
    const ghost = {
        matrix: player.matrix,
        pos: { x: player.pos.x, y: player.pos.y }
    };

    while (!collide(arena, ghost)) {
        ghost.pos.y++;
    }
    ghost.pos.y--;

    return ghost.pos;
}


function draw() {
    context.fillStyle = '#000';
    context.fillRect(0, 0, canvas.width, canvas.height);

    drawGrid(); // grid lines in background
    drawMatrix(arena, { x: 0, y: 0 }); // landed blocks
    drawMatrixGhost(player.matrix, ghostPosition()); // ghost (shadow)
    drawMatrix(player.matrix, player.pos); // falling piece
}



function drawNext() {
    nextContext.fillStyle = '#000';
    nextContext.fillRect(0, 0, nextCanvas.width, nextCanvas.height);

    const matrix = nextPiece;
    const canvasBlocksX = nextCanvas.width / 20;
    const canvasBlocksY = nextCanvas.height / 20;

    let extraOffsetY = 0;

    // Only adjust the O block
    if (matrix.length === 2 && matrix[0].length === 2) {
        extraOffsetY = -0.5; // raise it slightly
    }

    const offset = {
        x: (canvasBlocksX - matrix[0].length) / 2,
        y: (canvasBlocksY - matrix.length) / 2 + 0.5 + extraOffsetY
    };

    drawMatrix(matrix, offset, nextContext);
}



function drawHold() {
    holdContext.fillStyle = '#000';
    holdContext.fillRect(0, 0, holdCanvas.width, holdCanvas.height);

    if (!holdPiece) return;

    const matrix = holdPiece;
    const canvasBlocksX = holdCanvas.width / 20;
    const canvasBlocksY = holdCanvas.height / 20;

    let extraOffsetY = 0;

    if (matrix.length === 2 && matrix[0].length === 2) {
        extraOffsetY = -0.5;
    }

    const offset = {
        x: (canvasBlocksX - matrix[0].length) / 2,
        y: (canvasBlocksY - matrix.length) / 2 + 0.5 + extraOffsetY
    };

    drawMatrix(matrix, offset, holdContext);
}





function merge(arena, player) {
    player.matrix.forEach((row, y) => {
        row.forEach((value, x) => {
            if (value !== 0) {
                arena[y + player.pos.y][x + player.pos.x] = value;
            }
        });
    });
}

function collide(arena, player) {
    const [m, o] = [player.matrix, player.pos];
    for (let y = 0; y < m.length; ++y) {
        for (let x = 0; x < m[y].length; ++x) {
            if (m[y][x] !== 0 && (arena[y + o.y] && arena[y + o.y][x + o.x]) !== 0) {
                return true;
            }
        }
    }
    return false;
}

function playerDrop() {
    player.pos.y++;
    if (collide(arena, player)) {
        player.pos.y--;
        merge(arena, player);
        arenaSweep();
        updateScore();
        playerReset();
    }
    dropCounter = 0;
}

function hardDrop() {
    while (!collide(arena, player)) {
        player.pos.y++;
    }
    player.pos.y--;
    merge(arena, player);
    arenaSweep();
    updateScore();
    playerReset();
    dropCounter = 0;
}

function playerMove(dir) {
    player.pos.x += dir;
    if (collide(arena, player)) {
        player.pos.x -= dir;
    }
}

function playerRotate() {
    const matrix = player.matrix;

    // Transpose and reverse to rotate clockwise
    for (let y = 0; y < matrix.length; ++y) {
        for (let x = 0; x < y; ++x) {
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
        }
    }
    matrix.forEach(row => row.reverse());

    // Try to wall-kick: shift left or right up to 3 blocks
    const pos = player.pos.x;
    let offset = 1;
    while (collide(arena, player)) {
        player.pos.x += offset;
        offset = -(offset + (offset > 0 ? 1 : -1));
        if (Math.abs(offset) > matrix[0].length) {
            // Rotation is impossible, undo
            for (let y = 0; y < matrix.length; ++y) {
                for (let x = 0; x < y; ++x) {
                    [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
                }
            }
            matrix.reverse(); // undo reverse
            player.pos.x = pos;
            return;
        }
    }
}


function playerHold() {
    if (!canHold) return;

    if (!holdPiece) {
        holdPiece = player.matrix;
        playerReset();
    } else {
        const temp = holdPiece;
        holdPiece = player.matrix;
        player.matrix = temp;
        player.pos.y = 0;
        player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);
        if (collide(arena, player)) {
            arena.forEach(row => row.fill(0));
            player.score = 0;
            alert("Game Over!");
            updateScore();
        }
    }

    canHold = false;
    drawHold();
}

function playerReset() {
    const pieces = 'TJLOSZI';
    if (!nextPiece) {
        nextPiece = createPiece(pieces[Math.floor(Math.random() * pieces.length)]);
    }

    player.matrix = nextPiece;
    nextPiece = createPiece(pieces[Math.floor(Math.random() * pieces.length)]);

    player.pos.y = 0;
    player.pos.x = (arena[0].length / 2 | 0) - (player.matrix[0].length / 2 | 0);

    if (collide(arena, player)) {
        arena.forEach(row => row.fill(0));
        player.score = 0;
        alert("Game Over!");
        updateScore();
    }

    canHold = true;
    drawNext();
    drawHold();
}

function arenaSweep() {
    let rowCount = 1;
    outer: for (let y = arena.length - 1; y >= 0; --y) {
        for (let x = 0; x < arena[y].length; ++x) {
            if (arena[y][x] === 0) continue outer;
        }

        const row = arena.splice(y, 1)[0];
        arena.unshift(new Array(arena[0].length).fill(0));
        ++y;

        player.score += rowCount * 10;
        rowCount *= 2;
    }
}

function updateScore() {
    if (player.score > highScore) {
        highScore = player.score;
        localStorage.setItem('highScore', highScore);
    }

    document.getElementById('score').innerText =
        'Score: ' + player.score + ' | High: ' + highScore;

    updateSpeed(); // ✅ Adjust speed based on score
}

function updateSpeed() {
    // Decrease dropInterval as score increases
    // Minimum interval is capped to avoid becoming too fast
    dropInterval = Math.max(100, 1000 - Math.floor(player.score / 200) * 100);
}


function update(time = 0) {
    if (isPaused) {
        draw(); // So ghost/grid still show if paused
        requestAnimationFrame(update);
        return;
    }

    const deltaTime = time - lastTime;
    lastTime = time;

    dropCounter += deltaTime;
    if (dropCounter > dropInterval) {
        playerDrop();
    }

    draw();
    requestAnimationFrame(update);
}


document.addEventListener('keydown', event => {
    if (isPaused && event.key !== 'Escape') return; // ❌ Block other keys while paused

    if (event.key === 'ArrowLeft') playerMove(-1);
    else if (event.key === 'ArrowRight') playerMove(1);
    else if (event.key === 'ArrowDown') playerDrop();
    else if (event.key === 'ArrowUp') playerRotate();
    else if (event.code === 'Space') hardDrop();
    else if (event.key === 'c' || event.key === 'C') playerHold();
    else if (event.key === 'Escape') togglePause(); // ✅ Use ESC key
});


function togglePause() {
    isPaused = !isPaused;
    document.getElementById('pauseMenu').style.display = isPaused ? 'block' : 'none';
}

function restartGame() {
    location.reload(); // Reloads the entire page
}

function exitGame() {
    // You can customize this as needed, e.g., go to a start screen
    location.href = location.href; // Reload to top (same effect)
}



// For mobile buttons (optional support)
window.playerMove = playerMove;
window.playerDrop = playerDrop;
window.playerRotate = playerRotate;
window.playerHold = playerHold;
window.hardDrop = hardDrop;

playerReset();
update();


function showPauseMessage() {
    document.getElementById('pauseMessage').style.display = 'block';
}

function hidePauseMessage() {
    document.getElementById('pauseMessage').style.display = 'none';
}
