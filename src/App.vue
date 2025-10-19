<template>
  <v-app class="neon-app">
    <v-main>
      <v-container class="py-4 neon-container fill-vh" fluid>
        <div class="lighting lighting--one"></div>
        <div class="lighting lighting--two"></div>

        <v-row justify="center" align="start" class="g-8 center-stage">
          <v-col cols="12" md="9" lg="8">
            <v-card
              elevation="18"
              class="pa-4 neon-card control-card"
              rounded="xl"
            >
              <v-card-title class="neon-title mb-2">
                Bin<span class="title-highlight">go</span> Musical
              </v-card-title>

              <v-card-text class="pa-0">
                <div class="d-flex flex-column ga-6">
                  <div class="video-wrapper centered-video" v-if="videoReady">
                    <div class="video-stage">
                      <transition name="crossfade" mode="out-in">
                        <iframe
                          v-if="videoSrc"
                          :key="videoKey"
                          :src="videoSrc"
                          loading="eager"
                          class="video-iframe"
                          title="Reproducción de canción"
                          allow="autoplay; encrypted-media; accelerometer"
                          allowfullscreen
                        ></iframe>
                      </transition>
                    </div>
                  </div>

                  <v-sheet
                    v-else
                    class="d-flex align-center justify-center text-center py-12 neon-panel waiting-panel"
                    color="rgba(8, 8, 30, 0.75)"
                    rounded="xl"
                    elevation="6"
                  >
                    <div class="text-body-1 font-weight-medium">
                      Presiona <strong>Iniciar</strong> para comenzar la primera
                      canción del bingo.
                    </div>
                  </v-sheet>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="3" lg="4">
            <v-card
              elevation="16"
              class="pa-5 neon-card numbers-card"
              rounded="xl"
            >
              <transition name="slide-fade" mode="out-in">
                <div
                  v-if="currentSong"
                  key="current-song"
                  class="current-number-block neon-panel mb-4"
                >
                  <div class="current-number-label">Sonando ahora</div>
                  <div class="current-number-value">
                    {{ currentSong.numero }}
                  </div>
                  <div class="current-number-title text-subtitle-2">
                    {{ currentSong.nombre }}
                  </div>
                </div>
              </transition>

              <transition-group
                name="chip-pop"
                tag="div"
                class="numbers-grid"
                v-if="drawnNumbers.length"
                :style="numbersGridStyle"
              >
                <v-chip
                  v-for="number in drawnNumbers"
                  :key="`number-${number}`"
                  color="accent"
                  variant="elevated"
                  class="ma-1 text-subtitle-2 neon-chip"
                >
                  {{ number }}
                </v-chip>
              </transition-group>

              <div v-else class="text-body-2 text-medium-emphasis">
                Aún no se ha cantado ningún número. ¡Sé el primero en escuchar
                tu canción!
              </div>

              <div class="d-flex flex-wrap ga-4 mt-4 numbers-controls">
                <v-btn
                  color="primary"
                  size="large"
                  class="glow-btn"
                  :disabled="!canStart || isRunning"
                  @click="startBingo"
                >
                  Iniciar
                </v-btn>

                <!-- Botón dinámico "Línea / Confirmar? / Bingo!" -->
                <v-fade-transition mode="out-in">
                  <v-btn
                    :key="buttonState"
                    :color="buttonColor"
                    size="large"
                    class="glow-btn"
                    :disabled="buttonState === 'confirmar' && !canStart"
                    @click="onLineaButtonClick"
                  >
                    {{ buttonLabel }}
                  </v-btn>
                </v-fade-transition>

                <!-- (mantengo el botón Pausa original) -->
                <v-btn
                  color="secondary"
                  size="large"
                  class="glow-btn glow-btn--outline"
                  variant="outlined"
                  :disabled="!isRunning"
                  @click="pauseBingo"
                >
                  Pausa
                </v-btn>
              </div>
              <!-- diálogo de confirmación reutilizable -->
              <v-dialog v-model="dialogOpen" max-width="420">
                <v-card>
                  <v-card-title class="text-h6">¿Estás seguro?</v-card-title>
                  <v-card-text>
                    <div v-if="pendingFor === 'linea'">
                      Confirmar línea pausará temporalmente la partida y, si
                      confirmas, se marcará la línea y se reanudará la
                      reproducción.
                    </div>
                    <div v-else-if="pendingFor === 'bingo'">
                      Confirmar bingo terminará la partida si aceptas.
                    </div>
                  </v-card-text>
                  <v-card-actions class="justify-end">
                    <v-btn text @click="onDialogNo">No</v-btn>
                    <v-btn color="primary" @click="onDialogYes">Sí</v-btn>
                  </v-card-actions>
                </v-card>
              </v-dialog>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { defineEmits } from "vue";

