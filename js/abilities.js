window.BombsAway = window.BombsAway || {};

window.BombsAway.AbilityRegistry = {
    scan: {
        key: 'scans',
        canUse: (board) => board && board.hasEmptyClusters()
    },
    reveal: {
        key: 'reveals',
        canUse: (board) => board && board.hasRevealTargets()
    },
    flag: {
        key: 'flags',
        canUse: (board) => board && board.hasFlagPulseTargets()
    },
    shield: {
        key: 'shields',
        canUse: () => true
    },
    echo: {
        key: 'echoes',
        canUse: (board) => board && board.hasEchoTargets()
    }
};

window.BombsAway.AbilityManager = class AbilityManager {
    constructor({
        boardEl,
        boardWrapEl,
        scanBtn,
        scanCountEl,
        revealBtn,
        revealCountEl,
        flagBtn,
        flagCountEl,
        shieldBtn,
        shieldCountEl,
        echoBtn,
        echoCountEl,
        livesDisplay
    }) {
        this.boardEl = boardEl;
        this.boardWrapEl = boardWrapEl;
        this.scanBtn = scanBtn;
        this.scanCountEl = scanCountEl;
        this.revealBtn = revealBtn;
        this.revealCountEl = revealCountEl;
        this.flagBtn = flagBtn;
        this.flagCountEl = flagCountEl;
        this.shieldBtn = shieldBtn;
        this.shieldCountEl = shieldCountEl;
        this.echoBtn = echoBtn;
        this.echoCountEl = echoCountEl;
        this.livesDisplay = livesDisplay;

        this.board = null;
        this.abilitiesLocked = false;
        this.echoArmed = false;
        this.echoPreviewKeys = new Set();
        this.shieldActive = 0;
        this.counts = {
            scans: 0,
            reveals: 0,
            flags: 0,
            shields: 0,
            echoes: 0
        };
        this.registry = window.BombsAway.AbilityRegistry;
        this.upgrades = {
            scan: 0
        };

        this.bind();
    }

    bind() {
        this.scanBtn.onclick = () => this.useScan();
        this.revealBtn.onclick = () => this.useReveal();
        this.flagBtn.onclick = () => this.useFlagPulse();
        this.shieldBtn.onclick = () => this.useShield();
        this.echoBtn.onclick = () => this.toggleEcho();

        this.boardEl.addEventListener('click', (e) => {
            if (this.abilitiesLocked || !this.echoArmed || !this.board) return;
            const cell = e.target.closest('.cell');
            if (!cell) return;
            e.preventDefault();
            e.stopImmediatePropagation();
            const r = parseInt(cell.dataset.r);
            const c = parseInt(cell.dataset.c);
            const pulsed = this.board.pulseEchoCross(r, c);
            if (!pulsed) return;
            this.counts.echoes -= 1;
            this.echoArmed = false;
            this.renderEcho();
            this.triggerScanSweep();
        }, true);

        this.boardEl.addEventListener('mousemove', (e) => {
            if (this.abilitiesLocked || !this.echoArmed || !this.board) return;
            const cell = e.target.closest('.cell');
            if (!cell) return;
            const r = parseInt(cell.dataset.r);
            const c = parseInt(cell.dataset.c);
            this.previewEchoCross(r, c);
        });

        this.boardEl.addEventListener('mouseleave', () => {
            if (!this.echoArmed) return;
            this.clearEchoPreview();
        });
    }

    init(board, counts, options = {}) {
        this.board = board;
        this.counts = { ...counts };
        this.shieldActive = options.shieldActive || 0;
        this.upgrades = { scan: options.scanUpgrade || 0 };
        this.echoArmed = false;
        this.abilitiesLocked = false;
        this.clearEchoPreview();
        this.livesDisplay.setShieldActive(this.shieldActive);
        this.renderAll();
    }

    lock(locked) {
        this.abilitiesLocked = locked;
        if (locked) {
            this.echoArmed = false;
            this.clearEchoPreview();
        }
        this.renderAll();
    }

    onBoardChange() {
        this.renderScans();
        this.renderReveals();
        this.renderFlagPulse();
        this.renderEcho();
    }

    setShieldActive(count) {
        this.shieldActive = count;
        this.livesDisplay.setShieldActive(count);
        this.renderShield();
    }

    useScan() {
        if (this.abilitiesLocked || !this.board || this.counts.scans <= 0) return;
        let revealedAny = false;
        const clusters = 1 + (this.upgrades.scan || 0);
        for (let i = 0; i < clusters; i++) {
            const revealed = this.board.scanLargestCluster();
            if (!revealed) break;
            revealedAny = true;
        }
        if (!revealedAny) return;
        this.counts.scans -= 1;
        this.renderScans();
        this.triggerScanSweep();
    }

    useReveal() {
        if (this.abilitiesLocked || !this.board || this.counts.reveals <= 0) return;
        const revealed = this.board.revealHighestNumber();
        if (!revealed) return;
        this.counts.reveals -= 1;
        this.renderReveals();
        this.triggerScanSweep();
    }

    useFlagPulse() {
        if (this.abilitiesLocked || !this.board || this.counts.flags <= 0) return;
        const flagged = this.board.flagRandomBomb();
        if (flagged <= 0) return;
        this.counts.flags -= 1;
        this.renderFlagPulse();
        this.triggerScanSweep();
    }

    useShield() {
        if (this.abilitiesLocked || !this.board || this.counts.shields <= 0) return;
        this.counts.shields -= 1;
        this.shieldActive += 1;
        this.board.setShields(this.shieldActive);
        this.livesDisplay.setShieldActive(this.shieldActive);
        this.renderShield();
    }

    toggleEcho() {
        if (this.abilitiesLocked || !this.board || this.counts.echoes <= 0) return;
        if (!this.board.hasEchoTargets()) return;
        this.echoArmed = !this.echoArmed;
        if (!this.echoArmed) this.clearEchoPreview();
        this.renderEcho();
    }

    getCounts() {
        return { ...this.counts };
    }

    getShieldActive() {
        return this.shieldActive;
    }

    getUpgrades() {
        return { ...this.upgrades };
    }

    addCharges(type, amount) {
        if (!this.counts[type]) this.counts[type] = 0;
        this.counts[type] += amount;
        this.renderAll();
    }

    upgradeScan(levels = 1) {
        this.upgrades.scan += levels;
    }

    triggerScanSweep() {
        this.boardWrapEl.classList.remove('scan-sweep');
        void this.boardWrapEl.offsetWidth;
        this.boardWrapEl.classList.add('scan-sweep');
        setTimeout(() => this.boardWrapEl.classList.remove('scan-sweep'), 900);
    }

    renderAll() {
        this.renderScans();
        this.renderReveals();
        this.renderFlagPulse();
        this.renderShield();
        this.renderEcho();
    }

    renderScans() {
        this.scanCountEl.textContent = this.counts.scans;
        const canUse = this.registry.scan.canUse(this.board);
        this.scanBtn.disabled = this.abilitiesLocked || this.counts.scans <= 0 || !canUse;
    }

    renderReveals() {
        this.revealCountEl.textContent = this.counts.reveals;
        const canUse = this.registry.reveal.canUse(this.board);
        this.revealBtn.disabled = this.abilitiesLocked || this.counts.reveals <= 0 || !canUse;
    }

    renderFlagPulse() {
        this.flagCountEl.textContent = this.counts.flags;
        const canUse = this.registry.flag.canUse(this.board);
        this.flagBtn.disabled = this.abilitiesLocked || this.counts.flags <= 0 || !canUse;
    }

    renderShield() {
        this.shieldCountEl.textContent = this.counts.shields;
        const canUse = this.registry.shield.canUse(this.board);
        this.shieldBtn.disabled = this.abilitiesLocked || this.counts.shields <= 0 || !canUse;
        if (this.shieldActive > 0) this.shieldBtn.classList.add('armed');
        else this.shieldBtn.classList.remove('armed');
    }

    renderEcho() {
        this.echoCountEl.textContent = this.counts.echoes;
        const canUse = this.registry.echo.canUse(this.board);
        if (!canUse || this.counts.echoes <= 0) this.echoArmed = false;
        if (!this.echoArmed) this.clearEchoPreview();
        this.echoBtn.disabled = this.abilitiesLocked || this.counts.echoes <= 0 || !canUse;
        if (this.echoArmed) this.echoBtn.classList.add('armed');
        else this.echoBtn.classList.remove('armed');
    }

    clearEchoPreview() {
        this.echoPreviewKeys.forEach((key) => {
            const [r, c] = key.split(',').map(Number);
            const selector = `.cell[data-r="${r}"][data-c="${c}"]`;
            const target = this.boardEl.querySelector(selector);
            if (target) target.classList.remove('echo-target', 'echo-target-invalid');
        });
        this.echoPreviewKeys.clear();
    }

    previewEchoCross(r, c) {
        if (!this.board) return;
        const data = this.board.getEchoPreviewCells(r, c);
        if (!data) return;
        const className = data.valid ? 'echo-target' : 'echo-target-invalid';
        const nextKeys = new Set();

        data.cells.forEach((pos) => {
            const selector = `.cell[data-r="${pos.r}"][data-c="${pos.c}"]`;
            const target = this.boardEl.querySelector(selector);
            if (!target) return;
            const key = `${pos.r},${pos.c}`;
            nextKeys.add(key);
            if (!this.echoPreviewKeys.has(key)) {
                target.classList.add(className);
            } else if (!target.classList.contains(className)) {
                target.classList.remove('echo-target', 'echo-target-invalid');
                target.classList.add(className);
            }
        });

        this.echoPreviewKeys.forEach((key) => {
            if (nextKeys.has(key)) return;
            const [row, col] = key.split(',').map(Number);
            const selector = `.cell[data-r="${row}"][data-c="${col}"]`;
            const target = this.boardEl.querySelector(selector);
            if (target) target.classList.remove('echo-target', 'echo-target-invalid');
        });
        this.echoPreviewKeys = nextKeys;
    }
};
