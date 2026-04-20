import { puzzlePacks } from './wordBank.js';

const GRID_SIZE = 13;
const MAX_WORDS = 10;
const MAX_PACK_ATTEMPTS = 70;

let activePuzzle = null;
let activeGrid = null;

function createEmptyGrid(size) {
    return Array.from({ length: size }, () => Array(size).fill(null));
}

function canPlaceWord(grid, word, row, col, direction) {
    const size = grid.length;
    const dr = direction === 'down' ? 1 : 0;
    const dc = direction === 'across' ? 1 : 0;

    const endRow = row + dr * (word.length - 1);
    const endCol = col + dc * (word.length - 1);
    if (row < 0 || col < 0 || endRow >= size || endCol >= size) return false;

    const beforeRow = row - dr;
    const beforeCol = col - dc;
    const afterRow = endRow + dr;
    const afterCol = endCol + dc;

    if (beforeRow >= 0 && beforeCol >= 0 && beforeRow < size && beforeCol < size && grid[beforeRow][beforeCol]) return false;
    if (afterRow >= 0 && afterCol >= 0 && afterRow < size && afterCol < size && grid[afterRow][afterCol]) return false;

    let overlaps = 0;

    for (let i = 0; i < word.length; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        const cell = grid[r][c];

        if (cell) {
            if (cell.letter !== word[i]) return false;
            overlaps++;
        } else {
            if (direction === 'across') {
                if ((r > 0 && grid[r - 1][c]) || (r < size - 1 && grid[r + 1][c])) return false;
            } else if ((c > 0 && grid[r][c - 1]) || (c < size - 1 && grid[r][c + 1])) {
                return false;
            }
        }
    }

    return overlaps > 0 || isGridEmpty(grid);
}

function isGridEmpty(grid) {
    return grid.every(row => row.every(cell => cell === null));
}

function placeWord(grid, entry, row, col, direction) {
    const dr = direction === 'down' ? 1 : 0;
    const dc = direction === 'across' ? 1 : 0;

    for (let i = 0; i < entry.word.length; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (!grid[r][c]) {
            grid[r][c] = { letter: entry.word[i], owners: [] };
        }
        grid[r][c].owners.push(entry.word);
    }
}

function removeWord(grid, entry, row, col, direction) {
    const dr = direction === 'down' ? 1 : 0;
    const dc = direction === 'across' ? 1 : 0;

    for (let i = 0; i < entry.word.length; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        const cell = grid[r][c];
        if (!cell) continue;

        cell.owners = cell.owners.filter(owner => owner !== entry.word);
        if (cell.owners.length === 0) grid[r][c] = null;
    }
}

function findCandidatePlacements(grid, entry) {
    const size = grid.length;
    const placements = [];

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {
            for (const direction of ['across', 'down']) {
                if (canPlaceWord(grid, entry.word, r, c, direction)) {
                    placements.push({ row: r, col: c, direction, score: scorePlacement(grid, entry.word, r, c, direction) });
                }
            }
        }
    }

    return placements.sort((a, b) => b.score - a.score);
}

function scorePlacement(grid, word, row, col, direction) {
    const dr = direction === 'down' ? 1 : 0;
    const dc = direction === 'across' ? 1 : 0;
    let overlapScore = 0;

    for (let i = 0; i < word.length; i++) {
        const r = row + dr * i;
        const c = col + dc * i;
        if (grid[r][c]) overlapScore += 3;
    }

    const center = Math.floor(grid.length / 2);
    const distance = Math.abs(row - center) + Math.abs(col - center);
    return overlapScore - distance * 0.2;
}

function fillGrid(grid, entries, index, placed) {
    if (index >= entries.length) return true;

    const entry = entries[index];
    const placements = findCandidatePlacements(grid, entry);

    for (const placement of placements) {
        placeWord(grid, entry, placement.row, placement.col, placement.direction);
        placed.push({ ...entry, ...placement });

        if (fillGrid(grid, entries, index + 1, placed)) return true;

        placed.pop();
        removeWord(grid, entry, placement.row, placement.col, placement.direction);
    }

    return false;
}

function assignNumbers(grid, placed) {
    const starts = [...new Map(placed.map(p => [`${p.row}-${p.col}`, { row: p.row, col: p.col }])).values()]
        .sort((a, b) => a.row - b.row || a.col - b.col);

    starts.forEach((start, idx) => {
        const number = idx + 1;
        if (grid[start.row][start.col]) grid[start.row][start.col].number = number;

        placed.forEach(word => {
            if (word.row === start.row && word.col === start.col) word.number = number;
        });
    });

    return placed;
}

function renderGrid(grid) {
    const container = document.getElementById('grid-container');
    const table = document.createElement('table');

    for (let r = 0; r < grid.length; r++) {
        const tr = document.createElement('tr');

        for (let c = 0; c < grid[r].length; c++) {
            const td = document.createElement('td');
            const cell = grid[r][c];

            if (!cell) {
                td.classList.add('block');
                tr.appendChild(td);
                continue;
            }

            if (cell.number) {
                const marker = document.createElement('span');
                marker.className = 'number';
                marker.textContent = String(cell.number);
                td.appendChild(marker);
            }

            const input = document.createElement('input');
            input.maxLength = 1;
            input.dataset.row = String(r);
            input.dataset.col = String(c);
            input.autocomplete = 'off';
            input.spellcheck = false;

            input.addEventListener('input', () => {
                input.value = input.value.replace(/[^a-z]/gi, '').slice(0, 1).toUpperCase();
                td.classList.remove('incorrect', 'correct');
                if (input.value) moveToNextCell(r, c);
                updateStatus('');
                if (isComplete()) updateStatus('✨ Grid complete! Press Check Grid to verify your solution.');
            });

            input.addEventListener('keydown', event => {
                if (event.key === 'Backspace' && !input.value) moveToPreviousCell(r, c);
            });

            td.appendChild(input);
            tr.appendChild(td);
        }

        table.appendChild(tr);
    }

    container.innerHTML = '';
    container.appendChild(table);
}

