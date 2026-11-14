/**
 * SuaraKaca - Text to Speech Frontend Logic
 * Implements Spotify-inspired Liquid Glass Player & Audio Synthesizer
 */

(function () {
  'use strict';

  // Preset sample texts
  const PRESET_TEXTS = {
    naratif: "Di antara deburan ombak pantai selatan dan keheningan perbukitan, sebuah kisah lama kembali terdengar. Waktu seolah berhenti sejenak, mengizinkan setiap kata meresap ke dalam sanubari para pendengarnya.",
    ceria: "Halo teman-teman semua! Selamat datang di hari yang cerah dan penuh semangat ini. Jangan lupa tersenyum dan mari kita mulai petualangan baru bersama-sama hari ini!",
    sedih: "Kala senja perlahan meredup di ufuk barat, hanya tersisa kenangan manis yang tak lagi bisa disentuh. Ruang ini menjadi begitu sunyi tanpa senyum hangatmu lagi di sini."
  };

  // State Management
  const state = {
    selectedVoice: 'id-ID-GadisNeural',
    selectedVoiceName: 'Gadis (Perempuan)',
    selectedTone: 'naratif',
    selectedToneName: 'Naratif',
    rateAdjust: 0,
    pitchAdjust: 0,
    audioBlobMp3: null,
    audioBlobWav: null,
    audioBuffer: null,
    audioUrlMp3: null,
    audioUrlWav: null,
    isPlaying: false,
    duration: 0,
    currentTime: 0,
    volume: 1.0,
    isMuted: false
  };

  // DOM Elements
  const speechText = document.getElementById('speechText');
  const charCounter = document.getElementById('charCounter');
  const clearTextBtn = document.getElementById('clearTextBtn');
  const errorToast = document.getElementById('errorToast');
  const errorMessage = document.getElementById('errorMessage');
  const errorCloseBtn = document.getElementById('errorCloseBtn');

  const voiceCards = document.querySelectorAll('[data-voice]');
  const toneCards = document.querySelectorAll('[data-tone]');
  const presetButtons = document.querySelectorAll('[data-preset]');

  const rateSlider = document.getElementById('rateSlider');
  const rateValue = document.getElementById('rateValue');
  const pitchSlider = document.getElementById('pitchSlider');
  const pitchValue = document.getElementById('pitchValue');

  const generateBtn = document.getElementById('generateBtn');
  const generateBtnText = document.getElementById('generateBtnText');
  const generateIcon = document.getElementById('generateIcon');
  const loadingSpinner = document.getElementById('loadingSpinner');

  // Player Elements
  const playerDock = document.getElementById('playerDock');
  const playerAvatar = document.getElementById('playerAvatar');
  const playerTitle = document.getElementById('playerTitle');
  const playerSubtitle = document.getElementById('playerSubtitle');
  const playPauseBtn = document.getElementById('playPauseBtn');
  const playIcon = document.getElementById('playIcon');
  const pauseIcon = document.getElementById('pauseIcon');
  const rewindBtn = document.getElementById('rewindBtn');
  const forwardBtn = document.getElementById('forwardBtn');
  const progressTrack = document.getElementById('progressTrack');
  const progressFill = document.getElementById('progressFill');
  const currentTimeEl = document.getElementById('currentTime');
  const durationTimeEl = document.getElementById('durationTime');

  const visualizerCanvas = document.getElementById('visualizerCanvas');
  const canvasCtx = visualizerCanvas.getContext('2d');
  const muteBtn = document.getElementById('muteBtn');
  const volumeSlider = document.getElementById('volumeSlider');
  const downloadMp3Btn = document.getElementById('downloadMp3Btn');
  const downloadWavBtn = document.getElementById('downloadWavBtn');

  // HTML5 Audio Element & Web Audio API
  const audio = new Audio();
  let audioCtx = null;
  let analyserNode = null;
  let sourceNode = null;
  let visualizerAnimId = null;

  // Initialize Web Audio Context on first user action
  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 64;
      try {
        sourceNode = audioCtx.createMediaElementSource(audio);
        sourceNode.connect(analyserNode);
        analyserNode.connect(audioCtx.destination);
      } catch (e) {
        console.warn('Audio node connection warning:', e);
      }
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // Formatting helper: seconds to mm:ss
  function formatTime(seconds) {
    if (isNaN(seconds) || seconds < 0) return '0:00';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  }

  // Error Toast Management
  function showError(msg) {
    errorMessage.textContent = msg;
    errorToast.classList.add('visible');
  }

  function hideError() {
    errorToast.classList.remove('visible');
  }

  errorCloseBtn.addEventListener('click', hideError);

  // Character Counter & Clear Action
  speechText.addEventListener('input', function () {
    const len = speechText.value.length;
    charCounter.textContent = `${len} / 4000 karakter`;
    if (errorToast.classList.contains('visible')) {
      hideError();
    }
  });

  clearTextBtn.addEventListener('click', function () {
    speechText.value = '';
    charCounter.textContent = '0 / 4000 karakter';
    speechText.focus();
  });

  // Preset Chips Handlers
  presetButtons.forEach(btn => {
    btn.addEventListener('click', function () {
      const presetKey = this.getAttribute('data-preset');
      if (PRESET_TEXTS[presetKey]) {
        speechText.value = PRESET_TEXTS[presetKey];
        charCounter.textContent = `${speechText.value.length} / 4000 karakter`;
        // Select corresponding tone
        selectTone(presetKey);
      }
    });
  });

  // Voice Selection (Keyboard & Click)
  function selectVoice(voiceId, element) {
    voiceCards.forEach(card => {
      card.classList.remove('active');
      card.setAttribute('aria-checked', 'false');
    });
    element.classList.add('active');
    element.setAttribute('aria-checked', 'true');
    state.selectedVoice = voiceId;
    state.selectedVoiceName = voiceId === 'id-ID-ArdiNeural' ? 'Ardi (Laki-laki)' : 'Gadis (Perempuan)';
    updateDockSubtitle();
  }

  voiceCards.forEach(card => {
    card.addEventListener('click', function () {
      selectVoice(this.getAttribute('data-voice'), this);
    });
    card.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        selectVoice(this.getAttribute('data-voice'), this);
      }
    });
  });

  // Tone Selection (Keyboard & Click)
  function selectTone(toneId) {
    const card = document.querySelector(`[data-tone="${toneId}"]`);
    if (!card) return;
    toneCards.forEach(c => {
      c.classList.remove('active');
      c.setAttribute('aria-checked', 'false');
    });
    card.classList.add('active');
    card.setAttribute('aria-checked', 'true');
    state.selectedTone = toneId;
    const names = {
      naratif: 'Naratif',
      ceria: 'Ceria',
      sedih: 'Sedih'
    };
    state.selectedToneName = names[toneId] || toneId;
    updateDockSubtitle();
  }

  toneCards.forEach(card => {
    card.addEventListener('click', function () {
      selectTone(this.getAttribute('data-tone'));
    });
    card.addEventListener('keydown', function (e) {
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        selectTone(this.getAttribute('data-tone'));
      }
    });
  });

  function updateDockSubtitle() {
    playerSubtitle.textContent = `${state.selectedVoiceName} • ${state.selectedToneName}`;
  }

  // Sliders fine-tuning
  rateSlider.addEventListener('input', function () {
    const val = parseInt(this.value, 10);
    state.rateAdjust = val;
    rateValue.textContent = val === 0 ? 'Normal (0%)' : `${val > 0 ? '+' : ''}${val}%`;
  });

  pitchSlider.addEventListener('input', function () {
    const val = parseInt(this.value, 10);
    state.pitchAdjust = val;
    pitchValue.textContent = val === 0 ? 'Normal (0Hz)' : `${val > 0 ? '+' : ''}${val}Hz`;
  });

  // Generate TTS Synthesis
  generateBtn.addEventListener('click', async function () {
    const text = speechText.value.trim();
    if (!text) {
      showError('Harap masukkan naskah teks terlebih dahulu.');
      speechText.focus();
      return;
    }

    hideError();
    initAudioContext();

    // Set Loading UI State (R-27)
    generateBtn.disabled = true;
    generateBtnText.textContent = 'Memproses Suara...';
    generateIcon.style.display = 'none';
    loadingSpinner.style.display = 'inline-block';

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: text,
          voice: state.selectedVoice,
          tone: state.selectedTone,
          rate_adjust: state.rateAdjust,
          pitch_adjust: state.pitchAdjust
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.detail || 'Gagal memproses suara. Periksa koneksi internet Anda.');
      }

      const mp3Blob = await response.blob();
      state.audioBlobMp3 = mp3Blob;

      // Revoke previous URLs to free memory
      if (state.audioUrlMp3) URL.revokeObjectURL(state.audioUrlMp3);
      if (state.audioUrlWav) URL.revokeObjectURL(state.audioUrlWav);

      state.audioUrlMp3 = URL.createObjectURL(mp3Blob);

      // Decode audio for WAV encoder and timeline
      const arrayBuffer = await mp3Blob.arrayBuffer();
      const decodedBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      state.audioBuffer = decodedBuffer;

      // Encode to 16-bit PCM WAV Lossless
      const wavBlob = window.audioBufferToWavBlob(decodedBuffer);
      state.audioBlobWav = wavBlob;
      state.audioUrlWav = URL.createObjectURL(wavBlob);

      // Load into audio element
      audio.src = state.audioUrlMp3;
      audio.load();

      // Update Player Dock State
      const previewTitle = text.length > 45 ? text.substring(0, 42) + '...' : text;
      playerTitle.textContent = `"${previewTitle}"`;
      updateDockSubtitle();

      // Enable player controls
      playPauseBtn.disabled = false;
      rewindBtn.disabled = false;
      forwardBtn.disabled = false;
      downloadMp3Btn.disabled = false;
      downloadWavBtn.disabled = false;

      // Start playback automatically for preview
      audio.play().then(() => {
        setPlayingState(true);
      }).catch(() => {
        setPlayingState(false);
      });

    } catch (err) {
      console.error(err);
      showError(err.message || 'Terjadi masalah teknis saat sintesis suara.');
    } finally {
      generateBtn.disabled = false;
      generateBtnText.textContent = 'Konversi ke Suara';
      loadingSpinner.style.display = 'none';
      generateIcon.style.display = 'inline-block';
    }
  });

  // Playback State Synchronizer
  function setPlayingState(playing) {
    state.isPlaying = playing;
    if (playing) {
      playIcon.style.display = 'none';
      pauseIcon.style.display = 'block';
      playPauseBtn.setAttribute('aria-label', 'Jeda audio');
      playerAvatar.classList.add('playing');
      startVisualizer();
    } else {
      playIcon.style.display = 'block';
      pauseIcon.style.display = 'none';
      playPauseBtn.setAttribute('aria-label', 'Putar audio');
      playerAvatar.classList.remove('playing');
      stopVisualizer();
    }
  }

  playPauseBtn.addEventListener('click', function () {
    if (!audio.src) return;
    initAudioContext();
    if (audio.paused) {
      audio.play().then(() => setPlayingState(true));
    } else {
      audio.pause();
      setPlayingState(false);
    }
  });

  rewindBtn.addEventListener('click', function () {
    if (audio.duration) {
      audio.currentTime = Math.max(0, audio.currentTime - 5);
    }
  });

  forwardBtn.addEventListener('click', function () {
    if (audio.duration) {
      audio.currentTime = Math.min(audio.duration, audio.currentTime + 5);
    }
  });

  // Progress and Time Updates
  audio.addEventListener('loadedmetadata', function () {
    state.duration = audio.duration;
    durationTimeEl.textContent = formatTime(audio.duration);
  });

  audio.addEventListener('timeupdate', function () {
    if (!audio.duration) return;
    const current = audio.currentTime;
    const dur = audio.duration;
    const percent = (current / dur) * 100;
    progressFill.style.width = `${percent}%`;
    currentTimeEl.textContent = formatTime(current);
    progressTrack.setAttribute('aria-valuenow', Math.round(percent));
  });

  audio.addEventListener('ended', function () {
    setPlayingState(false);
    progressFill.style.width = '0%';
    currentTimeEl.textContent = '0:00';
  });

  // Scrubber Click Seeking
  progressTrack.addEventListener('click', function (e) {
    if (!audio.duration) return;
    const rect = progressTrack.getBoundingClientRect();
    const pos = (e.clientX - rect.left) / rect.width;
    const clampedPos = Math.max(0, Math.min(1, pos));
    audio.currentTime = clampedPos * audio.duration;
  });

  // Keyboard navigation for progress scrubber
  progressTrack.addEventListener('keydown', function (e) {
    if (!audio.duration) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      audio.currentTime = Math.min(audio.duration, audio.currentTime + 3);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      audio.currentTime = Math.max(0, audio.currentTime - 3);
    }
  });

  // Volume & Mute Controls
  volumeSlider.addEventListener('input', function () {
    const val = parseFloat(this.value);
    audio.volume = val;
    state.volume = val;
    state.isMuted = val === 0;
  });

  muteBtn.addEventListener('click', function () {
    if (audio.volume > 0) {
      audio.volume = 0;
      volumeSlider.value = 0;
    } else {
      audio.volume = state.volume > 0 ? state.volume : 1.0;
      volumeSlider.value = audio.volume;
    }
  });

  // Download Handlers
  function triggerDownload(blob, extension) {
    if (!blob) return;
    const voiceCode = state.selectedVoice.includes('Ardi') ? 'laki' : 'perempuan';
    const filename = `suarakaca_${voiceCode}_${state.selectedTone}.${extension}`;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  downloadMp3Btn.addEventListener('click', function () {
    triggerDownload(state.audioBlobMp3, 'mp3');
  });

  downloadWavBtn.addEventListener('click', function () {
    triggerDownload(state.audioBlobWav, 'wav');
  });

  // Spotify-style Audio Wave Spectrum Visualizer (Canvas)
  function startVisualizer() {
    if (!analyserNode) return;
    const bufferLength = analyserNode.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    function draw() {
      visualizerAnimId = requestAnimationFrame(draw);
      analyserNode.getByteFrequencyData(dataArray);

      canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);

      const numBars = 14;
      const barWidth = 3;
      const gap = 2;
      const startX = (visualizerCanvas.width - (numBars * (barWidth + gap))) / 2;

      for (let i = 0; i < numBars; i++) {
        const index = Math.floor((i / numBars) * (bufferLength / 2));
        const val = dataArray[index] || 0;
        const barHeight = Math.max(3, (val / 255) * visualizerCanvas.height);
        const x = startX + i * (barWidth + gap);
        const y = visualizerCanvas.height - barHeight;

        // Spotify Green gradient
        canvasCtx.fillStyle = '#1db954';
        canvasCtx.beginPath();
        canvasCtx.roundRect(x, y, barWidth, barHeight, [2, 2, 0, 0]);
        canvasCtx.fill();
      }
    }

    if (!visualizerAnimId) {
      draw();
    }
  }

  function stopVisualizer() {
    if (visualizerAnimId) {
      cancelAnimationFrame(visualizerAnimId);
      visualizerAnimId = null;
    }
    // Draw calm baseline
    canvasCtx.clearRect(0, 0, visualizerCanvas.width, visualizerCanvas.height);
    const numBars = 14;
    const barWidth = 3;
    const gap = 2;
    const startX = (visualizerCanvas.width - (numBars * (barWidth + gap))) / 2;
    canvasCtx.fillStyle = 'rgba(255, 255, 255, 0.15)';
    for (let i = 0; i < numBars; i++) {
      const x = startX + i * (barWidth + gap);
      const y = visualizerCanvas.height - 3;
      canvasCtx.beginPath();
      canvasCtx.roundRect(x, y, barWidth, 3, [1, 1, 0, 0]);
      canvasCtx.fill();
    }
  }

  // Draw initial baseline
  stopVisualizer();

  // Profile Modal Logic
  const profileBtn = document.getElementById('profileBtn');
  const profileModal = document.getElementById('profileModal');
  const closeProfileModal = document.getElementById('closeProfileModal');

  function openModal() {
    profileModal.style.display = 'flex';
    // Trigger reflow for smooth transition
    void profileModal.offsetWidth;
    profileModal.classList.add('open');
    closeProfileModal.focus();
  }

  function closeModal() {
    profileModal.classList.remove('open');
    setTimeout(() => {
      profileModal.style.display = 'none';
      if (profileBtn) profileBtn.focus();
    }, 200);
  }

  if (profileBtn) {
    profileBtn.addEventListener('click', openModal);
  }

  if (closeProfileModal) {
    closeProfileModal.addEventListener('click', closeModal);
  }

  if (profileModal) {
    profileModal.addEventListener('click', function (e) {
      if (e.target === profileModal) {
        closeModal();
      }
    });
  }

  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && profileModal && profileModal.classList.contains('open')) {
      closeModal();
    }
  });

  // Set default initial sample text
  speechText.value = PRESET_TEXTS.naratif;
  charCounter.textContent = `${speechText.value.length} / 4000 karakter`;

})();
