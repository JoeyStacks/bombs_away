const dom = window.BombsAway.dom;
const {
    titleScreen,
    gameScreen,
    boardEl,
    boardWrapEl,
    timerEl,
    flagsEl,
    statsEl,
    hudEl,
    hudToggle,
    statusEl,
    statusMessageEl,
    waveContinueBtn,
    waveTransitionEl,
    shopScreen,
    shopContinueBtn,
    livesEl,
    startBtn,
    restartBtn,
    menuBtn,
    classicBtn,
    customBtn,
    adventureBtn,
    statsBtn,
    itemsBtn,
    modalEl,
    statsModalEl,
    itemsModalEl,
    adventureModalEl,
    adventureRestartModalEl,
    modalBackdrop,
    closeModalBtn,
    closeStatsBtn,
    closeItemsBtn,
    closeAdventureBtn,
    closeRestartBtn,
    adventureStartBtn,
    restartConfirmBtn,
    restartCancelBtn,
    statsBody,
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
    echoLabel,
    scanBtn,
    scanCountEl,
    flagModeBtn,
    revealBtn,
    revealCountEl,
    flagBtn,
    flagCountEl,
    shieldBtn,
    shieldCountEl,
    echoBtn,
    echoCountEl,
    waveCountEl,
    scrapCountEl,
    runModsEl,
    explosionSound,
    popSound,
    shopScrap,
    shopRerollBtn,
    shopRerollCount,
    shopWares,
    shopModsList,
    itemsList,
    itemsFilterAll,
    itemsFilterShop
} = dom;

class Game {
    constructor() {
        this.board = null;
        this.timer = null;
        this.seconds = 0;
        this.timeRunning = false;
        this.stats = this.loadStats();
        this.configStats = this.loadConfigStats();
        this.statusTimeout = null;
        this.currentConfigKey = null;
        this.eventBus = new window.BombsAway.EventBus();
        this.runMode = 'standard';
        this.adventureState = null;
        this.pendingWaveAdvance = null;
        this.lastStandardConfig = null;
        this.shopInterval = 1;
        this.shopPurchases = new Set();
        this.scrapReward = 5;
        this.shopDisplayCount = 6;
        this.itemsCatalog = this.buildItemsCatalog();
        this.shopItemPool = this.itemsCatalog.filter((item) => item.shop);
        this.itemsFilterMode = 'all';
        window.addEventListener('resize', () => {
            if (this.board) this.board.resize();
        });

        this.configModal = new window.BombsAway.ConfigModal({
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
        });
        this.livesDisplay = new window.BombsAway.LivesDisplay(livesEl);
        this.abilityManager = new window.BombsAway.AbilityManager({
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
            livesDisplay: this.livesDisplay
        });

        this.bindUI();
        this.bindEvents();
        this.configModal.bind();
        this.configModal.sync();
        this.updateStatsDisplay();
        this.updateStatsButtonState();
        this.renderItemsCatalog();
    }

    bindUI() {
        startBtn.onclick = () => {
            this.closeAllModals();
            this.startGame();
        };
        restartBtn.onclick = () => this.handleRestartClick();
        menuBtn.onclick = () => this.showMenu();
        classicBtn.onclick = () => this.startClassic();
        customBtn.onclick = () => this.openConfigModal();
        adventureBtn.onclick = () => this.openAdventureModal();
        statsBtn.onclick = () => this.openStatsModal();
        itemsBtn.onclick = () => this.openItemsModal();
        closeModalBtn.onclick = () => this.closeAllModals();
        closeStatsBtn.onclick = () => this.closeAllModals();
        closeItemsBtn.onclick = () => this.closeAllModals();
        closeAdventureBtn.onclick = () => this.closeAllModals();
        closeRestartBtn.onclick = () => this.closeAllModals();
        modalBackdrop.onclick = () => this.closeAllModals();
        adventureStartBtn.onclick = () => this.startAdventure();
        restartConfirmBtn.onclick = () => this.restartAdventureRun();
        restartCancelBtn.onclick = () => this.closeAllModals();
        this.bindClassSelection();
        waveContinueBtn.onclick = () => this.advanceAdventureWave();
        shopContinueBtn.onclick = () => this.closeShopAndStartNextWave();
        shopRerollBtn.onclick = () => this.buyShopReroll();
        if (hudToggle) {
            hudToggle.onclick = () => this.toggleHud();
        }
        if (flagModeBtn) {
            flagModeBtn.onclick = () => this.toggleFlagMode();
        }
        if (itemsFilterAll && itemsFilterShop) {
            itemsFilterAll.onclick = () => this.setItemsFilter('all');
            itemsFilterShop.onclick = () => this.setItemsFilter('shop');
        }
        if (shopWares) {
            shopWares.addEventListener('click', (event) => {
                const button = event.target.closest('.shop-item');
                if (button && shopWares.contains(button)) {
                    this.handleShopItemClick(button);
                }
            });
        }

        document.addEventListener('contextmenu', (e) => {
            if (e.target.closest('#board')) e.preventDefault();
        });
    }

