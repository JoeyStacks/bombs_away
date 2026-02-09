window.BombsAway = window.BombsAway || {};

window.BombsAway.LivesDisplay = class LivesDisplay {
    constructor(livesEl) {
        this.livesEl = livesEl;
        this.total = 0;
        this.left = 0;
        this.shieldActive = 0;
    }

    setLives(total, left) {
        this.total = total;
        this.left = left;
        this.render();
    }

    setShieldActive(count) {
        this.shieldActive = count;
        this.render();
    }

    updateLivesLeft(left) {
        this.left = left;
        const hearts = Array.from(this.livesEl.querySelectorAll('.life-heart'));
        hearts.forEach((heart, index) => {
            if (index < left) {
                heart.classList.remove('lost');
            } else {
                if (!heart.classList.contains('lost')) {
                    heart.classList.add('heart-pop');
                    setTimeout(() => heart.classList.remove('heart-pop'), 350);
                }
                heart.classList.add('lost');
            }
        });
    }

    render() {
        this.livesEl.innerHTML = '';
        const shouldHide = this.total <= 1 && this.shieldActive <= 0;
        if (shouldHide) {
            this.livesEl.classList.add('hidden');
            return;
        }
        this.livesEl.classList.remove('hidden');
        for (let i = 0; i < this.total; i++) {
            const span = document.createElement('span');
            span.className = 'heart life-heart';
            span.innerHTML = '&hearts;';
            this.livesEl.appendChild(span);
        }
        for (let i = 0; i < this.shieldActive; i++) {
            const span = document.createElement('span');
            span.className = 'heart shield-heart';
            span.innerHTML = '&hearts;';
            this.livesEl.appendChild(span);
        }
        this.updateLivesLeft(this.left);
    }
};