const emit = defineEmits(["game-ended"]);

const songs = ref([]);
const drawnNumbers = ref([]);
const currentSong = ref(null);
const videoSrc = ref("");
const videoKey = ref(0);
const isRunning = ref(false);
const isLoading = ref(true);
const loadError = ref("");
let songTimeoutId = null;

const songsUrl = "/songs.json";

const fetchSongs = async () => {
  try {
    const response = await fetch(songsUrl);
    if (!response.ok) {
      throw new Error(`Estado ${response.status}`);
    }
    const data = await response.json();
    songs.value = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error("Error cargando canciones", error);
    loadError.value = error instanceof Error ? error.message : String(error);
  } finally {
    isLoading.value = false;
  }
};

const extractVideoId = (url) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("youtu.be")) {
      return parsed.pathname.slice(1);
    }
    if (parsed.searchParams.has("v")) {
      return parsed.searchParams.get("v");
    }
    const segments = parsed.pathname.split("/");
    const embedIndex = segments.findIndex((segment) => segment === "embed");
    if (embedIndex !== -1 && segments[embedIndex + 1]) {
      return segments[embedIndex + 1];
    }
  } catch (error) {
    const fallback = url.match(/[\w-]{11}/);
    if (fallback) {
      return fallback[0];
    }
    console.warn("No se pudo extraer el ID de YouTube de la URL:", url, error);
  }
  return "";
};

const buildVideoUrl = (song) => {
  const videoId = extractVideoId(song.url);
  const startSeconds = Number(song.segundoInicial) || 0;
  const params = new URLSearchParams({
    start: String(startSeconds),
    autoplay: "1",
    controls: "0",
    modestbranding: "1",
    rel: "0",
    playsinline: "1",
  });
  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
};

/* scheduling: ahora soporta pausa/continuación con remaining time */
const DEFAULT_SCHEDULE_DELAY = 20000;
let songDeadline = ref(null);
let songRemaining = ref(0);

const scheduleNextSong = (delay = DEFAULT_SCHEDULE_DELAY) => {
  clearTimeout(songTimeoutId);
  songRemaining.value = delay;
  songDeadline.value = Date.now() + delay;
  songTimeoutId = setTimeout(() => {
    songTimeoutId = null;
    songRemaining.value = 0;
    songDeadline.value = null;
    if (isRunning.value) {
      playNextSong();
    }
  }, delay);
};

const pauseSchedule = () => {
  if (songTimeoutId) {
    clearTimeout(songTimeoutId);
    songTimeoutId = null;
    if (songDeadline.value) {
      songRemaining.value = Math.max(0, songDeadline.value - Date.now());
    }
    songDeadline.value = null;
  }
};

const resumeSchedule = () => {
  // solo reanuda si la partida está en marcha
  if (!isRunning.value) return;
  const remaining = Math.max(0, songRemaining.value || 0);
  if (remaining > 50) {
    scheduleNextSong(remaining);
  } else {
    // si ya expiró o queda muy poco, programar el delay por defecto
    scheduleNextSong(DEFAULT_SCHEDULE_DELAY);
  }
};

const playSongVideo = (song) => {
  if (!song || !song.url) {
    currentSong.value = song || null;
    videoSrc.value = "";
    return;
  }

  currentSong.value = song;
  if (!drawnNumbers.value.includes(song.numero)) {
    drawnNumbers.value.push(song.numero);
  }

  // asignamos la URL directamente al iframe
  videoSrc.value = buildVideoUrl(song);
  videoKey.value++;
};

const playNextSong = () => {
  if (!songs.value.length) return;

  const pendingSongs = songs.value.filter(
    (s) => !drawnNumbers.value.includes(s.numero)
  );
  if (!pendingSongs.length) {
    finishBingo();
    return;
  }

  const randomIndex = Math.floor(Math.random() * pendingSongs.length);
  const nextSong = pendingSongs[randomIndex];

  // actualizar estado y reproducir
  drawnNumbers.value.push(nextSong.numero);
  currentSong.value = nextSong;
  playSongVideo(nextSong);
  scheduleNextSong();
};