    bindClassSelection() {
        const cards = Array.from(adventureModalEl.querySelectorAll('.class-card'));
        cards.forEach((card) => {
            card.onclick = () => {
                cards.forEach((item) => {
                    item.classList.remove('selected');
                    item.setAttribute('aria-selected', 'false');
                });
                card.classList.add('selected');
                card.setAttribute('aria-selected', 'true');
            };
        });
    }

    bindEvents() {
        this.eventBus.on('firstReveal', () => this.startTimer());
        this.eventBus.on('flagsChange', ({ flags, total }) => this.updateFlags(flags, total));
        this.eventBus.on('livesChange', ({ left }) => {
            this.livesDisplay.updateLivesLeft(left);
            if (this.adventureState) this.adventureState.livesLeft = left;
        });
        this.eventBus.on('shieldChange', ({ left }) => {
            this.abilityManager.setShieldActive(left);
            if (this.adventureState) this.adventureState.shieldActive = left;
        });
        this.eventBus.on('defuseChange', ({ left }) => {
            if (this.adventureState) this.adventureState.defuseKits = left;
            this.updateRunModsDisplay();
        });
        this.eventBus.on('boardChange', () => this.abilityManager.onBoardChange());
        this.eventBus.on('win', ({ scraped }) => this.handleEnd(true, scraped));
        this.eventBus.on('loss', () => this.handleEnd(false));
    }

    resetTimer() {
        clearInterval(this.timer);
        this.timer = null;
        this.seconds = 0;
        this.timeRunning = false;
        timerEl.textContent = '00:00';
    }

    startTimer() {
        if (this.timeRunning) return;
        this.timeRunning = true;
        this.timer = setInterval(() => {
            this.seconds++;
            timerEl.textContent = new Date(this.seconds * 1000).toISOString().substr(14, 5);
        }, 1000);
    }

    formatTime(totalSeconds) {
        if (typeof totalSeconds !== 'number') return '--:--';
        return new Date(totalSeconds * 1000).toISOString().substr(14, 5);
    }

    startGame(configOverride = null) {
        this.runMode = 'standard';
        this.adventureState = null;
        this.pendingWaveAdvance = null;
        this.updateWaveDisplay();
        this.updateScrapDisplay();
        this.updateRunModsDisplay();
        waveTransitionEl.classList.add('hidden');
        this.setGameplayVisibility(true);
        const baseConfig = this.configModal.getConfig();
        const resolved = configOverride ? { ...baseConfig, ...configOverride } : baseConfig;
        this.lastStandardConfig = { ...resolved };
        this.startRun(resolved);
    }

    startRun(config) {
        this.resetTimer();
        statusEl.classList.add('hidden');
        if (this.statusTimeout) clearTimeout(this.statusTimeout);

        titleScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');

        this.currentConfigKey = this.getConfigKey(config.width, config.height, config.bombs);

        this.livesDisplay.setLives(config.lives, config.livesLeft ?? config.lives);
        this.livesDisplay.setShieldActive(config.shieldActive ?? 0);
        if (flagModeBtn) {
            flagModeBtn.classList.remove('active');
            flagModeBtn.setAttribute('aria-pressed', 'false');
        }

        this.board = new Board({
            width: config.width,
            height: config.height,
            bombs: config.bombs,
            lives: config.livesLeft ?? config.lives,
            shields: config.shieldActive ?? 0,
            defuseKits: config.defuseKits ?? 0,
            boardEl,
            explosionSound,
            popSound,
            eventBus: this.eventBus
        });

        this.abilityManager.init(this.board, {
            scans: config.scans,
            reveals: config.reveals,
            flags: config.flags,
            shields: config.shields,
            echoes: config.echoes
        }, { shieldActive: config.shieldActive ?? 0, scanUpgrade: config.upgrades?.scan ?? 0 });
        if (flagModeBtn) this.board.setFlagMode(flagModeBtn.classList.contains('active'));
    }

    startClassic() {
        this.closeAllModals();
        const classicConfig = {
            width: 10,
            height: 10,
            bombs: 10,
            lives: 1,
            scans: 1,
            reveals: 1,
            flags: 1,
            shields: 1,
            echoes: 1
        };
        this.lastStandardConfig = { ...classicConfig };
        this.startGame(classicConfig);
    }

    openAdventureModal() {
        this.closeAllModals();
        adventureModalEl.classList.remove('hidden');
        modalBackdrop.classList.remove('hidden');
    }

    handleRestartClick() {
        if (this.runMode === 'adventure') {
            if (this.adventureState && this.adventureState.livesLeft > 0) {
                this.openAdventureRestartModal();
            } else {
                this.restartAdventureRun();
            }
        } else {
            if (this.lastStandardConfig) {
                this.startGame(this.lastStandardConfig);
            } else {
                this.startGame();
            }
        }
    }

    buildAdventureState(classKey) {
        return {
            classKey,
            wave: 1,
            wavesTotal: 10,
            width: 9,
            height: 9,
            baseBombs: 10,
            bombsStep: 2,
            livesTotal: 3,
            livesLeft: 3,
            shieldActive: 0,
            abilityCounts: { ...this.getAdventureClassConfig(classKey) },
            upgrades: { scan: 0 },
            scrap: 10,
            rerolls: 0,
            scrapBonus: 0,
            scoutReveals: 0,
            bombSenseLevel: 0,
            overclockNext: false,
            overclockActive: false,
            defuseKits: 0
        };
    }

