# Vs Snake — Proyecto Programado #4

IC-4700 Lenguajes de Programación — Instituto Tecnológico de Costa Rica, II Semestre 2026.

Juego Snake multijugador en línea y en tiempo real.

## Estructura

```
backend/   Servidor de juego (Node.js + Express + Socket.IO)
  config/config.json   Parámetros configurables del juego
  src/                 Código fuente del servidor
frontend/  Cliente web (React + Vite)
docs/      Documentación del proyecto
```

## Requisitos

- Node.js 20 o superior
- npm

## Ejecución

### Backend

```bash
cd backend
npm install
npm run dev      # desarrollo (recarga automática)
npm start        # producción
```

El servidor escucha en el puerto definido en `backend/config/config.json` (por defecto `3001`).

### Frontend

```bash
cd frontend
npm install
cp .env.example .env   # ajustar VITE_SERVER_URL si el backend está publicado
npm run dev
```

## Configuración

Todos los parámetros variables del juego (tiempo de espera de partida, movimientos por segundo,
penalización por choque, veneno, paleta de colores, etc.) se encuentran en
`backend/config/config.json`.

## Flujo de ramas

- `main`: versiones estables / entrega.
- `dev`: integración del desarrollo.