const startBingo = () => {
  if (!songs.value.length || isRunning.value) return;

  if (drawnNumbers.value.length === songs.value.length) {
    drawnNumbers.value.splice(0, drawnNumbers.value.length);
    currentSong.value = null;
    videoSrc.value = "";
  }

  isRunning.value = true;

  if (!currentSong.value) {
    playNextSong();
    return;
  }

  playSongVideo(currentSong.value);
  scheduleNextSong();
};

const pauseBingo = () => {
  if (!isRunning.value) return;
  isRunning.value = false;
  clearTimeout(songTimeoutId);
  songTimeoutId = null;
  // detener reproducción limpiando src para que iframe deje de reproducir
  videoSrc.value = "";
  videoKey.value += 1;
  songRemaining.value = 0;
  songDeadline.value = null;
};

const finishBingo = () => {
  isRunning.value = false;
  clearTimeout(songTimeoutId);
  songTimeoutId = null;
  videoSrc.value = "";
  songRemaining.value = 0;
  songDeadline.value = null;
};

// computeds
const canStart = computed(
  () => !isLoading.value && !loadError.value && songs.value.length > 0
);
const hasCompleted = computed(
  () =>
    !isLoading.value &&
    songs.value.length > 0 &&
    drawnNumbers.value.length === songs.value.length
);
const remainingSongsCount = computed(() =>
  Math.max(songs.value.length - drawnNumbers.value.length, 0)
);
const videoReady = computed(() => Boolean(videoSrc.value));

const chipSize = computed(() => {
  const n = drawnNumbers.value.length;
  if (n <= 6) return 120;
  if (n <= 12) return 88;
  if (n <= 24) return 64;
  if (n <= 40) return 48;
  return 36;
});
const numbersGridStyle = computed(() => ({
  "--chip-size": `${chipSize.value}px`,
}));

onMounted(async () => {
  await fetchSongs();
});
onBeforeUnmount(() => {
  clearTimeout(songTimeoutId);
});

/* --- Estado del botón Línea / Confirmar? / Bingo! --- */
const buttonState = ref("linea"); // 'linea' | 'confirmar' | 'bingo'
const dialogOpen = ref(false);
const pendingFor = ref(null); // 'linea' | 'bingo' cuando se abre el modal
const pausedByLinea = ref(false);

const buttonLabel = computed(() => {
  switch (buttonState.value) {
    case "linea":
      return "Línea";
    case "confirmar":
      return "Confirmar?";
    case "bingo":
      return "Bingo!";
    default:
      return "Línea";
  }
});

const buttonColor = computed(() => {
  switch (buttonState.value) {
    case "linea":
      return "primary"; // azul
    case "confirmar":
      return "warning"; // amarillo
    case "bingo":
      return "error"; // rojo
    default:
      return "primary";
  }
});

/* --- funciones para flujo Línea / Confirmación / Bingo --- */
function pauseForLinea() {
  // pausa la reproducción actual manteniendo currentSong para poder reanudar
  if (videoSrc.value) {
    pausedByLinea.value = true;
    // pausa schedule y reproducción, pero conserva currentSong
    pauseSchedule();
    // para detener audio visual, limpiamos src (como ya hacía pauseBingo)
    // pero no alteramos isRunning (dejamos isRunning true para indicar partida en curso)
    videoSrc.value = "";
    videoKey.value++;
  }
}

function resumeAfterLinea() {
  if (currentSong.value && currentSong.value.url) {
    // reponer la URL para que vuelva a reproducir la canción actual
    videoSrc.value = buildVideoUrl(currentSong.value);
    videoKey.value++;
    isRunning.value = true;
    pausedByLinea.value = false;
    // NO llamar aquí a scheduleNextSong: lo hará resumeSchedule al cerrar el modal
  }
}

function onLineaButtonClick() {
  if (buttonState.value === "linea") {
    // primer click: pausar y pasar a confirmar
    pauseForLinea();
    buttonState.value = "confirmar";
    pendingFor.value = "linea";
    return;
  }

  if (buttonState.value === "confirmar") {
    // abrir modal de confirmación; pendingFor ya debe indicar si viene de 'linea' o 'bingo'
    dialogOpen.value = true;
    return;
  }

  if (buttonState.value === "bingo") {
    // pulsar Bingo! vuelve a mostrar Confirmar? con intención de terminar si confirman
    buttonState.value = "confirmar";
    pendingFor.value = "bingo";
    dialogOpen.value = true;
    return;
  }
}

