const { GameMap } = require('../modules/GameMap');

class Game {

    constructor(modo, playersCount) {
        this.id = crypto.randomUUID();
        this.active = true;
        this.estandar = estandar;
        this.playersCount = playersCount;
    }

    set_active() {
        this.active = !this.active;
    }

    get_active() {
        return this.active
    }
}