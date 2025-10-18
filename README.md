# CustomBingo

Aplicación de bingo musical creada con Vue 3 y Vuetify. Reproduce fragmentos de 30 segundos de canciones de un fichero JSON y muestra los números ya cantados en tiempo real.

## Requisitos previos

- Node.js 18 o superior
- npm 9 o superior

## Puesta en marcha

```bash
npm install
npm run dev
```

La aplicación quedará disponible en `http://localhost:5173`.

## Construir para producción

```bash
npm run build
```

Los archivos generados se encontrarán en `dist/`.

## Datos del bingo

Las canciones reproducidas se definen en `public/songs.json`. Cada elemento debe incluir:

- `nombre`: nombre descriptivo de la canción.
- `url`: enlace al videoclip en YouTube.
- `numero`: número asociado a la casilla del bingo.
- `segundoInicial`: segundo a partir del cual debe comenzar la reproducción.

Puedes modificar este archivo para personalizar tu bingo musical.
