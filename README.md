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

## Flujo de ramas (Gitflow)

| Rama | Propósito |
|------|-----------|
| `main` | Versiones estables / entregas. Solo recibe merges de `release/*` y `hotfix/*`. |
| `dev` | Integración del desarrollo. Base de todas las `feature/*`. |
| `feature/<nombre>` | Nueva funcionalidad. Sale de `dev` y vuelve a `dev`. |
| `bugfix/<nombre>` | Corrección durante el desarrollo. Sale de `dev` y vuelve a `dev`. |
| `release/<versión>` | Preparación de una entrega. Sale de `dev`, se integra en `main` y `dev`. |
| `hotfix/<versión>` | Corrección urgente en producción. Sale de `main`, se integra en `main` y `dev`. |

Las versiones se etiquetan en `main` con el prefijo `v` (por ejemplo `v1.0.0`).

### Trabajar una funcionalidad

Con la extensión `git flow` instalada:

```bash
git flow init -d                 # usa la configuración del repositorio (main / dev)
git flow feature start lobby
# ... commits ...
git flow feature finish lobby
```

Sin la extensión (equivalente manual):

```bash
git checkout dev && git pull
git checkout -b feature/lobby
# ... commits ...
git push -u origin feature/lobby   # y abrir Pull Request hacia dev
```
