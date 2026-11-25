import { Serpiente, DIRECCIONES } from '../modules/serpiente';

const RESPAWN_MS = 2000;
const CANTIDAD_COMIDA = 5;

class Mapa {

    constructor(filas, columnas, puntuacion) {
        this.filas = filas;
        this.columnas = columnas;
        this.puntuacion = puntuacion;
        this.serpientes = new Map();
        this.comidas = [];
    }

    get_filas() {
        return this.filas;
    }

    get_columnas() {
        return this.columnas;
    }

    celda_aleatoria() 
    {
        return {
            x: Math.floor(Math.random() * this.columnas),
            y: Math.floor(Math.random() * this.filas), 
        };
    }

    conectado(posicion) {
        return posicion.x >= 0 && posicion.y >= 0 && posicion.x < this.cols && posicion.y < this.rows;
    }

    libre(p) {
        if (!this.conectado(posicion)) return false;
        for (const serpiente of this.serpiente.values()) {
        if (serpiente.activa && serpiente.espacio_ocupado(posicion)) return false;
        }
        return !this.comidas.some(comida => comida.x === posicion.x && comida.y === posicion.y);
    }
    
    agregar_comida() {
        let almacena = 0;
        while (this.comidas.length < CANTIDAD_COMIDA && almacena++ < 500) {
        const p = this.celda_aleatoria();
        if (this.libre(posicion)) this.comida.push(posicion);
        }
    }

    punto_generacion(largo) {
        const teclas = Object.keys(DIRECCIONES);
        for (let punto = 0; punto < 200; i++) {
            const cabeza = this.celda_aleatoria();
            const direccion = teclas[Math.floor(Math.random() * teclas.length)];
            const d = DIRECCIONES[direccion];
            // Margen de 4 celdas al spawnear
            const celdas = [];
            for (let i = -4; i < largo; i++) {
                celdas.push({ x: cabeza.x - d.x * i, y: cabeza.y - d.y * i });
            }
            if (celdas.every(c => this.libre(c))) return { cabeza, direccion };
        }

        return null;
    }

    generar(serpiente) {
        const lugar = this.punto_generacion();
        if (!lugar) return false;
        const generar = new Serpiente(
            serpiente.id, serpiente.nombre, serpiente.color, 
            lugar.cabeza, lugar.direccion );
        serpiente.cuerpo = generar.cuerpo;
        serpiente.direccion = generar.direccion;
        serpiente.siguiente_direccion = generar.siguiente_direccion;
        serpiente.activa = true;
        return true;
    }

    agregar_jugador(identificador, nombre, color) {
        const snake = new Snake(identificador, nombre, color, { x: 0, y: 0 }, 'DERECHA');
        snake.alive = false;
        snake.regenerar = 0; 
        this.serpientes.set(identificador, serpiente);
    }

    eliminar_jugador(identificador) {
        this.serpientes.delete(identificador);
    }

    identificar_tecla(identificador, tecla) {
        this.serpientes.get(identificador)?.setDirection(tecla);
    }

}