    startAdventure() {
        const selected = adventureModalEl.querySelector('.class-card.selected');
        const classKey = selected ? selected.dataset.class : 'investigator';

        this.runMode = 'adventure';
        this.adventureState = this.buildAdventureState(classKey);

        this.closeAllModals();
        this.startAdventureWave();
    }

    openAdventureRestartModal() {
        this.closeAllModals();
        adventureRestartModalEl.classList.remove('hidden');
        modalBackdrop.classList.remove('hidden');
    }

    restartAdventureRun() {
        if (!this.adventureState) return;
        this.runMode = 'adventure';
        this.adventureState = this.buildAdventureState(this.adventureState.classKey);
        this.closeAllModals();
        this.startAdventureWave();
    }

    getAdventureClassConfig(classKey) {
        if (classKey === 'knight') {
            return { scans: 0, reveals: 0, flags: 0, shields: 3, echoes: 0 };
        }
        return { scans: 3, reveals: 0, flags: 0, shields: 0, echoes: 0 };
    }

    startAdventureWave() {
        if (!this.adventureState) return;
        const wave = this.adventureState.wave;
        const bombs = this.getAdventureBombsForWave(wave);
        this.updateWaveDisplay();
        this.updateScrapDisplay();
        this.updateRunModsDisplay();
        this.adventureState.overclockActive = this.adventureState.overclockNext;
        this.adventureState.overclockNext = false;
        this.startRun({
            width: this.adventureState.width,
            height: this.adventureState.height,
            bombs: bombs + (this.adventureState.overclockActive ? 2 : 0),
            lives: this.adventureState.livesTotal,
            livesLeft: this.adventureState.livesLeft,
            shieldActive: this.adventureState.shieldActive,
            scans: this.adventureState.abilityCounts.scans,
            reveals: this.adventureState.abilityCounts.reveals,
            flags: this.adventureState.abilityCounts.flags,
            shields: this.adventureState.abilityCounts.shields,
            echoes: this.adventureState.abilityCounts.echoes,
            upgrades: this.adventureState.upgrades,
            defuseKits: this.adventureState.defuseKits
        });
        this.applyAdventureWaveStartEffects();
    }

    getAdventureBombsForWave(wave) {
        const tiles = this.adventureState.width * this.adventureState.height;
        return Math.min(this.adventureState.baseBombs + (wave - 1) * this.adventureState.bombsStep, tiles - 1);
    }

    showWaveTransition(nextWave, bombs) {
        titleScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        waveTransitionEl.innerHTML = `
            <div class="wave-card">
                <div class="wave-title">Wave ${nextWave}</div>
                <div class="wave-bombs"><span class="wave-bomb-count">0</span> Bombs</div>
            </div>
        `;
        waveTransitionEl.classList.remove('hidden');
        this.setGameplayVisibility(false);
        this.abilityManager.lock(true);
        const countEl = waveTransitionEl.querySelector('.wave-bomb-count');
        this.centerWaveCard();
        this.animateCount(countEl, bombs, 900);
        setTimeout(() => {
            waveTransitionEl.classList.add('hidden');
            this.setGameplayVisibility(true);
            this.startAdventureWave();
        }, 1500);
    }

    showShopTransition() {
        titleScreen.classList.add('hidden');
        gameScreen.classList.remove('hidden');
        waveTransitionEl.innerHTML = `
            <div class="wave-card">
                <div class="wave-title">Shop</div>
                <div class="wave-bombs">Supplies Restocked</div>
            </div>
        `;
        waveTransitionEl.classList.remove('hidden');
        this.setGameplayVisibility(false);
        this.abilityManager.lock(true);
        this.centerWaveCard();
        setTimeout(() => {
            waveTransitionEl.classList.add('hidden');
            this.openShop();
        }, 1200);
    }

    updateWaveDisplay() {
        if (this.runMode === 'adventure' && this.adventureState) {
            waveCountEl.textContent = `Wave: ${this.adventureState.wave}/${this.adventureState.wavesTotal}`;
        } else {
            waveCountEl.textContent = 'Wave: --';
        }
    }

    updateScrapDisplay() {
        const shopScrapValue = shopScrap ? shopScrap.querySelector('.shop-scrap-value') : null;
        if (this.runMode === 'adventure' && this.adventureState) {
            scrapCountEl.textContent = `Scrap: ${this.adventureState.scrap}`;
            if (shopScrapValue) {
                shopScrapValue.textContent = `${this.adventureState.scrap}`;
            } else if (shopScrap) {
                shopScrap.textContent = `Scrap: ${this.adventureState.scrap}`;
            }
            if (shopRerollCount) {
                shopRerollCount.textContent = `${this.adventureState.rerolls}`;
            }
        } else {
            scrapCountEl.textContent = 'Scrap: 0';
            if (shopScrapValue) {
                shopScrapValue.textContent = '0';
            } else if (shopScrap) {
                shopScrap.textContent = 'Scrap: 0';
            }
            if (shopRerollCount) {
                shopRerollCount.textContent = '0';
            }
        }
    }

