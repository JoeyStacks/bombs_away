class Tile {
    constructor(r, c, el) {
        this.r = r;
        this.c = c;
        this.el = el;
        this.revealed = false;
        this.flagged = false;
        this.neighbor = 0;
        this.isBomb = false;
    }

    reveal(isFlood, delayMs) {
        this.revealed = true;
        this.el.classList.add('revealed');
        if (isFlood) {
            this.el.classList.add('flood-reveal');
            this.el.style.setProperty('--reveal-delay', `${delayMs}ms`);
        } else {
            this.el.classList.add('reveal-animation');
        }
    }

    setFlagged(flagged) {
        this.flagged = flagged;
        if (flagged) this.el.classList.add('flagged');
        else this.el.classList.remove('flagged');
    }

    setNumber(count) {
        this.neighbor = count;
        if (count > 0) {
            this.el.textContent = String(count);
            this.el.classList.add('number', `num-${count}`);
        } else {
            this.el.classList.add('empty');
        }
    }

    showBomb() {
        this.el.textContent = 'B';
        this.el.classList.add('bomb-explode', 'bomb');
    }
}

class BombTile extends Tile {
    constructor(r, c, el) {
        super(r, c, el);
        this.isBomb = true;
    }
}

class NumberTile extends Tile {
    constructor(r, c, el, count) {
        super(r, c, el);
        this.neighbor = count;
    }
}

class EmptyTile extends Tile {
    constructor(r, c, el) {
        super(r, c, el);
        this.neighbor = 0;
    }
}
