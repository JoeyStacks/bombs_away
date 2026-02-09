window.BombsAway = window.BombsAway || {};

window.BombsAway.ConfigModal = class ConfigModal {
    constructor({
        widthInput,
        heightInput,
        widthLabel,
        heightLabel,
        bombSlider,
        bombLabel,
        tilesLabel,
        livesSlider,
        livesLabel,
        scanSlider,
        scanLabel,
        revealSlider,
        revealLabel,
        flagSlider,
        flagLabel,
        shieldSlider,
        shieldLabel,
        echoSlider,
        echoLabel
    }) {
        this.widthInput = widthInput;
        this.heightInput = heightInput;
        this.widthLabel = widthLabel;
        this.heightLabel = heightLabel;
        this.bombSlider = bombSlider;
        this.bombLabel = bombLabel;
        this.tilesLabel = tilesLabel;
        this.livesSlider = livesSlider;
        this.livesLabel = livesLabel;
        this.scanSlider = scanSlider;
        this.scanLabel = scanLabel;
        this.revealSlider = revealSlider;
        this.revealLabel = revealLabel;
        this.flagSlider = flagSlider;
        this.flagLabel = flagLabel;
        this.shieldSlider = shieldSlider;
        this.shieldLabel = shieldLabel;
        this.echoSlider = echoSlider;
        this.echoLabel = echoLabel;
    }

    bind() {
        this.widthInput.oninput = () => this.sync();
        this.heightInput.oninput = () => this.sync();
        this.bombSlider.oninput = () => this.syncBombLabel();
        this.livesSlider.oninput = () => this.syncLivesLabel();
        this.scanSlider.oninput = () => this.syncScanLabel();
        this.revealSlider.oninput = () => this.syncRevealLabel();
        this.flagSlider.oninput = () => this.syncFlagLabel();
        this.shieldSlider.oninput = () => this.syncShieldLabel();
        this.echoSlider.oninput = () => this.syncEchoLabel();
    }

    clampInput(input) {
        const min = parseInt(input.min) || 1;
        const max = parseInt(input.max) || 99;
        let value = parseInt(input.value);
        if (Number.isNaN(value)) value = min;
        value = Math.min(Math.max(value, min), max);
        input.value = value;
        return value;
    }

    sync() {
        const width = this.clampInput(this.widthInput);
        const height = this.clampInput(this.heightInput);
        this.widthLabel.textContent = width;
        this.heightLabel.textContent = height;
        const maxBombs = width * height - 1;
        this.bombSlider.max = maxBombs;
        if (parseInt(this.bombSlider.value) > maxBombs) this.bombSlider.value = maxBombs;
        this.tilesLabel.textContent = width * height;
        this.syncBombLabel();
        this.syncLivesLabel();
        this.syncScanLabel();
        this.syncRevealLabel();
        this.syncFlagLabel();
        this.syncShieldLabel();
        this.syncEchoLabel();
    }

    syncBombLabel() {
        this.bombLabel.textContent = this.bombSlider.value;
    }

    syncLivesLabel() {
        this.livesLabel.textContent = this.livesSlider.value;
    }

    syncScanLabel() {
        this.scanLabel.textContent = this.scanSlider.value;
    }

    syncRevealLabel() {
        this.revealLabel.textContent = this.revealSlider.value;
    }

    syncFlagLabel() {
        this.flagLabel.textContent = this.flagSlider.value;
    }

    syncShieldLabel() {
        this.shieldLabel.textContent = this.shieldSlider.value;
    }

    syncEchoLabel() {
        this.echoLabel.textContent = this.echoSlider.value;
    }

    getConfig() {
        const width = this.clampInput(this.widthInput);
        const height = this.clampInput(this.heightInput);
        return {
            width,
            height,
            bombs: parseInt(this.bombSlider.value),
            lives: parseInt(this.livesSlider.value),
            scans: parseInt(this.scanSlider.value),
            reveals: parseInt(this.revealSlider.value),
            flags: parseInt(this.flagSlider.value),
            shields: parseInt(this.shieldSlider.value),
            echoes: parseInt(this.echoSlider.value)
        };
    }
};