    toggleHud() {
        if (!hudEl || !hudToggle) return;
        hudEl.classList.toggle('hud-collapsed');
        const expanded = !hudEl.classList.contains('hud-collapsed');
        hudToggle.setAttribute('aria-expanded', String(expanded));
        hudToggle.textContent = expanded ? 'HUD' : 'HUD +';
    }

    toggleFlagMode() {
        if (!flagModeBtn) return;
        const active = !flagModeBtn.classList.contains('active');
        flagModeBtn.classList.toggle('active', active);
        flagModeBtn.setAttribute('aria-pressed', String(active));
        if (this.board) this.board.setFlagMode(active);
    }

    updateRunModsDisplay() {
        if (!runModsEl || !shopModsList) return;
        if (this.runMode !== 'adventure' || !this.adventureState) {
            runModsEl.innerHTML = '';
            shopModsList.innerHTML = '';
            return;
        }
        const mods = [];
        if (this.adventureState.scrapBonus > 0) {
            mods.push({ label: 'Scrap+', value: this.adventureState.scrapBonus });
        }
        if (this.adventureState.scoutReveals > 0) {
            mods.push({ label: 'Scout', value: this.adventureState.scoutReveals });
        }
        if (this.adventureState.bombSenseLevel > 0) {
            mods.push({ label: 'Sense', value: this.adventureState.bombSenseLevel });
        }
        if (this.adventureState.defuseKits > 0) {
            mods.push({ label: 'Defuse', value: this.adventureState.defuseKits });
        }
        if (this.adventureState.overclockNext) {
            mods.push({ label: 'Overclock', value: 'Next' });
        } else if (this.adventureState.overclockActive) {
            mods.push({ label: 'Overclock', value: 'Live' });
        }
        runModsEl.innerHTML = mods.map((mod) => this.renderModBadge(mod)).join('');
        shopModsList.innerHTML = mods.map((mod) => this.renderModBadge(mod)).join('');
    }

    renderModBadge(mod) {
        return `
            <span class="mod-badge">
                ${mod.label}
                <span class="mod-count">${mod.value}</span>
            </span>
        `;
    }

    setGameplayVisibility(visible) {
        if (visible) {
            hudEl.classList.remove('hidden');
            boardWrapEl.classList.remove('hidden');
        } else {
            hudEl.classList.add('hidden');
            boardWrapEl.classList.add('hidden');
        }
    }

