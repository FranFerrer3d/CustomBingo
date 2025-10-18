<template>
  <v-app class="neon-app">
    <v-main>
      <v-container fluid class="py-10 neon-container">
        <div class="lighting lighting--one" />
        <div class="lighting lighting--two" />

        <v-row class="g-8" justify="center" align="stretch">
          <v-col cols="12" xl="8">
            <v-card class="neon-card video-card" elevation="22" rounded="xl">
              <header class="video-card__header">
                <h1 class="neon-title">
                  <span class="title-highlight">Hit</span>ster Bingo Musical
                </h1>
                <p class="neon-subtitle">
                  Reproduce 30 segundos de canciones aleatorias y descubre quién canta bingo primero.
                </p>
              </header>

              <v-divider class="neon-divider" />

              <div class="video-stage-wrapper">
                <v-responsive v-if="videoReady" aspect-ratio="16/9" class="video-stage">
                  <iframe
                    :key="videoKey"
                    :src="videoSrc"
                    allow="autoplay; encrypted-media; accelerometer"
                    allowfullscreen
                    title="Reproducción de canción"
                  />
                </v-responsive>

                <v-sheet
                  v-else
                  class="d-flex align-center justify-center text-center py-12 neon-panel waiting-panel"
                  color="rgba(8, 8, 30, 0.75)"
                  rounded="xl"
                  elevation="6"
                >
                  <p class="waiting-panel__message">
                    Presiona <strong>Iniciar</strong> para comenzar la primera canción del bingo.
                  </p>
                </v-sheet>

                <div class="video-transition" :class="{ 'video-transition--active': isTransitioning }">
                  <span class="video-transition__label">Preparando la siguiente pista...</span>
                </div>
              </div>

              <div class="equalizer">
                <span v-for="bar in 5" :key="`bar-${bar}`" class="equalizer__bar" />
              </div>
            </v-card>
          </v-col>

          <v-col cols="12" xl="4" class="d-flex flex-column ga-6">
            <v-card class="pa-6 neon-card control-card" elevation="18" rounded="xl">
              <v-card-text class="pa-0">
                <div class="d-flex flex-column ga-6">
                  <div class="d-flex flex-wrap ga-4">
                    <v-btn
                      class="glow-btn"
                      color="primary"
                      size="large"
                      :disabled="!canStart || isRunning"
                      @click="startBingo"
                    >
                      Iniciar
                    </v-btn>
                    <v-btn
                      class="glow-btn glow-btn--outline"
                      color="secondary"
                      size="large"
                      variant="outlined"
                      :disabled="!isRunning"
                      @click="pauseBingo"
                    >
                      Pausa
                    </v-btn>
                  </div>

                  <div class="status-panel neon-panel">
                    <template v-if="isLoading">
                      <div class="d-flex align-center ga-3">
                        <v-progress-circular indeterminate color="primary" />
                        <span>Cargando canciones...</span>
                      </div>
                    </template>
                    <template v-else-if="loadError">
                      <v-alert border="start" prominent type="error">
                        No fue posible cargar las canciones. {{ loadError }}
                      </v-alert>
                    </template>
                    <template v-else>
                      <div class="d-flex flex-column ga-1">
                        <span class="text-subtitle-2">
                          Canciones cargadas: {{ songs.length }} | Restantes: {{ remainingSongsCount }}
                        </span>
                        <span v-if="hasCompleted" class="text-success text-subtitle-1 font-weight-medium">
                          ¡Todas las canciones han sonado!
                        </span>
                        <span v-else-if="currentSong" class="text-h6 font-weight-medium">
                          Sonando: {{ currentSong.nombre }}
                        </span>
                      </div>
                    </template>
                  </div>
                </div>
              </v-card-text>
            </v-card>

            <v-card class="pa-5 neon-card numbers-card" elevation="16" rounded="xl">
              <v-card-title class="text-h5 font-weight-bold pb-3 numbers-title">
                Números cantados
              </v-card-title>
              <v-divider class="mb-5 neon-divider" />

              <div v-if="drawnNumbers.length" class="numbers-grid">
                <v-chip
                  v-for="(number, index) in drawnNumbers"
                  :key="`number-${number}-${index}`"
                  class="ma-1 text-subtitle-2 neon-chip"
                  color="accent"
                  variant="elevated"
                  :style="chipStyle"
                >
                  {{ number }}
                </v-chip>
              </div>
              <p v-else class="text-body-2 text-medium-emphasis numbers-empty">
                Aún no se ha cantado ningún número. ¡Sé el primero en escuchar tu canción!
              </p>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';