function moveToNextCell(row, col) {
    const inputs = [...document.querySelectorAll('#grid-container input')];
    const currentIndex = inputs.findIndex(el => Number(el.dataset.row) === row && Number(el.dataset.col) === col);
    if (currentIndex >= 0 && currentIndex < inputs.length - 1) inputs[currentIndex + 1].focus();
}

function moveToPreviousCell(row, col) {
    const inputs = [...document.querySelectorAll('#grid-container input')];
    const currentIndex = inputs.findIndex(el => Number(el.dataset.row) === row && Number(el.dataset.col) === col);
    if (currentIndex > 0) inputs[currentIndex - 1].focus();
}

function renderClues(placed) {
    const clues = document.getElementById('clues');

    const across = placed.filter(item => item.direction === 'across').sort((a, b) => a.number - b.number);
    const down = placed.filter(item => item.direction === 'down').sort((a, b) => a.number - b.number);

    clues.innerHTML = '';

    const section = (title, list) => {
        const h2 = document.createElement('h2');
        h2.textContent = title;
        clues.appendChild(h2);

        const ol = document.createElement('ol');
        list.forEach(entry => {
            const li = document.createElement('li');
            li.textContent = `${entry.number}. ${entry.clue} (${entry.word.length})`;
            ol.appendChild(li);
        });
        clues.appendChild(ol);
    };

    section('Across', across);
    section('Down', down);
}

function updateStatus(message, tone = 'normal') {
    const status = document.getElementById('status');
    status.textContent = message;
    status.style.color = tone === 'bad' ? '#ff9daf' : tone === 'good' ? '#9dffd1' : '#c8dcff';
}

function forEachInputCell(callback) {
    document.querySelectorAll('#grid-container input').forEach(input => {
        const row = Number(input.dataset.row);
        const col = Number(input.dataset.col);
        callback(input, row, col);
    });
}

function checkGrid() {
    let incorrect = 0;
    forEachInputCell((input, row, col) => {
        const td = input.parentElement;
        const expected = activeGrid[row][col].letter;
        const actual = input.value.toUpperCase();

        td.classList.remove('correct', 'incorrect');

        if (!actual) return;
        if (actual === expected) td.classList.add('correct');
        else {
            td.classList.add('incorrect');
            incorrect++;
        }
    });

    if (incorrect === 0 && isComplete()) updateStatus('🏆 Perfect solve. You cracked the Neon Rift archive!', 'good');
    else if (incorrect === 0) updateStatus('Nice! Everything filled so far is correct.', 'good');
    else updateStatus(`Found ${incorrect} incorrect cell${incorrect > 1 ? 's' : ''}. Keep going.`, 'bad');
}

function revealRandomHint() {
    const candidates = [];

    forEachInputCell((input, row, col) => {
        const expected = activeGrid[row][col].letter;
        if (input.value.toUpperCase() !== expected) candidates.push({ input, row, col, expected });
    });

    if (candidates.length === 0) {
        updateStatus('No hint needed — your grid is already solved!', 'good');
        return;
    }

    const hint = candidates[Math.floor(Math.random() * candidates.length)];
    hint.input.value = hint.expected;
    hint.input.parentElement.classList.remove('incorrect');
    hint.input.parentElement.classList.add('correct');
    updateStatus(`Hint unlocked at row ${hint.row + 1}, column ${hint.col + 1}.`, 'good');
}

function revealAll() {
    forEachInputCell((input, row, col) => {
        input.value = activeGrid[row][col].letter;
        const td = input.parentElement;
        td.classList.remove('incorrect');
        td.classList.add('correct');
    });

    updateStatus('Grid revealed. Try New Puzzle for another unique layout.');
}

function isComplete() {
    let filled = true;
    forEachInputCell(input => {
        if (!input.value) filled = false;
    });
    return filled;
}

function shuffle(list) {
    const arr = list.slice();
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function generatePuzzle() {
    const pack = puzzlePacks[Math.floor(Math.random() * puzzlePacks.length)];
    const sortedWords = pack.words.slice().sort((a, b) => b.word.length - a.word.length);

    for (let attempt = 0; attempt < MAX_PACK_ATTEMPTS; attempt++) {
        const chosenWords = shuffle(sortedWords).slice(0, MAX_WORDS).sort((a, b) => b.word.length - a.word.length);
        const grid = createEmptyGrid(GRID_SIZE);
        const placed = [];

        if (fillGrid(grid, chosenWords, 0, placed)) {
            return { pack, grid, placed: assignNumbers(grid, placed) };
        }
    }

    return null;
}

function createNewPuzzle() {
    const generated = generatePuzzle();

    if (!generated) {
        updateStatus('Could not generate puzzle. Refresh to retry. Please lower word count.', 'bad');
        return;
    }

    activePuzzle = generated.pack;
    activeGrid = generated.grid;

    document.getElementById('title').textContent = activePuzzle.title;
    document.getElementById('subtitle').textContent = activePuzzle.subtitle;

    renderGrid(activeGrid);
    renderClues(generated.placed);
    updateStatus('Welcome to the grid. Fill it in, then use Check Grid to validate.');
}

document.getElementById('check-grid').addEventListener('click', checkGrid);
document.getElementById('hint-letter').addEventListener('click', revealRandomHint);
document.getElementById('reveal-grid').addEventListener('click', revealAll);
document.getElementById('new-puzzle').addEventListener('click', createNewPuzzle);

document.addEventListener('DOMContentLoaded', createNewPuzzle);