    animateCount(el, target, duration) {
        if (!el) return;
        const start = performance.now();
        const total = Math.max(0, target);
        const tick = (now) => {
            const progress = Math.min((now - start) / duration, 1);
            const value = Math.floor(progress * total);
            el.textContent = value;
            if (progress < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    }

    centerWaveCard() {
        const card = waveTransitionEl.querySelector('.wave-card');
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const top = Math.max((window.innerHeight - rect.height) / 2 - 100, 0);
        const left = Math.max((window.innerWidth - rect.width) / 2, 0);
        card.style.top = `${top}px`;
        card.style.left = `${left}px`;
        card.style.transform = 'none';
    }

    centerStatusOverlay() {
        statusEl.style.position = 'fixed';
        statusEl.style.left = '50%';
        statusEl.style.top = '17.5vh';
        statusEl.style.transform = 'translateX(-50%)';
        statusEl.style.translate = '0 0';
        statusEl.style.animation = 'none';
    }

    resetStatusOverlay() {
        statusEl.style.position = '';
        statusEl.style.left = '';
        statusEl.style.top = '';
        statusEl.style.transform = '';
        statusEl.style.translate = '';
        statusEl.style.animation = '';
    }


    updateFlags(flags, total) {
        flagsEl.textContent = `Flags: ${flags}/${total}`;
    }

    handleEnd(won, scraped = false) {
        clearInterval(this.timer);
        this.timeRunning = false;
        waveContinueBtn.classList.add('hidden');
        if (this.runMode === 'adventure' && this.adventureState) {
            if (won) {
                if (this.adventureState.wave < this.adventureState.wavesTotal) {
                    this.adventureState.abilityCounts = this.abilityManager.getCounts();
                    this.adventureState.shieldActive = this.abilityManager.getShieldActive();
                    this.adventureState.upgrades = this.abilityManager.getUpgrades();
                    const baseReward = this.scrapReward + this.adventureState.scrapBonus;
                    const earned = this.adventureState.overclockActive ? baseReward * 2 : baseReward;
                    this.adventureState.scrap += earned;
                    this.adventureState.overclockActive = false;
                    this.adventureState.wave += 1;
                    this.updateRunModsDisplay();
                    statusMessageEl.textContent = 'Cleared!';
                    statusEl.classList.remove('hidden');
                    requestAnimationFrame(() => {
                        requestAnimationFrame(() => this.centerStatusOverlay());
                    });
                    waveContinueBtn.classList.remove('hidden');
                    this.pendingWaveAdvance = {
                        wave: this.adventureState.wave,
                        bombs: this.getAdventureBombsForWave(this.adventureState.wave)
                    };
                    this.abilityManager.lock(true);
                    return;
                }
                statusMessageEl.textContent = 'Run Complete!';
            } else {
                statusMessageEl.textContent = 'Run Failed.';
            }
        } else if (won) {
            statusMessageEl.textContent = scraped ? 'You Win - By a thread.' : 'You Win!';
        } else {
            statusMessageEl.textContent = 'Game Over - You hit a bomb.';
        }
        statusEl.classList.remove('hidden');
        requestAnimationFrame(() => {
            requestAnimationFrame(() => this.centerStatusOverlay());
        });
        if (this.statusTimeout) clearTimeout(this.statusTimeout);
        this.statusTimeout = setTimeout(() => {
            statusEl.classList.add('hidden');
            waveContinueBtn.classList.add('hidden');
            this.resetStatusOverlay();
        }, 3000);
        this.abilityManager.lock(true);
        if (this.runMode === 'standard') {
            this.updateStats(won);
            this.updateConfigStats(won);
        }
    }

    advanceAdventureWave() {
        if (!this.pendingWaveAdvance) return;
        const { wave } = this.pendingWaveAdvance;
        this.pendingWaveAdvance = null;
        statusEl.classList.add('hidden');
        waveContinueBtn.classList.add('hidden');
        this.showShopTransition();
    }

    openShop() {
        this.shopPurchases.clear();
        shopScreen.classList.remove('hidden');
        this.setGameplayVisibility(false);
        this.abilityManager.lock(true);
        this.updateScrapDisplay();
        this.updateRunModsDisplay();
        this.renderShopWares();
        this.updateShopButtons();
    }

    closeShopAndStartNextWave() {
        shopScreen.classList.add('hidden');
        this.setGameplayVisibility(true);
        if (this.adventureState) {
            this.adventureState.abilityCounts = this.abilityManager.getCounts();
            this.adventureState.upgrades = this.abilityManager.getUpgrades();
            this.adventureState.shieldActive = this.abilityManager.getShieldActive();
        }
        this.startAdventureWave();
    }

    buyShopReroll() {
        if (!this.spendScrapFor(shopRerollBtn)) return;
        if (this.adventureState) this.adventureState.rerolls += 1;
        this.shopPurchases.clear();
        this.renderShopWares();
        this.updateShopButtons();
        this.updateScrapDisplay();
    }

    getButtonCost(button) {
        if (!button) return 0;
        return parseInt(button.dataset.cost) || 0;
    }

    spendScrapFor(button) {
        const cost = this.getButtonCost(button);
        if (!this.adventureState || this.adventureState.scrap < cost) return false;
        this.adventureState.scrap -= cost;
        this.updateScrapDisplay();
        return true;
    }

    updateShopButtons() {
        const scrap = this.adventureState ? this.adventureState.scrap : 0;
        if (shopWares) {
            shopWares.querySelectorAll('.shop-item').forEach((btn) => {
                const cost = this.getButtonCost(btn);
                const key = btn.dataset.key || '';
                btn.disabled = this.shopPurchases.has(key) || scrap < cost;
            });
        }
        const rerollCost = this.getButtonCost(shopRerollBtn);
        shopRerollBtn.disabled = scrap < rerollCost;
    }

    handleShopItemClick(button) {
        if (!button) return;
        const key = button.dataset.key || '';
        if (this.shopPurchases.has(key)) return;
        if (!this.spendScrapFor(button)) return;
        const type = button.dataset.type;
        const amount = parseInt(button.dataset.amount) || 1;
        if (type === 'charge') {
            const ability = button.dataset.ability;
            if (ability) this.abilityManager.addCharges(ability, amount);
        } else if (type === 'upgrade') {
            const upgrade = button.dataset.upgrade;
            if (upgrade === 'scan') {
                this.abilityManager.upgradeScan(amount);
            }
        } else if (type === 'perk' && this.adventureState) {
            const perk = button.dataset.perk;
            if (perk === 'scrap') {
                this.adventureState.scrapBonus += amount;
            } else if (perk === 'scout') {
                this.adventureState.scoutReveals += amount;
            } else if (perk === 'sense') {
                this.adventureState.bombSenseLevel += amount;
            } else if (perk === 'overclock') {
                this.adventureState.overclockNext = true;
            } else if (perk === 'defuse') {
                this.adventureState.defuseKits += amount;
            }
        }
        this.shopPurchases.add(key);
        button.disabled = true;
        this.updateRunModsDisplay();
        this.updateShopButtons();
    }

    buildItemsCatalog() {
        return [
            {
                key: 'charge:scans:1',
                type: 'charge',
                ability: 'scans',
                amount: 1,
                title: '+1 Scan',
                desc: 'Add a scan charge.',
                cost: 3,
                rarity: 'common',
                icon: 'scans',
                shop: true
            },
            {
                key: 'charge:reveals:1',
                type: 'charge',
                ability: 'reveals',
                amount: 1,
                title: '+1 Reveal',
                desc: 'Add a reveal charge.',
                cost: 3,
                rarity: 'common',
                icon: 'reveals',
                shop: true
            },
            {
                key: 'charge:flags:1',
                type: 'charge',
                ability: 'flags',
                amount: 1,
                title: '+1 Flag',
                desc: 'Add a flag pulse.',
                cost: 3,
                rarity: 'common',
                icon: 'flags',
                shop: true
            },
            {
                key: 'charge:shields:1',
                type: 'charge',
                ability: 'shields',
                amount: 1,
                title: '+1 Shield',
                desc: 'Add a shield charge.',
                cost: 3,
                rarity: 'common',
                icon: 'shields',
                shop: true
            },
            {
                key: 'charge:echoes:1',
                type: 'charge',
                ability: 'echoes',
                amount: 1,
                title: '+1 Echo',
                desc: 'Add an echo charge.',
                cost: 3,
                rarity: 'common',
                icon: 'echoes',
                shop: true
            },
            {
                key: 'charge:scans:2',
                type: 'charge',
                ability: 'scans',
                amount: 2,
                title: '+2 Scan',
                desc: 'Add two scan charges.',
                cost: 5,
                rarity: 'rare',
                icon: 'scans',
                shop: true
            },
            {
                key: 'charge:reveals:2',
                type: 'charge',
                ability: 'reveals',
                amount: 2,
                title: '+2 Reveal',
                desc: 'Add two reveal charges.',
                cost: 5,
                rarity: 'rare',
                icon: 'reveals',
                shop: true
            },
            {
                key: 'charge:flags:2',
                type: 'charge',
                ability: 'flags',
                amount: 2,
                title: '+2 Flag',
                desc: 'Add two flag pulses.',
                cost: 5,
                rarity: 'rare',
                icon: 'flags',
                shop: true
            },
            {
                key: 'charge:shields:2',
                type: 'charge',
                ability: 'shields',
                amount: 2,
                title: '+2 Shield',
                desc: 'Add two shield charges.',
                cost: 5,
                rarity: 'rare',
                icon: 'shields',
                shop: true
            },
            {
                key: 'charge:echoes:2',
                type: 'charge',
                ability: 'echoes',
                amount: 2,
                title: '+2 Echo',
                desc: 'Add two echo charges.',
                cost: 5,
                rarity: 'rare',
                icon: 'echoes',
                shop: true
            },
            {
                key: 'upgrade:scan:1',
                type: 'upgrade',
                upgrade: 'scan',
                amount: 1,
                title: 'Scan Upgrade',
                desc: 'Each scan reveals +1 extra cluster.',
                cost: 5,
                rarity: 'rare',
                icon: 'upgrade',
                shop: true
            },
            {
                key: 'upgrade:scan:2',
                type: 'upgrade',
                upgrade: 'scan',
                amount: 2,
                title: 'Scan Upgrade II',
                desc: 'Each scan reveals +2 extra clusters.',
                cost: 8,
                rarity: 'epic',
                icon: 'upgrade',
                shop: true
            },
            {
                key: 'perk:scrap:2',
                type: 'perk',
                perk: 'scrap',
                amount: 2,
                title: 'Scrap Magnet',
                desc: '+2 scrap on every cleared wave.',
                cost: 6,
                rarity: 'rare',
                icon: 'scrap',
                shop: true
            },
            {
                key: 'perk:scout:1',
                type: 'perk',
                perk: 'scout',
                amount: 1,
                title: 'Step Scout',
                desc: 'Reveal 1 random safe tile at wave start.',
                cost: 6,
                rarity: 'rare',
                icon: 'scout',
                shop: true
            },
            {
                key: 'perk:sense:1',
                type: 'perk',
                perk: 'sense',
                amount: 1,
                title: 'Bomb Sense',
                desc: 'Highlight the 3 most dangerous tiles.',
                cost: 7,
                rarity: 'epic',
                icon: 'sense',
                shop: true
            },
            {
                key: 'perk:overclock:1',
                type: 'perk',
                perk: 'overclock',
                amount: 1,
                title: 'Overclock',
                desc: 'Next wave gains +2 bombs but double scrap.',
                cost: 5,
                rarity: 'rare',
                icon: 'overclock',
                shop: true
            },
            {
                key: 'perk:defuse:1',
                type: 'perk',
                perk: 'defuse',
                amount: 1,
                title: 'Defuse Kit',
                desc: 'Negate the next bomb click.',
                cost: 7,
                rarity: 'epic',
                icon: 'defuse',
                shop: true
            }
        ];
    }

    renderItemsCatalog() {
        if (!itemsList) return;
        const items = this.itemsCatalog.filter((item) => this.itemsFilterMode !== 'shop' || item.shop);
        const order = { common: 0, rare: 1, epic: 2, legendary: 3 };
        items.sort((a, b) => {
            const rarityDiff = (order[a.rarity] ?? 99) - (order[b.rarity] ?? 99);
            if (rarityDiff !== 0) return rarityDiff;
            return a.title.localeCompare(b.title);
        });
        itemsList.innerHTML = '';
        let currentRarity = null;
        items.forEach((item) => {
            if (item.rarity !== currentRarity) {
                currentRarity = item.rarity;
                const header = document.createElement('div');
                header.className = 'item-group';
                header.textContent = currentRarity.toUpperCase();
                itemsList.appendChild(header);
            }
            const card = document.createElement('div');
            card.className = 'item-card';
            if (item.rarity) card.dataset.rarity = item.rarity;
            card.innerHTML = `
                <div class="item-header">
                    <div class="item-title">
                        ${this.getItemIconMarkup(item.icon)}
                        <span class="item-name">${item.title}</span>
                    </div>
                    <span class="item-rarity">${item.rarity}</span>
                </div>
                <p>${item.desc}</p>
            `;
            itemsList.appendChild(card);
        });
    }

    setItemsFilter(mode) {
        this.itemsFilterMode = mode;
        if (itemsFilterAll && itemsFilterShop) {
            itemsFilterAll.classList.toggle('active', mode === 'all');
            itemsFilterShop.classList.toggle('active', mode === 'shop');
        }
        this.renderItemsCatalog();
    }

    getItemIconMarkup(kind) {
        const icons = {
            scans: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/>
                    <path d="M16 16l4 4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            `,
            reveals: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" fill="none" stroke="currentColor" stroke-width="2"/>
                    <circle cx="12" cy="12" r="3.5" fill="none" stroke="currentColor" stroke-width="2"/>
                </svg>
            `,
            flags: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5 4v16" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                    <path d="M6 5h10l-2.5 3 2.5 3H6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                </svg>
            `,
            shields: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6l7-3z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                </svg>
            `,
            echoes: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/>
                    <path d="M12 5v4M12 15v4M5 12h4M15 12h4" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            `,
            upgrade: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 4l4 6h-3v6h-2v-6H8l4-6z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                    <rect x="6" y="16" width="12" height="4" rx="2" fill="currentColor" opacity="0.2"/>
                </svg>
            `,
            scrap: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M6 4l12 4-4 12-12-4 4-12z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                    <path d="M11 8l5 2-2 5-5-2 2-5z" fill="currentColor" opacity="0.2"/>
                </svg>
            `,
            scout: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/>
                    <path d="M12 7v5l3 3" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            `,
            sense: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6z" fill="none" stroke="currentColor" stroke-width="2"/>
                    <path d="M4 12h16" stroke="currentColor" stroke-width="2" stroke-linecap="round" opacity="0.6"/>
                </svg>
            `,
            overclock: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M13 2L5 14h6l-1 8 9-13h-6l1-7z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round"/>
                </svg>
            `,
            defuse: `
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="12" cy="12" r="7" fill="none" stroke="currentColor" stroke-width="2"/>
                    <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/>
                </svg>
            `
        };
        return `<span class="item-icon">${icons[kind] || icons.upgrade}</span>`;
    }

    renderShopWares() {
        if (!shopWares) return;
        shopWares.innerHTML = '';
        const items = this.pickShopItems();
        items.forEach((item) => {
            shopWares.appendChild(this.createShopItemButton(item));
        });
        this.triggerShopRefreshAnimation();
    }

    pickShopItems() {
        const pool = [...this.shopItemPool];
        for (let i = pool.length - 1; i > 0; i -= 1) {
            const j = Math.floor(Math.random() * (i + 1));
            [pool[i], pool[j]] = [pool[j], pool[i]];
        }
        return pool.slice(0, Math.min(this.shopDisplayCount, pool.length));
    }

    createShopItemButton(item) {
        const button = document.createElement('button');
        button.className = 'shop-item';
        if (item.type === 'upgrade') button.classList.add('upgrade');
        button.dataset.cost = `${item.cost}`;
        button.dataset.key = item.key;
        button.dataset.type = item.type;
        if (item.ability) button.dataset.ability = item.ability;
        if (item.upgrade) button.dataset.upgrade = item.upgrade;
        if (item.perk) button.dataset.perk = item.perk;
        button.dataset.amount = `${item.amount}`;
        if (item.rarity) button.dataset.rarity = item.rarity;
        button.innerHTML = `
            <div class="shop-item-title">
                ${this.getItemIconMarkup(item.icon)}
                <span>${item.title}</span>
            </div>
            <div class="shop-item-desc">${item.desc}</div>
            <div class="shop-item-cost">
                ${this.getShopPriceMarkup(item.cost)}
            </div>
        `;
        return button;
    }

    getShopPriceMarkup(cost) {
        return `
            <span class="shop-price" aria-label="Cost ${cost} scrap">
                <span class="scrap-icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24">
                        <path d="M6 4l12 4-4 12-12-4 4-12z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/>
                        <path d="M11 8l5 2-2 5-5-2 2-5z" fill="currentColor" opacity="0.2"/>
                    </svg>
                </span>
                <span class="price-value">${cost}</span>
            </span>
        `;
    }

    applyAdventureWaveStartEffects() {
        if (!this.adventureState || !this.board) return;
        if (this.adventureState.scoutReveals > 0) {
            for (let i = 0; i < this.adventureState.scoutReveals; i += 1) {
                this.board.revealRandomSafeTile();
            }
        }
        if (this.adventureState.bombSenseLevel > 0) {
            const tilesToHighlight = 3 + (this.adventureState.bombSenseLevel - 1);
            this.board.highlightDangerTiles(tilesToHighlight);
        }
    }
    triggerShopRefreshAnimation() {
        if (!shopWares) return;
        shopWares.classList.remove('shop-refresh');
        void shopWares.offsetWidth;
        shopWares.classList.add('shop-refresh');
        const cleanup = () => shopWares.classList.remove('shop-refresh');
        shopWares.addEventListener('animationend', cleanup, { once: true });
    }

    showMenu() {
        this.resetTimer();
        statusEl.classList.add('hidden');
        waveContinueBtn.classList.add('hidden');
        if (this.statusTimeout) clearTimeout(this.statusTimeout);
        gameScreen.classList.add('hidden');
        titleScreen.classList.remove('hidden');
        boardEl.innerHTML = '';
        this.board = null;
        this.abilityManager.lock(true);
        this.runMode = 'standard';
        this.adventureState = null;
        this.pendingWaveAdvance = null;
        this.lastStandardConfig = null;
        shopScreen.classList.add('hidden');
        waveTransitionEl.classList.add('hidden');
        this.updateWaveDisplay();
        this.updateScrapDisplay();
        this.updateRunModsDisplay();
        this.closeAllModals();
    }

    openConfigModal() {
        this.closeAllModals();
        modalEl.classList.remove('hidden');
        modalBackdrop.classList.remove('hidden');
    }

    openStatsModal() {
        if (statsBtn.classList.contains('disabled')) return;
        this.closeAllModals();
        this.updateStatsTable();
        statsModalEl.classList.remove('hidden');
        modalBackdrop.classList.remove('hidden');
    }

    openItemsModal() {
        this.closeAllModals();
        this.setItemsFilter(this.itemsFilterMode || 'all');
        this.renderItemsCatalog();
        itemsModalEl.classList.remove('hidden');
        modalBackdrop.classList.remove('hidden');
    }

    closeAllModals() {
        modalEl.classList.add('hidden');
        statsModalEl.classList.add('hidden');
        itemsModalEl.classList.add('hidden');
        adventureModalEl.classList.add('hidden');
        adventureRestartModalEl.classList.add('hidden');
        modalBackdrop.classList.add('hidden');
    }

    loadConfigStats() {
        const raw = localStorage.getItem('bombsAwayConfigStats');
        if (!raw) return {};
        try {
            return JSON.parse(raw) || {};
        } catch (e) {
            return {};
        }
    }

    saveConfigStats() {
        localStorage.setItem('bombsAwayConfigStats', JSON.stringify(this.configStats));
    }

    getConfigKey(width, height, bombs) {
        return `${width}x${height}|${bombs}`;
    }

    updateConfigStats(won) {
        if (!this.currentConfigKey) return;
        const [sizePart, bombsPart] = this.currentConfigKey.split('|');
        const size = sizePart;
        const bombs = parseInt(bombsPart);

        if (!this.configStats[this.currentConfigKey]) {
            this.configStats[this.currentConfigKey] = {
                grid: size,
                bombs,
                attempts: 0,
                wins: 0,
                bestTime: null
            };
        }

        const entry = this.configStats[this.currentConfigKey];
        entry.attempts += 1;
        if (won) {
            entry.wins += 1;
            if (this.seconds > 0 && (entry.bestTime === null || this.seconds < entry.bestTime)) {
                entry.bestTime = this.seconds;
            }
        }

        this.saveConfigStats();
        this.updateStatsTable();
        this.updateStatsButtonState();
    }

    updateStatsTable() {
        const entries = Object.values(this.configStats);
        entries.sort((a, b) => b.attempts - a.attempts);
        const top = entries.slice(0, 3);

        statsBody.innerHTML = '';
        if (top.length === 0) {
            statsBody.innerHTML = '<tr><td colspan="5">No games yet.</td></tr>';
            return;
        }

        top.forEach((entry, index) => {
            const tr = document.createElement('tr');
            const best = entry.bestTime === null ? '--:--' : this.formatTime(entry.bestTime);
            const badge = index === 0 ? '<span class="stats-badge">Top</span>' : '';
            tr.innerHTML = `
                <td>${badge}</td>
                <td>${entry.grid}</td>
                <td>${entry.bombs}</td>
                <td>${best}</td>
                <td>${entry.wins} / ${entry.attempts}</td>
            `;
            statsBody.appendChild(tr);
        });
    }

    updateStatsButtonState() {
        const hasData = Object.keys(this.configStats).length > 0;
        if (hasData) {
            statsBtn.classList.remove('disabled');
            statsBtn.disabled = false;
        } else {
            statsBtn.classList.add('disabled');
            statsBtn.disabled = true;
        }
    }

    loadStats() {
        const raw = localStorage.getItem('bombsAwayStats');
        if (!raw) return { wins: 0, streak: 0, bestTime: null };
        try {
            const parsed = JSON.parse(raw);
            return {
                wins: parsed.wins || 0,
                streak: parsed.streak || 0,
                bestTime: typeof parsed.bestTime === 'number' ? parsed.bestTime : null
            };
        } catch (e) {
            return { wins: 0, streak: 0, bestTime: null };
        }
    }

    saveStats() {
        localStorage.setItem('bombsAwayStats', JSON.stringify(this.stats));
    }

    updateStats(won) {
        if (won) {
            this.stats.wins += 1;
            this.stats.streak += 1;
            if (this.seconds > 0 && (this.stats.bestTime === null || this.seconds < this.stats.bestTime)) {
                this.stats.bestTime = this.seconds;
            }
        } else {
            this.stats.streak = 0;
        }
        this.saveStats();
        this.updateStatsDisplay();
    }

    updateStatsDisplay() {
        const best = this.formatTime(this.stats.bestTime);
        statsEl.textContent = `Best: ${best} | Wins: ${this.stats.wins} | Streak: ${this.stats.streak}`;
    }
}

new Game();