function onDialogNo() {
  // cerrar modal, no cambiar estado (se queda en 'confirmar' y la partida sigue pausada si venía de linea)
  dialogOpen.value = false;
}

function onDialogYes() {
  dialogOpen.value = false;
  if (pendingFor.value === "linea") {
    // confirmar línea: reanudar y cambiar botón a Bingo!
    resumeAfterLinea();
    buttonState.value = "bingo";
    pendingFor.value = null;
    return;
  }

  if (pendingFor.value === "bingo") {
    // confirmar bingo: terminar juego
    endGame();
    pendingFor.value = null;
    return;
  }
}

function endGame() {
  // simulación de fin de juego
  finishBingo();
  emit("game-ended");
  buttonState.value = "linea";
  dialogOpen.value = false;
  pausedByLinea.value = false;
}

/* --- watch para pausar/resumir schedule cuando se abre/cierra el modal --- */
watch(
  dialogOpen,
  (open) => {
    if (open) {
      // detener timeout mientras el modal está abierto
      pauseSchedule();
    } else {
      // al cerrarse el modal, si la partida sigue en marcha reanudar o finalizar según estado
      // (onDialogYes ya habrá ejecutado endGame o resumeAfterLinea cuando corresponda)
      if (isRunning.value) {
        // Si hemos reanudado la reproducción (resumeAfterLinea fue llamado), reanudar schedule
        // con el tiempo restante capturado al abrir el modal.
        resumeSchedule();
      } else {
        // si no está en marcha, limpiar posibles timeouts
        clearTimeout(songTimeoutId);
        songTimeoutId = null;
      }
    }
  },
  { immediate: false }
);
</script>

<style scoped>
/* palette: suaves blancos, verdes y dorados pastel */

/* base */
.neon-app {
  background: transparent;
  color: #233427; /* texto base: verde oscuro suave */
}

/* contenedor principal: suave degradado crema -> verde pastel */
.neon-container {
  position: relative;
  isolation: isolate;
  min-height: 100vh;
  overflow: hidden;
  background: linear-gradient(180deg, #fbf8f2 0%, #f2f7ee 45%, #e9f6ea 100%);
}

/* luces decorativas: verdes y doradas suaves */
.lighting--one {
  top: -120px;
  left: -80px;
  background: rgba(183, 230, 194, 0.55); /* verde pastel */
}
.lighting--two {
  right: -120px;
  bottom: -120px;
  background: rgba(255, 234, 172, 0.45); /* dorado pastel */
}

/* tarjetas: mantener profundidad pero con tonos crema/verde suave */
.neon-card {
  position: relative;
  overflow: hidden;
  background: linear-gradient(
    145deg,
    rgba(255, 252, 244, 0.95),
    rgba(241, 249, 240, 0.92)
  );
  border: 1px solid rgba(36, 61, 45, 0.06);
  box-shadow: 0 18px 40px rgba(36, 61, 45, 0.06),
    inset 0 0 0 1px rgba(255, 255, 255, 0.6);
  backdrop-filter: blur(8px);
  z-index: 1;
}

/* título: blanco suave + acento dorado */
.neon-title {
  font-family: "Monoton", cursive;
  font-size: clamp(2.2rem, 4vw, 2.8rem);
  letter-spacing: 0.22em;
  color: #1f643a;
  text-shadow: 0 6px 18px rgba(240, 225, 181, 0.18);
  display: flex;
  gap: 0.45rem;
}
.title-highlight {
  color: #d4b86b; /* acento dorado */
  text-shadow: 0 8px 36px rgba(212, 184, 107, 0.14);
}

/* botones: gradiente pastel dorado -> verde */
.glow-btn {
  border-radius: 999px;
  padding-inline: 2.75rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  /* background: linear-gradient(135deg, #f7e8bf 0%, #dff2e1 100%); */
  background: #1f643a !important;
  box-shadow: 0 12px 28px rgba(36, 61, 45, 0.08);
  border: 1px solid rgba(36, 61, 45, 0.06);
}
.glow-btn--outline {
  background: transparent;
  color: #2b5d45 !important;
  border: 2px solid rgba(43, 93, 69, 0.12);
}

/* video wrapper: conservar forma pero más claro */
.video-wrapper {
  overflow: hidden;
  border-radius: 18px;
  box-shadow: 0 20px 40px rgba(36, 61, 45, 0.06);
  width: 100%;
  height: min(82vh, 1000px);
  min-height: 480px;
  max-height: calc(100vh - 110px);
  margin: 0 auto;
}

/* video stage: sutil fondo verdoso */
.video-stage {
  height: 100%;
  width: 100%;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px rgba(36, 61, 45, 0.03);
  background: linear-gradient(
    180deg,
    rgba(241, 249, 240, 0.9),
    rgba(233, 246, 232, 0.85)
  );
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* iframe */
.video-iframe {
  width: 100% !important;
  height: 100% !important;
  display: block;
  border: 0;
  min-height: 420px;
  background: transparent;
  will-change: opacity, transform;
}

/* columna números: tarjeta más neutra con borde dorado sutil */
.numbers-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 120px);
  overflow: hidden;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 250, 0.95),
    rgba(246, 251, 244, 0.96)
  );
  border: 1px solid rgba(212, 184, 107, 0.06);
}

