<template>
  <v-app class="neon-app">
    <v-main>
      <v-container class="py-10 neon-container" fluid>
        <div class="lighting lighting--one"></div>
        <div class="lighting lighting--two"></div>
        <v-row justify="center" align="stretch" class="g-8">
          <v-col cols="12" md="8">
            <v-card elevation="18" class="pa-6 neon-card control-card" rounded="xl">
              <v-card-title class="neon-title mb-2">
                <span class="title-highlight">Hit</span>ster Bingo Musical
              </v-card-title>
              <v-card-subtitle class="neon-subtitle mb-6">
                Reproduce 30 segundos de canciones aleatorias y descubre quién canta bingo primero.
              </v-card-subtitle>

          <v-col cols="12" xl="4" class="d-flex flex-column ga-6">
            <v-card elevation="18" class="pa-6 neon-card control-card" rounded="xl">
              <v-card-text class="pa-0">
                <div class="d-flex flex-column ga-6">
                  <div class="d-flex flex-wrap ga-4">
                    <v-btn
                      color="primary"
                      size="large"
                      class="glow-btn"
                      :disabled="!canStart || isRunning"
                      @click="startBingo"
                    >
                      Iniciar
                    </v-btn>
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

                  <div class="status-panel neon-panel">
                    <template v-if="isLoading">
                      <div class="d-flex align-center ga-3">
                        <v-progress-circular indeterminate color="primary" />
                        <span>Cargando canciones...</span>
                      </div>
                    </template>
                    <template v-else-if="loadError">
                      <v-alert type="error" border="start" prominent>
                        No fue posible cargar las canciones. {{ loadError }}
                      </v-alert>
                    </template>
                    <template v-else>
                      <div class="d-flex flex-column ga-1">
                        <div class="text-subtitle-2">
                          Canciones cargadas: {{ songs.length }} | Restantes: {{ remainingSongsCount }}
                        </div>
                        <div v-if="hasCompleted" class="text-success text-subtitle-1 font-weight-medium">
                          ¡Todas las canciones han sonado!
                        </div>
                        <div v-else-if="currentSong">
                          <span class="text-h6 font-weight-medium">
                            Sonando: {{ currentSong.nombre }}
                          </span>
                        </div>
                      </div>
                    </template>
                  </div>

                  <div class="video-wrapper" v-if="videoReady">
                    <v-responsive aspect-ratio="16/9" class="video-stage">
                      <iframe
                        :key="videoKey"
                        :src="videoSrc"
                        title="Reproducción de canción"
                        allow="autoplay; encrypted-media; accelerometer"
                        allowfullscreen
                      ></iframe>
                    </v-responsive>
                  </div>
                  <v-sheet
                    v-else
                    class="d-flex align-center justify-center text-center py-12 neon-panel waiting-panel"
                    color="rgba(8, 8, 30, 0.75)"
                    rounded="xl"
                    elevation="6"
                  >
                    <div class="text-body-1 font-weight-medium">
                      Presiona <strong>Iniciar</strong> para comenzar la primera canción del bingo.
                    </div>
                  </v-sheet>

                  <div class="equalizer">
                    <span v-for="bar in 5" :key="`bar-${bar}`" class="equalizer__bar"></span>
                  </div>
                </div>
              </v-card-text>
            </v-card>

          <v-col cols="12" md="4">
            <v-card elevation="16" class="pa-5 neon-card numbers-card" rounded="xl">
              <v-card-title class="text-h5 font-weight-bold pb-3 numbers-title">
                Números cantados
              </v-card-title>
              <v-divider class="mb-5 neon-divider"></v-divider>
              <div class="numbers-grid" v-if="drawnNumbers.length">
                <v-chip
                  v-for="(number, index) in drawnNumbers"
                  :key="`number-${number}-${index}`"
                  color="accent"
                  variant="elevated"
                  class="ma-1 text-subtitle-2 neon-chip"
                >
                  {{ number }}
                </v-chip>
              </div>
              <div v-else class="text-body-2 text-medium-emphasis">
                Aún no se ha cantado ningún número. ¡Sé el primero en escuchar tu canción!
              </div>
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

