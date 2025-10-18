<template>
  <v-app class="neon-app">
    <v-main>
      <v-container class="py-4 neon-container fill-vh" fluid>
        <div class="lighting lighting--one"></div>
        <div class="lighting lighting--two"></div>

        <v-row justify="center" align="start" class="g-8 center-stage">
          <v-col cols="12" md="9" lg="10">
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

          <v-col cols="12" md="3" lg="2">
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
                  >Iniciar</v-btn
                >
              </div>
            </v-card>
          </v-col>
        </v-row>
      </v-container>
    </v-main>
  </v-app>
</template>

<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from "vue";

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

const scheduleNextSong = () => {
  clearTimeout(songTimeoutId);
  songTimeoutId = setTimeout(() => {
    if (isRunning.value) {
      playNextSong();
    }
  }, 30000);
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
  // detener reproducción limpiando src para que iframe deje de reproducir
  videoSrc.value = "";
  videoKey.value += 1;
};

const finishBingo = () => {
  isRunning.value = false;
  clearTimeout(songTimeoutId);
  videoSrc.value = "";
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
</script>

<style scoped>
.neon-app {
  background: transparent;
  color: #f7f5ff;
}

.neon-container {
  position: relative;
  isolation: isolate;
  min-height: 100vh;
  overflow: hidden;
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
  background: linear-gradient(
    145deg,
    rgba(22, 12, 61, 0.92),
    rgba(44, 16, 106, 0.8)
  );
  border: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: 0 25px 45px rgba(2, 0, 36, 0.45),
    inset 0 0 0 1px rgba(255, 255, 255, 0.05);
  backdrop-filter: blur(18px);
  z-index: 1;
}

.neon-title {
  font-family: "Monoton", cursive;
  font-size: clamp(2.4rem, 4vw, 3rem);
  letter-spacing: 0.25em;
  color: #ff7cf4;
  text-shadow: 0 0 12px rgba(255, 171, 255, 0.9);
  display: flex;
  gap: 0.45rem;
}
.title-highlight {
  color: #45f6ff;
  text-shadow: 0 0 12px rgba(69, 246, 255, 0.9);
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
}
.glow-btn--outline {
  background: transparent;
  color: #5ff3ff !important;
  border: 2px solid rgba(95, 243, 255, 0.65);
}

.video-wrapper {
  overflow: hidden;
  border-radius: 20px;
  box-shadow: 0 25px 45px rgba(8, 0, 30, 0.6);
  width: 100%;
  height: min(82vh, 1000px);
  min-height: 480px;
  max-height: calc(100vh - 110px);
  margin: 0 auto;
}

.center-stage {
  min-height: auto;
  align-items: flex-start;
  justify-content: center;
  padding-top: 4px;
}

.video-stage {
  height: 100%;
  width: 100%;
  border-radius: inherit;
  box-shadow: inset 0 0 0 1px rgba(255, 255, 255, 0.12);
  background: linear-gradient(
    145deg,
    rgba(12, 5, 46, 0.9),
    rgba(27, 9, 66, 0.8)
  );
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
}

.video-iframe {
  width: 100% !important;
  height: 100% !important;
  display: block;
  border: 0;
  min-height: 420px;
  background: linear-gradient(
    180deg,
    rgba(10, 10, 20, 0.6),
    rgba(20, 15, 40, 0.6)
  );
  will-change: opacity, transform;
}

/* numbers column and chips */
.numbers-col {
  display: flex;
  align-items: flex-start;
}
.numbers-card {
  height: 100%;
  display: flex;
  flex-direction: column;
  max-height: calc(100vh - 120px);
  overflow: hidden;
}
.numbers-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
  justify-content: flex-start;
  align-items: flex-start;
  --chip-size: 88px;
}
.neon-chip {
  min-width: var(--chip-size, 88px);
  max-width: calc(var(--chip-size, 88px) * 1.4);
  display: inline-flex;
  justify-content: center;
  align-items: center;
  padding: 0.45rem 0.75rem;
  font-size: clamp(0.8rem, calc(var(--chip-size, 88px) / 12), 1.05rem);
  border-radius: 12px;
  transition: all 180ms ease;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.current-number-block {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  padding: 1rem 0.8rem;
  border-radius: 14px;
  text-align: center;
  background: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.03),
    rgba(255, 255, 255, 0.01)
  );
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 18px 40px rgba(0, 0, 0, 0.45);
}

.current-number-label {
  font-size: 0.75rem;
  color: rgba(225, 230, 255, 0.75);
  letter-spacing: 0.12em;
  text-transform: uppercase;
}
.current-number-value {
  font-weight: 800;
  color: #fff;
  line-height: 1;
  font-size: clamp(2.6rem, 6vw, 4.8rem);
  text-shadow: 0 6px 30px rgba(69, 246, 255, 0.12);
}
.current-number-title {
  font-size: 0.9rem;
  color: rgba(220, 225, 255, 0.9);
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.numbers-controls {
  gap: 0.75rem;
  margin-top: 1rem;
}

/* transitions */
.crossfade-enter-active,
.crossfade-leave-active {
  transition: opacity 700ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 700ms cubic-bezier(0.22, 1, 0.36, 1);
}
.crossfade-enter-from,
.crossfade-leave-to {
  opacity: 0;
  transform: scale(0.992);
}
.crossfade-enter-to,
.crossfade-leave-from {
  opacity: 1;
  transform: scale(1);
}

.slide-fade-enter-active,
.slide-fade-leave-active {
  transition: opacity 520ms cubic-bezier(0.22, 1, 0.36, 1),
    transform 520ms cubic-bezier(0.22, 1, 0.36, 1);
}
.slide-fade-enter-from {
  opacity: 0;
  transform: translateY(-10px);
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
  transition: transform 360ms cubic-bezier(0.22, 1, 0.36, 1), opacity 360ms ease;
}
.chip-pop-leave-active {
  transition: opacity 260ms ease, transform 260ms ease;
}
.chip-pop-enter-from {
  opacity: 0;
  transform: translateY(-6px) scale(0.94);
}
.chip-pop-enter-to {
  opacity: 1;
  transform: translateY(0) scale(1);
}
.chip-pop-leave-to {
  opacity: 0;
  transform: translateY(-6px) scale(0.96);
}

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