/* bloque "Sonando ahora": fondo blanco cremoso, número en verde oscuro */
.current-number-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 1rem 0.8rem;
  border-radius: 12px;
  text-align: center;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 250, 0.98),
    rgba(250, 252, 246, 0.96)
  );
  border: 1px solid rgba(36, 61, 45, 0.06);
  box-shadow: 0 8px 30px rgba(36, 61, 45, 0.04);
}
.current-number-label {
  font-size: 0.75rem;
  color: rgba(43, 93, 69, 0.75);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.current-number-value {
  font-weight: 900;
  color: #21422e; /* verde oscuro para destacar */
  line-height: 1;
  font-size: clamp(6.6rem, 17.2vw, 13.8rem);
  text-shadow: 0 10px 30px rgba(36, 61, 45, 0.06);
}
.current-number-title {
  font-size: 0.9rem;
  color: rgba(43, 93, 69, 0.85);
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* chips: fondo dorado pastel con texto verde */
.neon-chip {
  min-width: var(--chip-size, 88px);
  max-width: calc(var(--chip-size, 88px) * 1.4);
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: 0.45rem 0.75rem;
  font-size: clamp(0.8rem, calc(var(--chip-size, 88px) / 12), 1.05rem);
  border-radius: 10px;
  transition: all 180ms ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  background: linear-gradient(180deg, #fff4d6 0%, #f6e8bf 100%);
  color: #22422f;
  border: 1px solid rgba(36, 61, 45, 0.06);
  box-shadow: 0 8px 18px rgba(36, 61, 45, 0.04);
}

/* controls spacing */
.numbers-controls {
  gap: 0.75rem;
  margin-top: 1rem;
}

/* pequeño ajuste visual para el botón dinámico */
.numbers-controls .v-btn[variant="outlined"] {
  min-width: 110px;
}
.numbers-controls .glow-btn {
  min-width: 140px;
}

/* transitions: mantener comportamiento, ajustar sombras suaves */
.crossfade-enter-active,
.crossfade-leave-active {
  transition: opacity 820ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 820ms cubic-bezier(0.22, 1, 0.36, 1);
}
.crossfade-enter-from,
.crossfade-leave-to {
  opacity: 0;
  transform: scale(0.996);
}
.crossfade-enter-to,
.crossfade-leave-from {
  opacity: 1;
  transform: scale(1);
}

/* other transitions unchanged */
.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: opacity 480ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 480ms cubic-bezier(0.22, 1, 0.36, 1);
}
.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-8px);
}
.slide-fade-enter-to {
  opacity: 1;
  transform: translateY(0);
}
.slide-fade-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

.chip-pop-enter-active {
  transition: transform 300ms cubic-bezier(0.22, 1, 0.36, 1), opacity 300ms ease;
}
.chip-pop-leave-active {
  transition: opacity 220ms ease, transform 220ms ease;
}
.chip-pop-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}
.chip-pop-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.chip-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.98);
}

/* responsive tweaks */
@media (max-width: 960px) {
  .video-wrapper {
    height: 46vh;
    min-height: 180px;
    max-height: calc(100vh - 140px);
  }
  .control-card {
    padding: 12px !important;
  }
}
</style>