const songs = ref([]);
const drawnNumbers = ref([]);
const currentSong = ref(null);
const videoSrc = ref('');
const videoKey = ref(0);
const isRunning = ref(false);
const isLoading = ref(true);
const loadError = ref('');
const isTransitioning = ref(false);

let songTimeoutId = null;
let transitionTimeoutId = null;
let transitionResetTimeoutId = null;

const SONG_DURATION_MS = 30_000;
const TRANSITION_DELAY_MS = 450;
const TRANSITION_RESET_MS = 1_100;
const songsUrl = '/songs.json';

const fetchSongs = async () => {
  try {
    const response = await fetch(songsUrl);
    if (!response.ok) {
      throw new Error(`Estado ${response.status}`);
    }

    const data = await response.json();
    songs.value = Array.isArray(data) ? data : [];
  } catch (error) {
    console.error('Error cargando canciones', error);
    loadError.value = error instanceof Error ? error.message : String(error);
  } finally {
    isLoading.value = false;
  }
};

const extractVideoId = (url) => {
  try {
    const parsed = new URL(url);

    if (parsed.hostname.includes('youtu.be')) {
      return parsed.pathname.slice(1);
    }

    if (parsed.searchParams.has('v')) {
      return parsed.searchParams.get('v');
    }

    const segments = parsed.pathname.split('/');
    const embedIndex = segments.findIndex((segment) => segment === 'embed');
    if (embedIndex !== -1 && segments[embedIndex + 1]) {
      return segments[embedIndex + 1];
    }
  } catch (error) {
    const fallback = url.match(/[\w-]{11}/);
    if (fallback) {
      return fallback[0];
    }
    console.warn('No se pudo extraer el ID de YouTube de la URL:', url, error);
  }

  return '';
};

const buildVideoUrl = (song) => {
  const videoId = extractVideoId(song.url);
  const startSeconds = Number(song.segundoInicial) || 0;
  const params = new URLSearchParams({
    start: String(startSeconds),
    autoplay: '1',
    controls: '0',
    modestbranding: '1',
    rel: '0',
    playsinline: '1',
  });

  return `https://www.youtube.com/embed/${videoId}?${params.toString()}`;
};

const clearTransitionTimers = () => {
  clearTimeout(transitionTimeoutId);
  clearTimeout(transitionResetTimeoutId);
};

const scheduleNextSong = () => {
  clearTimeout(songTimeoutId);
  songTimeoutId = setTimeout(() => {
    if (isRunning.value) {
      playNextSong();
    }
  }, SONG_DURATION_MS);
};

const updateVideoSource = (song) => {
  const url = buildVideoUrl(song);
  videoKey.value += 1;
  videoSrc.value = `${url}&vkey=${videoKey.value}`;
};

const playSongVideo = (song) => {
  clearTransitionTimers();

  if (!song) {
    isTransitioning.value = false;
    videoSrc.value = '';
    return;
  }

  isTransitioning.value = true;

  transitionTimeoutId = setTimeout(() => {
    updateVideoSource(song);
  }, TRANSITION_DELAY_MS);

  transitionResetTimeoutId = setTimeout(() => {
    isTransitioning.value = false;
  }, TRANSITION_RESET_MS);
};

const finishBingo = () => {
  isRunning.value = false;
  clearTimeout(songTimeoutId);
  clearTransitionTimers();
  isTransitioning.value = false;
  videoSrc.value = '';
};

const playNextSong = () => {
  if (!songs.value.length) {
    return;
  }

  const pendingSongs = songs.value.filter((song) => !drawnNumbers.value.includes(song.numero));

  if (!pendingSongs.length) {
    finishBingo();
    return;
  }

  const randomIndex = Math.floor(Math.random() * pendingSongs.length);
  const nextSong = pendingSongs[randomIndex];

  drawnNumbers.value.push(nextSong.numero);
  currentSong.value = nextSong;

  playSongVideo(nextSong);
  scheduleNextSong();
};