const scheduleNextSong = () => {
  clearTimeout(songTimeoutId);
  songTimeoutId = setTimeout(() => {
    if (isRunning.value) {
      playNextSong();
    }
  }, 30000);
};

const clearTransitionTimers = () => {
  clearTimeout(transitionTimeoutId);
  clearTimeout(transitionResetTimeoutId);
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
  }, 450);

  transitionResetTimeoutId = setTimeout(() => {
    isTransitioning.value = false;
  }, 1100);
};

const playNextSong = () => {
  if (!songs.value.length) {
    return;
  }

  const pendingSongs = songs.value.filter(
    (song) => !drawnNumbers.value.includes(song.numero)
  );

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

const finishBingo = () => {
  isRunning.value = false;
  clearTimeout(songTimeoutId);
  clearTransitionTimers();
  isTransitioning.value = false;
  videoSrc.value = '';
};

const canStart = computed(() => !isLoading.value && !loadError.value && songs.value.length > 0);
const hasCompleted = computed(
  () => !isLoading.value && songs.value.length > 0 && drawnNumbers.value.length === songs.value.length
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

.neon-title {
  font-family: 'Monoton', cursive;
  font-size: clamp(2.4rem, 4vw, 3rem);
  letter-spacing: 0.25em;
  text-transform: uppercase;
  color: #f8f3ff;
  text-shadow: 0 0 10px rgba(255, 80, 190, 0.9), 0 0 25px rgba(255, 80, 190, 0.7),
    0 0 40px rgba(255, 80, 190, 0.35);
  display: flex;
  align-items: center;
  gap: 0.45rem;
}

.title-highlight {
  color: #45f6ff;
  text-shadow: 0 0 12px rgba(69, 246, 255, 0.9), 0 0 30px rgba(69, 246, 255, 0.6);
}

.neon-subtitle {
  color: rgba(216, 219, 255, 0.9);
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.glow-btn {
  border-radius: 999px;
  padding-inline: 2.75rem;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  background: linear-gradient(135deg, #ff008c, #ff5f5f);
  color: #fff !important;
  box-shadow: 0 18px 35px rgba(255, 0, 140, 0.35);
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.glow-btn--outline {
  background: transparent;
  color: #5ff3ff !important;
  border: 2px solid rgba(95, 243, 255, 0.65);
  box-shadow: 0 18px 30px rgba(95, 243, 255, 0.25);
}

.glow-btn:hover {
  transform: translateY(-2px) scale(1.02);
  box-shadow: 0 22px 40px rgba(255, 0, 140, 0.45);
}

.glow-btn--outline:hover {
  box-shadow: 0 22px 40px rgba(95, 243, 255, 0.35);
  background: linear-gradient(135deg, rgba(95, 243, 255, 0.2), rgba(95, 243, 255, 0.05));
}

.status-panel {
  min-height: 90px;
}

.neon-panel {
  background: rgba(14, 8, 47, 0.65);
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 18px;
  padding: 1.25rem 1.5rem;
  box-shadow: inset 0 0 30px rgba(255, 255, 255, 0.08);
}

.waiting-panel {
  font-size: 1.05rem;
  line-height: 1.6;
}

.waiting-panel {
  font-size: 1.05rem;
  line-height: 1.6;
}

.video-stage-wrapper {
  position: relative;
  border-radius: 24px;
  overflow: hidden;
  border-radius: 20px;
  box-shadow: 0 25px 45px rgba(8, 0, 30, 0.6);
}

.video-stage {
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  background: linear-gradient(145deg, rgba(12, 5, 46, 0.9), rgba(27, 9, 66, 0.8));
}

.equalizer {
  display: flex;
  justify-content: center;
  gap: 10px;
  margin-top: 10px;
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
}

.neon-chip {
  background: linear-gradient(135deg, rgba(95, 243, 255, 0.2), rgba(255, 103, 255, 0.25));
  border: 1px solid rgba(255, 255, 255, 0.25);
  color: #fdfcff !important;
  box-shadow: 0 12px 24px rgba(69, 246, 255, 0.22);
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
    justify-content: center;
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
}
</style>
