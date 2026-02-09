class Board {
    constructor({ width, height, bombs, lives, shields = 0, defuseKits = 0, boardEl, explosionSound, popSound, eventBus }) {
        this.cols = width;
        this.rows = height;
        this.bombs = bombs;
        this.lives = lives;
        this.livesLeft = lives;
        this.shieldsLeft = shields;
        this.defuseKits = defuseKits;
        this.revealedBombs = 0;
        this.boardEl = boardEl;
        this.explosionSound = explosionSound;
        this.popSound = popSound;
        this.eventBus = eventBus;

        this.tiles = [];
        this.safeLeft = width * height - bombs;
        this.flagCount = 0;
        this.firstReveal = true;
        this.locked = false;
        this.lastBombHit = null;
        this.cellGap = 4;
        this.flagMode = false;
        this.longPressDuration = 450;
        this.hapticEnabled = 'vibrate' in navigator;
        this.touchPress = null;

        this.buildBoard();
        this.placeBombs();
        this.computeNeighbors();
    }

    setCellSize() {
        if (!this.boardEl) return;
        const availableWidth = window.innerWidth * 0.92;
        const availableHeight = window.innerHeight * 0.6;
        const widthSize = (availableWidth - this.cellGap * (this.cols - 1)) / this.cols;
        const heightSize = (availableHeight - this.cellGap * (this.rows - 1)) / this.rows;
        const size = Math.floor(Math.min(widthSize, heightSize, 48));
        const clamped = Math.max(24, size);
        this.boardEl.style.setProperty('--cell-size', `${clamped}px`);
        this.boardEl.style.gridTemplateColumns = `repeat(${this.cols}, ${clamped}px)`;
    }

    resize() {
        this.setCellSize();
    }

    buildBoard() {
        this.setCellSize();
        this.boardEl.innerHTML = '';
        this.boardEl.classList.remove('locked');
        this.boardEl.classList.remove('board-shake');
        this.boardEl.oncontextmenu = (e) => e.preventDefault();
        this.boardEl.onselectstart = () => false;

        for (let r = 0; r < this.rows; r++) {
            this.tiles[r] = [];
            for (let c = 0; c < this.cols; c++) {
                const el = document.createElement('div');
                el.classList.add('cell');
                el.dataset.r = r;
                el.dataset.c = c;
                el.onmousedown = (e) => {
                    if (e.button === 2) this.toggleFlag(r, c);
                };
                el.oncontextmenu = (e) => e.preventDefault();
                el.onselectstart = () => false;
                el.onclick = () => {
                    if (el._suppressClick) {
                        el._suppressClick = false;
                        return;
                    }
                    this.handleCellPrimaryAction(r, c);
                };
                this.boardEl.appendChild(el);
                this.tiles[r][c] = new Tile(r, c, el);
            }
        }

        this.emitFlagsChange();
        this.bindTouchControls();
    }

    setFlagMode(active) {
        this.flagMode = active;
        if (this.boardEl) {
            this.boardEl.classList.toggle('flag-mode-active', active);
        }
    }

    handleCellPrimaryAction(r, c) {
        if (this.flagMode) {
            this.toggleFlag(r, c);
            return;
        }
        this.revealAt(r, c, false, 0);
    }

    clearLongPress(el) {
        if (!el || !el._longPressTimer) return;
        clearTimeout(el._longPressTimer);
        el._longPressTimer = null;
        el._longPressTriggered = false;
    }

    startTouchPress(r, c, el) {
        this.clearLongPress(el);
        el._longPressTriggered = false;
        el._longPressTimer = setTimeout(() => {
            this.toggleFlag(r, c);
            this.triggerHaptic(40);
            el._longPressTriggered = true;
            el._suppressClick = true;
        }, this.longPressDuration);
    }

    bindTouchControls() {
        if (!this.boardEl || !('ontouchstart' in window)) return;
        const threshold = 10;
        this.boardEl.addEventListener('touchstart', (event) => {
            if (this.locked) return;
            const touch = event.changedTouches[0];
            if (!touch) return;
            const target = event.target.closest('.cell');
            if (!target) return;
            event.preventDefault();
            const r = parseInt(target.dataset.r, 10);
            const c = parseInt(target.dataset.c, 10);
            this.touchPress = {
                r,
                c,
                el: target,
                startX: touch.clientX,
                startY: touch.clientY
            };
            this.startTouchPress(r, c, target);
        }, { passive: false });

        this.boardEl.addEventListener('touchmove', (event) => {
            if (!this.touchPress) return;
            const touch = event.changedTouches[0];
            if (!touch) return;
            const dx = Math.abs(touch.clientX - this.touchPress.startX);
            const dy = Math.abs(touch.clientY - this.touchPress.startY);
            if (dx > threshold || dy > threshold) {
                this.clearLongPress(this.touchPress.el);
                this.touchPress = null;
            }
        }, { passive: false });

        this.boardEl.addEventListener('touchend', (event) => {
            if (!this.touchPress) return;
            const press = this.touchPress;
            this.touchPress = null;
            event.preventDefault();
            const wasLongPress = press.el._longPressTriggered;
            this.clearLongPress(press.el);
            if (!wasLongPress) {
                this.handleCellPrimaryAction(press.r, press.c);
            }
            press.el._suppressClick = true;
        }, { passive: false });

        this.boardEl.addEventListener('touchcancel', () => {
            if (!this.touchPress) return;
            this.clearLongPress(this.touchPress.el);
            this.touchPress = null;
        });
    }


    triggerHaptic(duration) {
        if (!this.hapticEnabled || this.locked) return;
        navigator.vibrate(duration);
    }

    emitFlagsChange() {
        const remainingBombs = Math.max(this.bombs - this.revealedBombs, 0);
        if (this.eventBus) {
            this.eventBus.emit('flagsChange', { flags: this.flagCount, total: remainingBombs });
        }
    }

    emitBoardChange() {
        if (this.eventBus) this.eventBus.emit('boardChange');
    }

    setShields(count) {
        this.shieldsLeft = count;
        if (this.eventBus) this.eventBus.emit('shieldChange', { left: this.shieldsLeft });
    }

    placeBombs() {
        let placed = 0;
        while (placed < this.bombs) {
            const r = Math.floor(Math.random() * this.rows);
            const c = Math.floor(Math.random() * this.cols);
            if (!this.tiles[r][c].isBomb) {
                this.tiles[r][c] = new BombTile(r, c, this.tiles[r][c].el);
                placed++;
            }
        }
    }

    computeNeighbors() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.tiles[r][c];
                if (tile.isBomb) continue;

                let count = 0;
                for (let i = -1; i <= 1; i++) {
                    for (let j = -1; j <= 1; j++) {
                        const rr = r + i;
                        const cc = c + j;
                        if (rr >= 0 && rr < this.rows && cc >= 0 && cc < this.cols && this.tiles[rr][cc].isBomb) {
                            count++;
                        }
                    }
                }

                if (count > 0) this.tiles[r][c] = new NumberTile(r, c, tile.el, count);
                else this.tiles[r][c] = new EmptyTile(r, c, tile.el);
            }
        }
    }

    toggleFlag(r, c) {
        if (this.locked) return;
        const tile = this.tiles[r][c];
        if (tile.revealed) return;

        tile.setFlagged(!tile.flagged);
        this.flagCount += tile.flagged ? 1 : -1;
        this.triggerHaptic(tile.flagged ? 30 : 15);
        this.emitFlagsChange();
        this.checkWin();
        this.emitBoardChange();
    }

    revealAt(r, c, isFlood, depth) {
        if (this.locked) return;
        const tile = this.tiles[r][c];
        if (tile.flagged || tile.revealed) return;

        if (this.firstReveal) {
            this.firstReveal = false;
            if (this.eventBus) this.eventBus.emit('firstReveal');
        }

        const delayMs = Math.min(depth, 12) * 20;
        tile.reveal(isFlood, delayMs);
        if (!isFlood && !tile.isBomb && this.popSound) {
            this.popSound.currentTime = 0;
            this.popSound.play();
        }

        if (tile.isBomb) {
            if (this.defuseKits > 0) {
                this.defuseKits -= 1;
                if (this.eventBus) this.eventBus.emit('defuseChange', { left: this.defuseKits });
                tile.el.classList.add('defused');
                tile.showBomb();
                this.revealedBombs += 1;
                this.emitFlagsChange();
                this.checkWin();
                this.emitBoardChange();
                return;
            }
            tile.showBomb();
            this.lastBombHit = { r, c };
            if (this.explosionSound) this.explosionSound.play();
            this.revealedBombs += 1;
            this.emitFlagsChange();
            if (this.shieldsLeft > 0) {
                this.shieldsLeft -= 1;
                if (this.eventBus) this.eventBus.emit('shieldChange', { left: this.shieldsLeft });
            } else {
                this.livesLeft -= 1;
                if (this.eventBus) this.eventBus.emit('livesChange', { left: this.livesLeft });
            }
            if (this.safeLeft === 0) {
                if (this.livesLeft > 0) this.handleWin({ scraped: true });
                else this.handleLoss();
                this.emitBoardChange();
                return;
            }
            if (this.livesLeft <= 0) {
                this.handleLoss();
                this.emitBoardChange();
            } else {
                this.boardEl.classList.remove('board-shake');
                void this.boardEl.offsetWidth;
                this.boardEl.classList.add('board-shake');
                this.flashTilesFrom(r, c);
                this.checkWin();
                this.emitBoardChange();
            }
            return;
        }

        this.safeLeft--;
        tile.setNumber(tile.neighbor);

        if (tile.neighbor === 0) {
            for (let i = -1; i <= 1; i++) {
                for (let j = -1; j <= 1; j++) {
                    const rr = r + i;
                    const cc = c + j;
                    if (rr < 0 || rr >= this.rows || cc < 0 || cc >= this.cols) continue;
                    if (this.tiles[rr][cc].isBomb) continue;
                    this.revealAt(rr, cc, true, depth + 1);
                }
            }
        }

        this.checkWin();
        this.emitBoardChange();
    }

    checkWin() {
        if (this.safeLeft === 0) {
            this.handleWin();
            return;
        }

        let correctFlags = 0;
        let accountedBombs = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.tiles[r][c];
                if (tile.flagged && tile.isBomb) correctFlags++;
                if (tile.isBomb && (tile.flagged || tile.revealed)) accountedBombs++;
            }
        }

        if (correctFlags === this.bombs && this.flagCount === this.bombs) this.handleWin({ revealAllSafe: true });
        if (accountedBombs === this.bombs) this.handleWin({ revealAllSafe: true });
    }

    revealAllBombs() {
        const origin = this.lastBombHit || { r: Math.floor(this.rows / 2), c: Math.floor(this.cols / 2) };
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.tiles[r][c];
                if (!tile.isBomb) continue;
                tile.el.classList.add('revealed', 'bomb-explode');
                const dist = Math.abs(origin.r - r) + Math.abs(origin.c - c);
                tile.el.style.animationDelay = `${Math.min(dist, 20) * 25}ms`;
                tile.showBomb();
            }
        }
    }

    handleWin({ scraped = false, revealAllSafe = false } = {}) {
        if (this.locked) return;
        this.scrapedWin = scraped;
        if (revealAllSafe) this.revealAllSafeTiles();
        else this.revealAllSafeTilesIfAllBombsFlagged();
        this.locked = true;
        this.boardEl.classList.add('locked');
        this.flagAllBombsForWin();
        if (this.eventBus) this.eventBus.emit('win', { scraped });
    }

    handleLoss() {
        if (this.locked) return;
        this.locked = true;
        this.scrapedWin = false;
        this.boardEl.classList.add('locked');
        this.boardEl.classList.remove('board-shake');
        void this.boardEl.offsetWidth;
        this.boardEl.classList.add('board-shake');
        this.revealAllBombs();
        if (this.eventBus) this.eventBus.emit('loss');
    }

    flagAllBombsForWin() {
        let addedFlags = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.tiles[r][c];
                if (!tile.isBomb) continue;
                if (!tile.flagged) {
                    tile.setFlagged(true);
                    addedFlags++;
                }
                tile.el.classList.add('flag-pulse');
            }
        }
        if (addedFlags > 0) {
            this.flagCount += addedFlags;
            this.emitFlagsChange();
        }
    }

    revealAllSafeTilesIfAllBombsFlagged() {
        let correctFlags = 0;
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.tiles[r][c];
                if (tile.flagged && tile.isBomb) correctFlags++;
            }
        }

        if (correctFlags !== this.bombs || this.flagCount !== this.bombs) return;

        this.revealAllSafeTiles();
    }

    revealAllSafeTiles() {
        const center = { r: Math.floor(this.rows / 2), c: Math.floor(this.cols / 2) };
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.tiles[r][c];
                if (tile.isBomb || tile.revealed) continue;
                const dist = Math.abs(center.r - r) + Math.abs(center.c - c);
                const delayMs = Math.min(dist, 18) * 18;
                tile.reveal(true, delayMs);
                tile.setNumber(tile.neighbor);
            }
        }
    }

    flashTilesFrom(r, c) {
        for (let rr = 0; rr < this.rows; rr++) {
            for (let cc = 0; cc < this.cols; cc++) {
                const tile = this.tiles[rr][cc];
                const dist = Math.abs(r - rr) + Math.abs(c - cc);
                const delayMs = Math.min(dist, 20) * 18;
                tile.el.classList.remove('tile-flash');
                tile.el.style.setProperty('--flash-delay', `${delayMs}ms`);
                void tile.el.offsetWidth;
                tile.el.classList.add('tile-flash');
            }
        }
    }

    hasEmptyClusters() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.tiles[r][c];
                if (!tile.isBomb && tile.neighbor === 0 && !tile.revealed && !tile.flagged) return true;
            }
        }
        return false;
    }

    hasRevealTargets() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.tiles[r][c];
                if (!tile.isBomb && !tile.revealed && !tile.flagged) return true;
            }
        }
        return false;
    }

    hasFlagPulseTargets() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.tiles[r][c];
                if (tile.isBomb && !tile.flagged && !tile.revealed) return true;
            }
        }
        return false;
    }

    hasEchoTargets() {
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.tiles[r][c];
                if (!tile.revealed && !tile.flagged) return true;
            }
        }
        return false;
    }

    getEchoPreviewCells(r, c) {
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return null;
        const center = this.tiles[r][c];
        const valid = !center.revealed && !center.flagged;
        return {
            valid,
            cells: [
                { r, c },
                { r: r - 1, c },
                { r: r + 1, c },
                { r, c: c - 1 },
                { r, c: c + 1 }
            ].filter((pos) => pos.r >= 0 && pos.r < this.rows && pos.c >= 0 && pos.c < this.cols)
        };
    }

    flagRandomBomb() {
        if (this.locked) return 0;
        const bombs = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.tiles[r][c];
                if (tile.isBomb && !tile.flagged && !tile.revealed) {
                    bombs.push(tile);
                }
            }
        }

        if (bombs.length === 0) return 0;
        const target = bombs[Math.floor(Math.random() * bombs.length)];
        target.setFlagged(true);
        this.flagCount += 1;
        this.emitFlagsChange();
        this.checkWin();
        this.emitBoardChange();
        return 1;
    }

    pulseEchoCross(r, c) {
        if (this.locked) return false;
        if (r < 0 || r >= this.rows || c < 0 || c >= this.cols) return false;
        const center = this.tiles[r][c];
        if (center.revealed || center.flagged) return false;

        const coords = [
            { r, c },
            { r: r - 1, c },
            { r: r + 1, c },
            { r, c: c - 1 },
            { r, c: c + 1 }
        ];
        let bombCount = 0;
        coords.forEach((pos) => {
            if (pos.r < 0 || pos.r >= this.rows || pos.c < 0 || pos.c >= this.cols) return;
            if (this.tiles[pos.r][pos.c].isBomb) bombCount++;
        });
        const pulseClass = bombCount > 0 ? 'echo-pulse-red' : 'echo-pulse-green';
        coords.forEach((pos) => {
            if (pos.r < 0 || pos.r >= this.rows || pos.c < 0 || pos.c >= this.cols) return;
            const tile = this.tiles[pos.r][pos.c];
            tile.el.classList.remove('echo-pulse-red', 'echo-pulse-green');
            void tile.el.offsetWidth;
            tile.el.classList.add(pulseClass);
            setTimeout(() => tile.el.classList.remove(pulseClass), 600);
        });
        center.el.dataset.echoCount = String(bombCount);
        center.el.classList.add('echo-count');
        setTimeout(() => {
            center.el.classList.remove('echo-count');
            delete center.el.dataset.echoCount;
        }, 900);
        return true;
    }

    scanLargestCluster() {
        if (this.locked) return false;
        const visited = new Set();
        const bestClusters = [];
        let bestSize = 0;

        const getKey = (r, c) => `${r},${c}`;
        const dirs = [-1, 0, 1];

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.tiles[r][c];
                if (tile.isBomb || tile.neighbor !== 0 || tile.revealed || tile.flagged) continue;
                const startKey = getKey(r, c);
                if (visited.has(startKey)) continue;

                const queue = [{ r, c }];
                const cluster = [];
                visited.add(startKey);

                while (queue.length) {
                    const current = queue.shift();
                    cluster.push(current);

                    dirs.forEach((dr) => {
                        dirs.forEach((dc) => {
                            if (dr === 0 && dc === 0) return;
                            const rr = current.r + dr;
                            const cc = current.c + dc;
                            if (rr < 0 || rr >= this.rows || cc < 0 || cc >= this.cols) return;
                            const neighborTile = this.tiles[rr][cc];
                            if (neighborTile.isBomb || neighborTile.neighbor !== 0 || neighborTile.revealed || neighborTile.flagged) return;
                            const key = getKey(rr, cc);
                            if (visited.has(key)) return;
                            visited.add(key);
                            queue.push({ r: rr, c: cc });
                        });
                    });
                }

                if (cluster.length > bestSize) {
                    bestSize = cluster.length;
                    bestClusters.length = 0;
                    bestClusters.push(cluster);
                } else if (cluster.length === bestSize) {
                    bestClusters.push(cluster);
                }
            }
        }

        if (bestClusters.length === 0) return false;
        if (this.firstReveal) {
            this.firstReveal = false;
            if (this.eventBus) this.eventBus.emit('firstReveal');
        }

        const chosen = bestClusters[Math.floor(Math.random() * bestClusters.length)];
        const seed = chosen[0];
        this.revealAt(seed.r, seed.c, false, 0);
        return true;
    }

    revealHighestNumber() {
        if (this.locked) return false;
        let bestValue = -1;
        const candidates = [];

        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.tiles[r][c];
                if (tile.isBomb || tile.revealed || tile.flagged) continue;
                const value = tile.neighbor;
                if (value > bestValue) {
                    bestValue = value;
                    candidates.length = 0;
                    candidates.push({ r, c });
                } else if (value === bestValue) {
                    candidates.push({ r, c });
                }
            }
        }

        if (candidates.length === 0) return false;
        if (this.firstReveal) {
            this.firstReveal = false;
            if (this.eventBus) this.eventBus.emit('firstReveal');
        }

        const pick = candidates[Math.floor(Math.random() * candidates.length)];
        this.revealAt(pick.r, pick.c, false, 0);
        return true;
    }

    revealRandomSafeTile() {
        if (this.locked) return false;
        const safeTiles = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.tiles[r][c];
                if (tile.isBomb || tile.revealed || tile.flagged) continue;
                safeTiles.push({ r, c });
            }
        }
        if (safeTiles.length === 0) return false;
        const pick = safeTiles[Math.floor(Math.random() * safeTiles.length)];
        if (this.firstReveal) {
            this.firstReveal = false;
            if (this.eventBus) this.eventBus.emit('firstReveal');
        }
        this.revealAt(pick.r, pick.c, false, 0);
        return true;
    }

    highlightDangerTiles(count, durationMs = 1200) {
        if (this.locked) return;
        const candidates = [];
        for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
                const tile = this.tiles[r][c];
                if (tile.isBomb || tile.revealed || tile.flagged) continue;
                candidates.push({ r, c, danger: tile.neighbor });
            }
        }
        if (candidates.length === 0) return;
        candidates.sort((a, b) => {
            if (b.danger !== a.danger) return b.danger - a.danger;
            return Math.random() - 0.5;
        });
        candidates.slice(0, Math.max(1, count)).forEach((cell) => {
            const tile = this.tiles[cell.r][cell.c];
            tile.el.classList.add('danger-flash');
            setTimeout(() => tile.el.classList.remove('danger-flash'), durationMs);
        });
    }
}
