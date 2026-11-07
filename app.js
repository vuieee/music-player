(() => {
  const tracks = [
    { title: "It's 5 a.m. and I Couldn't Sleep", artist: "Local Audio", file: "it's 5a.m and i couldn't sleep.mp3", duration: 4036.21 },
    { title: "Late Night Lofi", artist: "Local Audio", file: "late night lofi.mp3", duration: 3730.08 }
  ];

  const audio = document.getElementById("audioPlayer");
  const playlist = document.getElementById("playlist");
  const title = document.getElementById("trackTitle");
  const artist = document.getElementById("trackArtist");
  const position = document.getElementById("trackPosition");
  const status = document.getElementById("playerStatus");
  const timeline = document.getElementById("timeline");
  const currentTime = document.getElementById("currentTime");
  const duration = document.getElementById("duration");
  const volume = document.getElementById("volume");
  const volumeValue = document.getElementById("volumeValue");
  const playButton = document.getElementById("playButton");
  const playIcon = document.getElementById("playIcon");
  const previousButton = document.getElementById("previousButton");
  const nextButton = document.getElementById("nextButton");
  const emptyMessage = document.getElementById("emptyMessage");
  const visualizer = document.getElementById("visualizer");
  const bars = [];
  const metadataPlayers = [];
  let currentIndex = -1;
  let audioContext;
  let analyser;
  let frequencyData;
  let animationFrame = 0;
  let visualizerPhase = 0;

  for (let index = 0; index < 36; index += 1) {
    const bar = document.createElement("span");
    bar.className = "visualizer-bar";
    visualizer.append(bar);
    bars.push(bar);
  }

  function formatTime(seconds) {
    if (!Number.isFinite(seconds) || seconds < 0) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const remainder = Math.floor(seconds % 60);
    return `${minutes}:${String(remainder).padStart(2, "0")}`;
  }

  function setStatus(message, state = "") {
    status.textContent = message;
    status.dataset.state = state;
  }

  function updateTimeline() {
    const total = Number.isFinite(audio.duration) ? audio.duration : 0;
    const current = Number.isFinite(audio.currentTime) ? audio.currentTime : 0;
    timeline.max = String(total);
    timeline.value = String(Math.min(current, total));
    timeline.disabled = total <= 0;
    updateRangeProgress(timeline);
    currentTime.textContent = formatTime(current);
    duration.textContent = formatTime(total);
  }

  function updateRangeProgress(input) {
    const min = Number(input.min) || 0;
    const max = Number(input.max);
    const value = Number(input.value);
    const progress = max > min ? ((value - min) / (max - min)) * 100 : 0;
    input.style.setProperty("--range-progress", `${progress}%`);
  }

  function updatePlaybackState() {
    const playing = !audio.paused && !audio.ended;
    playButton.setAttribute("aria-label", playing ? "Pause" : "Play");
    playIcon.textContent = playing ? "PAUSE" : "PLAY";
    if (playing) {
      setStatus("PLAYING", "playing");
      startVisualizer();
    } else {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
      bars.forEach(bar => { bar.style.height = "3px"; });
      if (!audio.error) setStatus(currentIndex === -1 ? "READY" : "PAUSED");
    }
  }

  function createAnalyser() {
    if (analyser || !window.AudioContext) return;
    try {
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      analyser.smoothingTimeConstant = 0.78;
      audioContext.createMediaElementSource(audio).connect(analyser);
      analyser.connect(audioContext.destination);
      frequencyData = new Uint8Array(analyser.frequencyBinCount);
    } catch (error) {
      console.warn("Audio visualizer is unavailable:", error);
      analyser = null;
    }
  }

  function drawVisualizer() {
    animationFrame = 0;
    if (audio.paused) return;
    if (analyser && frequencyData) analyser.getByteFrequencyData(frequencyData);
    visualizerPhase += 0.08;

    bars.forEach((bar, index) => {
      const bin = analyser && frequencyData ?
        frequencyData[Math.min(frequencyData.length - 1, Math.floor(index * frequencyData.length / bars.length))] / 255 :
        0.12 + Math.abs(Math.sin(visualizerPhase + index * 0.7)) * 0.48;
      bar.style.height = `${Math.max(3, Math.sqrt(bin) * 84)}px`;
    });
    animationFrame = requestAnimationFrame(drawVisualizer);
  }

  function startVisualizer() {
    if (!animationFrame) animationFrame = requestAnimationFrame(drawVisualizer);
  }

  function renderPlaylist() {
    playlist.replaceChildren();
    tracks.forEach((track, index) => {
      const item = document.createElement("li");
      const button = document.createElement("button");
      button.type = "button";
      button.className = "playlist-item";
      button.setAttribute("aria-current", index === currentIndex ? "true" : "false");

      const number = document.createElement("span");
      number.className = "playlist-number";
      number.textContent = String(index + 1).padStart(2, "0");
      const name = document.createElement("span");
      name.className = "playlist-name";
      name.textContent = track.title;
      name.title = track.title;
      const length = document.createElement("span");
      length.className = "playlist-duration";
      const trackDuration = index === currentIndex && Number.isFinite(audio.duration) ?
        audio.duration :
        track.duration;
      length.textContent = Number.isFinite(trackDuration) ? formatTime(trackDuration) : "--:--";

      button.append(number, name, length);
      button.addEventListener("click", () => selectTrack(index, true));
      item.append(button);
      playlist.append(item);
    });
  }

  function selectTrack(index, shouldPlay = false) {
    if (index < 0 || index >= tracks.length) return;
    currentIndex = index;
    const track = tracks[index];
    title.textContent = track.title;
    title.title = track.title;
    artist.textContent = track.artist;
    position.textContent = `${String(index + 1).padStart(2, "0")} / ${String(tracks.length).padStart(2, "0")}`;
    audio.src = `music/${encodeURIComponent(track.file)}`;
    audio.load();
    timeline.value = "0";
    currentTime.textContent = "0:00";
    duration.textContent = "0:00";
    renderPlaylist();
    if (shouldPlay) playTrack();
    else setStatus("READY");
  }

  async function playTrack() {
    if (currentIndex < 0 && tracks.length) selectTrack(0);
    if (currentIndex < 0) return;
    createAnalyser();
    if (audioContext?.state === "suspended") await audioContext.resume();

    try {
      await audio.play();
    } catch (error) {
      if (error.name !== "AbortError") {
        console.error("Unable to play this track:", error);
        setStatus("TRACK UNAVAILABLE", "error");
      }
    }
  }

  function preloadPlaylistDurations() {
    tracks.forEach(track => {
      const metadataAudio = new Audio();
      metadataAudio.preload = "metadata";
      metadataAudio.addEventListener("loadedmetadata", () => {
        if (!Number.isFinite(metadataAudio.duration)) return;
        track.duration = metadataAudio.duration;
        renderPlaylist();
        if (tracks[currentIndex] === track) updateTimeline();
      }, { once: true });
      metadataAudio.src = `music/${encodeURIComponent(track.file)}`;
      metadataAudio.load();
      metadataPlayers.push(metadataAudio);
    });
  }

  function pauseTrack() {
    audio.pause();
  }

  function nextTrack() {
    if (tracks.length) selectTrack((currentIndex + 1) % tracks.length, true);
  }

  function previousTrack() {
    if (!tracks.length) return;
    if (audio.currentTime > 3) {
      audio.currentTime = 0;
      return;
    }
    selectTrack((currentIndex - 1 + tracks.length) % tracks.length, true);
  }

  document.getElementById("playlistCount").textContent = `${String(tracks.length).padStart(2, "0")} TRACKS`;
  emptyMessage.classList.toggle("hidden", tracks.length > 0);
  playButton.disabled = tracks.length === 0;
  previousButton.disabled = tracks.length < 2;
  nextButton.disabled = tracks.length < 2;
  audio.volume = Number(volume.value);
  volumeValue.value = `${Math.round(audio.volume * 100)}%`;
  volumeValue.textContent = volumeValue.value;
  updateRangeProgress(volume);
  preloadPlaylistDurations();
  renderPlaylist();
  if (tracks.length) selectTrack(0);

  playButton.addEventListener("click", () => {
    if (audio.paused) playTrack();
    else pauseTrack();
  });
  previousButton.addEventListener("click", previousTrack);
  nextButton.addEventListener("click", nextTrack);
  volume.addEventListener("input", () => {
    audio.volume = Number(volume.value);
    updateRangeProgress(volume);
    volumeValue.value = `${Math.round(audio.volume * 100)}%`;
    volumeValue.textContent = volumeValue.value;
  });
  timeline.addEventListener("input", () => {
    if (Number.isFinite(audio.duration)) {
      audio.currentTime = Number(timeline.value);
      updateRangeProgress(timeline);
      currentTime.textContent = formatTime(audio.currentTime);
    }
  });

  audio.addEventListener("loadedmetadata", () => {
    updateTimeline();
    renderPlaylist();
  });
  audio.addEventListener("durationchange", updateTimeline);
  audio.addEventListener("timeupdate", updateTimeline);
  audio.addEventListener("play", updatePlaybackState);
  audio.addEventListener("pause", updatePlaybackState);
  audio.addEventListener("ended", nextTrack);
  audio.addEventListener("error", () => {
    if (currentIndex >= 0) setStatus("ADD TRACK TO MUSIC FOLDER", "error");
  });
})();
