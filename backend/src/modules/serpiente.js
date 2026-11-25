
const DIRECCIONES = {
    arriba:    {x: 0,  y: -1},
    abajo:     {x: 0,  y: 1},
    izquierda: {x: -1, y: 0},
    derecha:   {x: 1,  y: 0}
}

class Serpiente { 

    constructor(identificador, nombre_jugador, color, cabeza, direccion) {
        this.identificador       = identificador;
        this.nombre_jugador      = nombre_jugador;
        this.color               = color;
        this.activo              = true;
        this.regenerar           = 0;
        this.direccion           = DIRECCIONES[direccion];
        this.siguiente_direccion = this.direccion;
        this.cuerpo              = Array.from({ largo }, (_, i) => (
                                  { x: cabeza.x - this.direccion.x * i, 
                                    y: cabeza.y - this.direccion * i } ));
    }

    get cabeza() {
        return this.cuerpo[0];
    }

    largo() {
        return this.cuerpo.length;
    }

    aumentar_largo(cola) {
        this.cuerpo.push(cola);
    }
    
    disminuir_largo() {
        this.cuerpo.pop();
    }

    set_direccion(tecla) {
        const cambio = DIRECCIONES[tecla];
        if (!cambio) return;
        const opuesto = cambio.x === -this.direccion.x && cambio.y === -this.direccion.y;
        if (!opuesto) this.siguiente_direccion = cambio;
    }

    // Calcula siguiente posicion de la cabeza sin mover nada todavía
    calcular_siguiente_movimiento() {
        return { x: this.cabeza.x + this.siguiente_direccion.x, y: this.cabeza.y + this.siguiente_direccion.y };
    }

    mover(crecer_cola = false) {
        this.direccion = this.siguiente_direccion;
        this.cuerpo.unshift({ x: this.cabeza.x + this.direccion.x, y: this.cabeza.y + this.direccion.y });
        if (!crecer_cola) this.disminuir_largo;
    }

    espacio_ocupado(posicion, saltar_cabeza = false) {
        const celdas = saltar_cabeza ? this.cuerpo.slice(1) : this.cuerpo;
        return celdas.some(c => c.x === posicion.x && c.y === posicion.y);
    }

    toJSON() {
        return { 
            id: this.identificador, 
            nombre: this.nombre_jugador, 
            color: this.color,
            cuerpo: this.cuerpo, 
            activo: this.activo, 
            score: this.score 
        }; 
    }
};

module.exports = { Snake, DIRECCIONES};