const startBingo = () => {
  if (!songs.value.length || isRunning.value) {
    return;
  }

  if (drawnNumbers.value.length === songs.value.length) {
    drawnNumbers.value.splice(0, drawnNumbers.value.length);
    currentSong.value = null;
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
  if (!isRunning.value) {
    return;
  }

  isRunning.value = false;
  clearTimeout(songTimeoutId);
  clearTransitionTimers();
  isTransitioning.value = false;
  videoSrc.value = '';
  videoKey.value += 1;
};

const canStart = computed(() => !isLoading.value && !loadError.value && songs.value.length > 0);
const hasCompleted = computed(
  () => !isLoading.value && songs.value.length > 0 && drawnNumbers.value.length === songs.value.length,
);
const remainingSongsCount = computed(() => Math.max(songs.value.length - drawnNumbers.value.length, 0));
const videoReady = computed(() => Boolean(videoSrc.value));

const chipStyle = computed(() => {
  const count = drawnNumbers.value.length;

  if (!count) {
    return {};
  }

  let fontSize = 1.2;

  if (count <= 5) {
    fontSize = 1.8;
  } else if (count <= 10) {
    fontSize = 1.5;
  } else if (count <= 20) {
    fontSize = 1.25;
  } else if (count <= 35) {
    fontSize = 1.1;
  } else {
    fontSize = 1;
  }

  const verticalPadding = 0.35 * fontSize;
  const horizontalPadding = 0.75 * fontSize;

  return {
    fontSize: `${fontSize}rem`,
    padding: `${verticalPadding}rem ${horizontalPadding}rem`,
  };
});

onMounted(async () => {
  await fetchSongs();
});

onBeforeUnmount(() => {
  clearTimeout(songTimeoutId);
  clearTransitionTimers();
});
</script>

<style scoped>
.neon-app {
  background: transparent;
  color: #f7f5ff;
}

.neon-container {
  position: relative;
  isolation: isolate;
  min-height: 100%;
}

.lighting {
  position: absolute;
  width: 320px;
  height: 320px;
  border-radius: 50%;
  filter: blur(120px);
  z-index: 0;
}

.lighting--one {
  top: -120px;
  left: -80px;
  background: rgba(255, 0, 128, 0.55);
}

.lighting--two {
  right: -120px;
  bottom: -120px;
  background: rgba(0, 200, 255, 0.45);
}

.neon-card {
  position: relative;
  overflow: hidden;
  background: linear-gradient(145deg, rgba(22, 12, 61, 0.92), rgba(44, 16, 106, 0.8));
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 25px 45px rgba(2, 0, 36, 0.45), inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(18px);
  z-index: 1;
}

.neon-card::after {
  content: '';
  position: absolute;
  inset: -60% -40% auto;
  height: 120%;
  background: radial-gradient(circle, rgba(255, 0, 204, 0.4), transparent 55%);
  opacity: 0.35;
  pointer-events: none;
}

.control-card::after {
  inset: auto -40% -60%;
  background: radial-gradient(circle, rgba(0, 255, 255, 0.25), transparent 65%);
}

.video-card {
  padding-bottom: 1.5rem;
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.video-card::after {
  inset: 10% -30% auto;
  background: radial-gradient(circle, rgba(95, 243, 255, 0.35), transparent 55%);
}

.video-card__header {
  padding: clamp(1.5rem, 2vw, 2.5rem) clamp(1.25rem, 3vw, 2.75rem) 0;
}

.neon-title {
  font-family: 'Monoton', cursive;
  font-size: clamp(2.4rem, 4vw, 3rem);
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: #f8f3ff;
  margin: 0;
}

.title-highlight {
  color: #ff67ff;
  text-shadow: 0 0 14px rgba(255, 103, 255, 0.65);
}

.neon-subtitle {
  font-size: clamp(1rem, 1.6vw, 1.2rem);
  color: rgba(226, 229, 255, 0.82);
  margin: 0;
  max-width: 80ch;
}

.video-stage-wrapper {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  border: 1px solid rgba(95, 243, 255, 0.18);
  box-shadow: 0 28px 55px rgba(10, 0, 45, 0.55);
  background: rgba(10, 6, 30, 0.85);
}

.video-stage {
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  background: linear-gradient(145deg, rgba(12, 5, 46, 0.9), rgba(27, 9, 66, 0.8));
}

.video-stage iframe {
  width: 100%;
  height: 100%;
  border: 0;
}

.waiting-panel__message {
  margin: 0;
}

.video-transition {
  position: absolute;
  inset: 0;
  background: radial-gradient(circle at center, rgba(12, 0, 40, 0), rgba(6, 0, 20, 0.85));
  opacity: 0;
  transition: opacity 0.45s ease;
  pointer-events: none;
  display: flex;
  align-items: center;
  justify-content: center;
  text-align: center;
}

.video-transition--active {
  opacity: 1;
  transition-duration: 0.35s;
}

.video-transition__label {
  font-size: clamp(1.1rem, 2vw, 1.4rem);
  font-weight: 600;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: rgba(198, 255, 255, 0.85);
  text-shadow: 0 0 18px rgba(95, 243, 255, 0.55);
  opacity: 0;
  transform: translateY(12px);
  transition: opacity 0.35s ease, transform 0.35s ease;
}

.video-transition--active .video-transition__label {
  opacity: 1;
  transform: translateY(0);
}

.equalizer {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 24px;
}

.equalizer__bar {
  width: 12px;
  height: 44px;
  border-radius: 8px;
  background: linear-gradient(180deg, #5ff3ff 0%, #ff67ff 50%, #ffcf64 100%);
  box-shadow: 0 0 10px rgba(95, 243, 255, 0.5);
  animation: equalize 1.3s ease-in-out infinite;
  transform-origin: bottom;
}

.equalizer__bar:nth-child(2) {
  animation-delay: 0.2s;
}

.equalizer__bar:nth-child(3) {
  animation-delay: 0.4s;
}

.equalizer__bar:nth-child(4) {
  animation-delay: 0.6s;
}

.equalizer__bar:nth-child(5) {
  animation-delay: 0.8s;
}

.numbers-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  flex: 1;
}

.numbers-title {
  text-transform: uppercase;
  letter-spacing: 0.18em;
  color: rgba(236, 248, 255, 0.92);
}

.neon-divider {
  opacity: 0.5;
  border-color: rgba(255, 255, 255, 0.25) !important;
}

.numbers-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  justify-content: center;
}

.numbers-empty {
  margin: 0;
}

.neon-chip {
  background: linear-gradient(135deg, rgba(95, 243, 255, 0.2), rgba(255, 103, 255, 0.25));
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #fdfcff !important;
  box-shadow: 0 12px 24px rgba(69, 246, 255, 0.22);
  transition: transform 0.2s ease;
}

.neon-chip:hover {
  transform: translateY(-3px) scale(1.03);
}

.glow-btn {
  font-weight: 600;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  box-shadow: 0 0 18px rgba(95, 243, 255, 0.35);
}

.glow-btn--outline {
  box-shadow: inset 0 0 0 1px rgba(95, 243, 255, 0.45);
}

.neon-panel {
  border-radius: 18px;
  background: linear-gradient(135deg, rgba(16, 9, 55, 0.92), rgba(33, 14, 82, 0.8));
  padding: clamp(1rem, 2vw, 1.25rem);
  border: 1px solid rgba(95, 243, 255, 0.16);
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.05);
}

.status-panel {
  min-height: 90px;
}

.waiting-panel {
  font-size: 1.05rem;
  line-height: 1.6;
}

:deep(.v-alert) {
  background: rgba(255, 83, 130, 0.12);
  border: 1px solid rgba(255, 83, 130, 0.35);
  color: #ff9bbd;
}

:deep(.v-progress-circular__underlay),
:deep(.v-progress-circular__overlay) {
  stroke: rgba(95, 243, 255, 0.65);
}

@keyframes equalize {
  0%,
  100% {
    transform: scaleY(0.3);
  }
  50% {
    transform: scaleY(1);
  }
}

@media (max-width: 960px) {
  .neon-title {
    text-align: center;
  }

  .neon-subtitle {
    text-align: center;
  }

  .lighting--one,
  .lighting--two {
    opacity: 0.6;
    filter: blur(160px);
  }

  .video-stage-wrapper {
    margin-inline: clamp(0.5rem, 4vw, 1.5rem);
  }
}
</style>
