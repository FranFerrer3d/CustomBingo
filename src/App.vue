<template>
  <v-app>
    <v-main>
      <v-container class="py-8" fluid>
        <v-row justify="center" align="stretch" class="g-6">
          <v-col cols="12" md="8">
            <v-card elevation="12" class="pa-6" rounded="xl">
              <v-card-title class="text-h4 font-weight-bold mb-2">
                🎵 Custom Bingo Musical
              </v-card-title>
              <v-card-subtitle class="text-subtitle-1 mb-6">
                Reproduce 30 segundos de canciones aleatorias y descubre quién canta bingo primero.
              </v-card-subtitle>

              <v-card-text class="pa-0">
                <div class="d-flex flex-column ga-4">
                  <div class="d-flex flex-wrap ga-3">
                    <v-btn
                      color="primary"
                      size="large"
                      :disabled="!canStart || isRunning"
                      @click="startBingo"
                    >
                      Iniciar
                    </v-btn>
                    <v-btn
                      color="secondary"
                      size="large"
                      variant="outlined"
                      :disabled="!isRunning"
                      @click="pauseBingo"
                    >
                      Pausa
                    </v-btn>
                  </div>

                  <div class="status-panel">
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
                    <v-responsive aspect-ratio="16/9">
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
                    class="d-flex align-center justify-center text-center py-12"
                    color="rgba(255,255,255,0.05)"
                    rounded="lg"
                    elevation="2"
                  >
                    <div class="text-body-1">
                      Presiona <strong>Iniciar</strong> para comenzar la primera canción del bingo.
                    </div>
                  </v-sheet>
                </div>
              </v-card-text>
            </v-card>
          </v-col>

          <v-col cols="12" md="4">
            <v-card elevation="10" class="pa-4" rounded="xl">
              <v-card-title class="text-h5 font-weight-bold pb-2">
                Números cantados
              </v-card-title>
              <v-divider class="mb-4"></v-divider>
              <div class="numbers-grid" v-if="drawnNumbers.length">
                <v-chip
                  v-for="(number, index) in drawnNumbers"
                  :key="`number-${number}-${index}`"
                  color="accent"
                  variant="elevated"
                  class="ma-1 text-subtitle-2"
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
let songTimeoutId = null;

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

const playSongVideo = (song) => {
  if (!song) {
    videoSrc.value = '';
    return;
  }
  const url = buildVideoUrl(song);
  videoKey.value += 1;
  videoSrc.value = `${url}&vkey=${videoKey.value}`;
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
  videoSrc.value = '';
  videoKey.value += 1;
};

const finishBingo = () => {
  isRunning.value = false;
  clearTimeout(songTimeoutId);
  videoSrc.value = '';
};

const canStart = computed(() => !isLoading.value && !loadError.value && songs.value.length > 0);
const hasCompleted = computed(
  () => !isLoading.value && songs.value.length > 0 && drawnNumbers.value.length === songs.value.length
);
const remainingSongsCount = computed(() => Math.max(songs.value.length - drawnNumbers.value.length, 0));
const videoReady = computed(() => Boolean(videoSrc.value));

onMounted(async () => {
  await fetchSongs();
});

onBeforeUnmount(() => {
  clearTimeout(songTimeoutId);
});
</script>

<style scoped>
.status-panel {
  min-height: 80px;
}

.video-wrapper {
  overflow: hidden;
  border-radius: 16px;
  box-shadow: 0 12px 35px rgba(0, 0, 0, 0.45);
}

.numbers-grid {
  display: flex;
  flex-wrap: wrap;
}
</style>
