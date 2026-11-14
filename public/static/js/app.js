/**
 * SuaraKaca - Text to Speech Frontend Logic
 * Implements Spotify-inspired Liquid Glass Player & Real-time Audio Studio Editor
 */

(function () {
  'use strict';

  // Preset sample texts
  const PRESET_TEXTS = {
    kreator: "Nah, tau nggak sih? Ternyata ada fakta menarik yang jarang banget dibahas soal ini. Yuk, kita kupas tuntas dalam waktu 60 detik aja!",
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
    isMuted: false,
    hasAudioLoaded: false,

    // Studio Real-time Edit State
    liveSpeed: 1.0,
    livePitch: 0,
    eqClarity: 0,
    eqBass: 0,
    reverbMode: 'dry',
    trimStart: 0,
    trimEnd: 0
  };

  // DOM Elements - Text & Config
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

  // Studio Audio Editor Elements
  const studioStatusPill = document.getElementById('studioStatusPill');
  const resetAudioEffectsBtn = document.getElementById('resetAudioEffectsBtn');
  const liveSpeedSlider = document.getElementById('liveSpeedSlider');
  const liveSpeedValue = document.getElementById('liveSpeedValue');
  const quickTempoChips = document.querySelectorAll('.mini-chip');
  const livePitchSlider = document.getElementById('livePitchSlider');
  const livePitchValue = document.getElementById('livePitchValue');
  const eqClaritySlider = document.getElementById('eqClaritySlider');
  const eqClarityValue = document.getElementById('eqClarityValue');
  const eqBassSlider = document.getElementById('eqBassSlider');
  const eqBassValue = document.getElementById('eqBassValue');
  const reverbCards = document.querySelectorAll('[data-reverb]');
  const trimStartSlider = document.getElementById('trimStartSlider');
  const trimStartValue = document.getElementById('trimStartValue');
  const trimEndSlider = document.getElementById('trimEndSlider');
  const trimEndValue = document.getElementById('trimEndValue');
  const previewTrimBtn = document.getElementById('previewTrimBtn');
  const resetTrimBtn = document.getElementById('resetTrimBtn');

  // HTML5 Audio Element & Web Audio API Graph
  const audio = new Audio();
  let audioCtx = null;
  let sourceNode = null;
  let clarityFilter = null;
  let warmthFilter = null;
  let convolverNode = null;
  let wetGain = null;
  let dryGain = null;
  let masterGain = null;
  let analyserNode = null;
  let visualizerAnimId = null;

  // Generate synthetic impulse response for studio room acoustics
  function createReverbImpulse(ctx, duration = 1.2, decay = 2.0) {
    const sampleRate = ctx.sampleRate;
    const length = Math.floor(sampleRate * duration);
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);
    for (let i = 0; i < length; i++) {
      const factor = Math.exp(-i / (sampleRate * (duration / decay)));
      left[i] = (Math.random() * 2 - 1) * factor;
      right[i] = (Math.random() * 2 - 1) * factor;
    }
    return impulse;
  }

  // Initialize Web Audio Context and effects graph on first user interaction
  function initAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      audioCtx = new AudioContextClass();

      // Equalizer Nodes
      clarityFilter = audioCtx.createBiquadFilter();
      clarityFilter.type = 'peaking';
      clarityFilter.frequency.value = 3200;
      clarityFilter.Q.value = 1.2;
      clarityFilter.gain.value = state.eqClarity;

      warmthFilter = audioCtx.createBiquadFilter();
      warmthFilter.type = 'lowshelf';
      warmthFilter.frequency.value = 200;
      warmthFilter.gain.value = state.eqBass;

      // Reverb Nodes
      convolverNode = audioCtx.createConvolver();
      convolverNode.buffer = createReverbImpulse(audioCtx, 1.2, 2.5);

      wetGain = audioCtx.createGain();
      wetGain.gain.value = 0.0;

      dryGain = audioCtx.createGain();
      dryGain.gain.value = 1.0;

      // Master & Analyser
      masterGain = audioCtx.createGain();
      analyserNode = audioCtx.createAnalyser();
      analyserNode.fftSize = 64;

      try {
        sourceNode = audioCtx.createMediaElementSource(audio);
        
        // Chain: source -> clarity -> warmth -> dry & wet -> master -> analyser -> out
        sourceNode.connect(clarityFilter);
        clarityFilter.connect(warmthFilter);

        // Dry path
        warmthFilter.connect(dryGain);
        dryGain.connect(masterGain);

        // Wet (Reverb) path
        warmthFilter.connect(convolverNode);
        convolverNode.connect(wetGain);
        wetGain.connect(masterGain);

        masterGain.connect(analyserNode);
        analyserNode.connect(audioCtx.destination);
      } catch (e) {
        console.warn('Audio graph connection notice:', e);
      }
    }
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
  }

  // Formatting helper: seconds to m:ss
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
      kreator: 'Kreator (Shorts)',
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

  // ==========================================================================
  // Real-time Audio Editing & Parameter Synchronization
  // ==========================================================================

  function updateLivePlaybackParameters() {
    if (!audio.src) return;
    initAudioContext();

    const semitones = state.livePitch;
    const pitchRatio = Math.pow(2, semitones / 12);

    if (semitones === 0) {
      audio.preservesPitch = true;
      audio.playbackRate = state.liveSpeed;
    } else {
      audio.preservesPitch = false;
      audio.playbackRate = Math.max(0.25, Math.min(3.0, state.liveSpeed * pitchRatio));
    }

    // Live Equalizer updates
    if (clarityFilter) {
      clarityFilter.gain.setTargetAtTime(state.eqClarity, audioCtx.currentTime, 0.04);
    }
    if (warmthFilter) {
      warmthFilter.gain.setTargetAtTime(state.eqBass, audioCtx.currentTime, 0.04);
    }

    // Live Reverb updates
    if (wetGain && dryGain) {
      if (state.reverbMode === 'dry') {
        wetGain.gain.setTargetAtTime(0.0, audioCtx.currentTime, 0.04);
        dryGain.gain.setTargetAtTime(1.0, audioCtx.currentTime, 0.04);
      } else if (state.reverbMode === 'room') {
        wetGain.gain.setTargetAtTime(0.35, audioCtx.currentTime, 0.04);
        dryGain.gain.setTargetAtTime(0.85, audioCtx.currentTime, 0.04);
      } else if (state.reverbMode === 'hall') {
        wetGain.gain.setTargetAtTime(0.65, audioCtx.currentTime, 0.04);
        dryGain.gain.setTargetAtTime(0.70, audioCtx.currentTime, 0.04);
      }
    }
  }

  // Upper Sliders (Rate & Pitch) - Synchronized with live audio review
  rateSlider.addEventListener('input', function () {
    const val = parseInt(this.value, 10);
    state.rateAdjust = val;
    rateValue.textContent = val === 0 ? 'Normal (0%)' : `${val > 0 ? '+' : ''}${val}%`;

    // Real-time review on already generated audio
    if (state.hasAudioLoaded) {
      const mappedSpeed = Math.round((1.0 + (val / 100)) * 20) / 20;
      state.liveSpeed = Math.max(0.5, Math.min(2.0, mappedSpeed));
      liveSpeedSlider.value = state.liveSpeed;
      liveSpeedValue.textContent = `${state.liveSpeed.toFixed(2)}x`;
      quickTempoChips.forEach(c => {
        c.classList.toggle('active', parseFloat(c.getAttribute('data-speed')) === state.liveSpeed);
      });
      updateLivePlaybackParameters();
    }
  });

  pitchSlider.addEventListener('input', function () {
    const val = parseInt(this.value, 10);
    state.pitchAdjust = val;
    pitchValue.textContent = val === 0 ? 'Normal (0Hz)' : `${val > 0 ? '+' : ''}${val}Hz`;

    // Real-time review on already generated audio
    if (state.hasAudioLoaded) {
      const mappedPitch = Math.round((val / 20) * 8);
      state.livePitch = Math.max(-10, Math.min(10, mappedPitch));
      livePitchSlider.value = state.livePitch;
      livePitchValue.textContent = state.livePitch === 0 ? 'Normal (0)' : `${state.livePitch > 0 ? '+' : ''}${state.livePitch}`;
      updateLivePlaybackParameters();
    }
  });

  // Studio Real-time Speed Slider & Chips
  liveSpeedSlider.addEventListener('input', function () {
    const spd = parseFloat(this.value);
    state.liveSpeed = spd;
    liveSpeedValue.textContent = `${spd.toFixed(2)}x ${spd === 1.0 ? '(Normal)' : ''}`;
    quickTempoChips.forEach(c => {
      c.classList.toggle('active', parseFloat(c.getAttribute('data-speed')) === spd);
    });
    updateLivePlaybackParameters();
  });

  quickTempoChips.forEach(chip => {
    chip.addEventListener('click', function () {
      const spd = parseFloat(this.getAttribute('data-speed'));
      state.liveSpeed = spd;
      liveSpeedSlider.value = spd;
      liveSpeedValue.textContent = `${spd.toFixed(2)}x ${spd === 1.0 ? '(Normal)' : ''}`;
      quickTempoChips.forEach(c => c.classList.remove('active'));
      this.classList.add('active');
      updateLivePlaybackParameters();
    });
  });

  // Studio Real-time Pitch Shift Slider
  livePitchSlider.addEventListener('input', function () {
    const p = parseInt(this.value, 10);
    state.livePitch = p;
    livePitchValue.textContent = p === 0 ? 'Normal (0)' : `${p > 0 ? '+' : ''}${p} semitone`;
    updateLivePlaybackParameters();
  });

  // Studio Equalizer Sliders
  eqClaritySlider.addEventListener('input', function () {
    const val = parseInt(this.value, 10);
    state.eqClarity = val;
    eqClarityValue.textContent = val === 0 ? '+0 dB (Flat)' : `+${val} dB ${val >= 6 ? '(Sangat Jernih)' : ''}`;
    updateLivePlaybackParameters();
  });

  eqBassSlider.addEventListener('input', function () {
    const val = parseInt(this.value, 10);
    state.eqBass = val;
    eqBassValue.textContent = val === 0 ? '+0 dB (Flat)' : `+${val} dB ${val >= 5 ? '(Empuk & Tebal)' : ''}`;
    updateLivePlaybackParameters();
  });

  // Studio Reverb Cards
  reverbCards.forEach(card => {
    card.addEventListener('click', function () {
      const mode = this.getAttribute('data-reverb');
      reverbCards.forEach(c => {
        c.classList.remove('active');
        c.setAttribute('aria-checked', 'false');
      });
      this.classList.add('active');
      this.setAttribute('aria-checked', 'true');
      state.reverbMode = mode;
      updateLivePlaybackParameters();
    });
  });

  // Studio Trimmer Handlers
  trimStartSlider.addEventListener('input', function () {
    let startVal = parseFloat(this.value);
    if (startVal >= state.trimEnd) {
      startVal = Math.max(0, state.trimEnd - 0.5);
      this.value = startVal;
    }
    state.trimStart = startVal;
    trimStartValue.textContent = `${startVal.toFixed(2)}s`;
  });

  trimEndSlider.addEventListener('input', function () {
    let endVal = parseFloat(this.value);
    if (endVal <= state.trimStart) {
      endVal = Math.min(state.duration, state.trimStart + 0.5);
      this.value = endVal;
    }
    state.trimEnd = endVal;
    trimEndValue.textContent = `${endVal.toFixed(2)}s`;
  });

  previewTrimBtn.addEventListener('click', function () {
    if (!audio.src) return;
    initAudioContext();
    audio.currentTime = state.trimStart;
    audio.play().then(() => setPlayingState(true));
  });

  resetTrimBtn.addEventListener('click', function () {
    if (!audio.src) return;
    state.trimStart = 0;
    state.trimEnd = state.duration;
    trimStartSlider.value = 0;
    trimStartValue.textContent = '0.00s';
    trimEndSlider.value = state.duration;
    trimEndValue.textContent = `${state.duration.toFixed(2)}s`;
  });

  // Reset All Audio Effects
  resetAudioEffectsBtn.addEventListener('click', function () {
    state.liveSpeed = 1.0;
    state.livePitch = 0;
    state.eqClarity = 0;
    state.eqBass = 0;
    state.reverbMode = 'dry';

    liveSpeedSlider.value = 1.0;
    liveSpeedValue.textContent = '1.0x (Normal)';
    quickTempoChips.forEach(c => c.classList.toggle('active', c.getAttribute('data-speed') === '1.0'));

    livePitchSlider.value = 0;
    livePitchValue.textContent = 'Normal (0)';

    eqClaritySlider.value = 0;
    eqClarityValue.textContent = '+0 dB (Flat)';

    eqBassSlider.value = 0;
    eqBassValue.textContent = '+0 dB (Flat)';

    reverbCards.forEach(c => {
      const isDry = c.getAttribute('data-reverb') === 'dry';
      c.classList.toggle('active', isDry);
      c.setAttribute('aria-checked', isDry ? 'true' : 'false');
    });

    if (state.duration) {
      state.trimStart = 0;
      state.trimEnd = state.duration;
      trimStartSlider.value = 0;
      trimStartValue.textContent = '0.00s';
      trimEndSlider.value = state.duration;
      trimEndValue.textContent = `${state.duration.toFixed(2)}s`;
    }

    updateLivePlaybackParameters();
  });

  // ==========================================================================
  // Generate TTS Synthesis
  // ==========================================================================

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

      state.hasAudioLoaded = true;

      // Update Trimmer limits
      state.duration = decodedBuffer.duration;
      state.trimStart = 0;
      state.trimEnd = decodedBuffer.duration;
      trimStartSlider.max = Math.ceil(decodedBuffer.duration);
      trimEndSlider.max = Math.ceil(decodedBuffer.duration);
      trimStartSlider.value = 0;
      trimEndSlider.value = decodedBuffer.duration;
      trimStartValue.textContent = '0.00s';
      trimEndValue.textContent = `${decodedBuffer.duration.toFixed(2)}s`;

      // Update Player Dock State
      const previewTitle = text.length > 45 ? text.substring(0, 42) + '...' : text;
      playerTitle.textContent = `"${previewTitle}"`;
      updateDockSubtitle();

      // Update Studio Status Pill
      studioStatusPill.textContent = 'Audio Aktif & Siap Diedit';
      studioStatusPill.classList.add('ready');

      // Enable player controls
      playPauseBtn.disabled = false;
      rewindBtn.disabled = false;
      forwardBtn.disabled = false;
      downloadMp3Btn.disabled = false;
      downloadWavBtn.disabled = false;

      // Apply any preset live parameters immediately
      updateLivePlaybackParameters();

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
      if (audio.currentTime < state.trimStart || audio.currentTime >= state.trimEnd) {
        audio.currentTime = state.trimStart;
      }
      audio.play().then(() => setPlayingState(true));
    } else {
      audio.pause();
      setPlayingState(false);
    }
  });

  rewindBtn.addEventListener('click', function () {
    if (audio.duration) {
      audio.currentTime = Math.max(state.trimStart, audio.currentTime - 5);
    }
  });

  forwardBtn.addEventListener('click', function () {
    if (audio.duration) {
      audio.currentTime = Math.min(state.trimEnd || audio.duration, audio.currentTime + 5);
    }
  });

  // Progress and Time Updates
  audio.addEventListener('loadedmetadata', function () {
    state.duration = audio.duration;
    durationTimeEl.textContent = formatTime(audio.duration);
    if (!state.trimEnd) {
      state.trimEnd = audio.duration;
      trimEndSlider.max = Math.ceil(audio.duration);
      trimEndSlider.value = audio.duration;
      trimEndValue.textContent = `${audio.duration.toFixed(2)}s`;
    }
  });

  audio.addEventListener('timeupdate', function () {
    if (!audio.duration) return;
    const current = audio.currentTime;
    const dur = audio.duration;

    // Enforce trimmer boundaries
    if (state.trimEnd && current >= state.trimEnd) {
      audio.pause();
      setPlayingState(false);
      audio.currentTime = state.trimStart;
      return;
    }

    const percent = (current / dur) * 100;
    progressFill.style.width = `${percent}%`;
    currentTimeEl.textContent = formatTime(current);
    progressTrack.setAttribute('aria-valuenow', Math.round(percent));
  });

  audio.addEventListener('ended', function () {
    setPlayingState(false);
    progressFill.style.width = '0%';
    currentTimeEl.textContent = '0:00';
    audio.currentTime = state.trimStart;
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
      audio.currentTime = Math.min(state.trimEnd || audio.duration, audio.currentTime + 3);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      audio.currentTime = Math.max(state.trimStart, audio.currentTime - 3);
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

  // ==========================================================================
  // Export Audio (with Studio Effects Rendering)
  // ==========================================================================

  async function renderEditedAudioBuffer() {
    if (!state.audioBuffer) return null;
    const orig = state.audioBuffer;
    const trimStart = state.trimStart || 0;
    const trimEnd = state.trimEnd || orig.duration;

    const startSample = Math.floor(trimStart * orig.sampleRate);
    const endSample = Math.min(orig.length, Math.floor(trimEnd * orig.sampleRate));
    const frameCount = Math.max(1, endSample - startSample);

    const offlineCtx = new OfflineAudioContext(orig.numberOfChannels, frameCount, orig.sampleRate);

    // Create Sliced buffer
    const sliced = offlineCtx.createBuffer(orig.numberOfChannels, frameCount, orig.sampleRate);
    for (let ch = 0; ch < orig.numberOfChannels; ch++) {
      const srcData = orig.getChannelData(ch);
      const dstData = sliced.getChannelData(ch);
      for (let i = 0; i < frameCount; i++) {
        dstData[i] = srcData[startSample + i];
      }
    }

    const source = offlineCtx.createBufferSource();
    source.buffer = sliced;

    // Pitch ratio
    const semitones = state.livePitch;
    const pitchRatio = Math.pow(2, semitones / 12);
    source.playbackRate.value = Math.max(0.25, Math.min(3.0, state.liveSpeed * pitchRatio));

    // Equalizer: Clarity
    const eqC = offlineCtx.createBiquadFilter();
    eqC.type = 'peaking';
    eqC.frequency.value = 3200;
    eqC.Q.value = 1.2;
    eqC.gain.value = state.eqClarity;

    // Equalizer: Warmth
    const eqW = offlineCtx.createBiquadFilter();
    eqW.type = 'lowshelf';
    eqW.frequency.value = 200;
    eqW.gain.value = state.eqBass;

    // Reverb Convolver
    const conv = offlineCtx.createConvolver();
    conv.buffer = createReverbImpulse(offlineCtx, 1.2, 2.5);

    const wG = offlineCtx.createGain();
    const dG = offlineCtx.createGain();

    if (state.reverbMode === 'room') {
      wG.gain.value = 0.35;
      dG.gain.value = 0.85;
    } else if (state.reverbMode === 'hall') {
      wG.gain.value = 0.65;
      dG.gain.value = 0.70;
    } else {
      wG.gain.value = 0.0;
      dG.gain.value = 1.0;
    }

    source.connect(eqC);
    eqC.connect(eqW);

    eqW.connect(dG);
    dG.connect(offlineCtx.destination);

    if (state.reverbMode !== 'dry') {
      eqW.connect(conv);
      conv.connect(wG);
      wG.connect(offlineCtx.destination);
    }

    source.start();
    return await offlineCtx.startRendering();
  }

  function triggerDownload(blob, extension, isEdited = false) {
    if (!blob) return;
    const voiceCode = state.selectedVoice.includes('Ardi') ? 'laki' : 'perempuan';
    const tag = isEdited ? '_studio_edit' : '';
    const filename = `suarakaca_${voiceCode}_${state.selectedTone}${tag}.${extension}`;
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
    triggerDownload(state.audioBlobMp3, 'mp3', false);
  });

  downloadWavBtn.addEventListener('click', async function () {
    const hasEdits = state.liveSpeed !== 1.0 || state.livePitch !== 0 || state.eqClarity !== 0 || state.eqBass !== 0 || state.reverbMode !== 'dry' || state.trimStart > 0 || (state.duration && state.trimEnd < state.duration - 0.2);

    if (hasEdits && state.audioBuffer) {
      try {
        downloadWavBtn.disabled = true;
        const rendered = await renderEditedAudioBuffer();
        const editedWav = window.audioBufferToWavBlob(rendered);
        triggerDownload(editedWav, 'wav', true);
      } catch (e) {
        console.warn('Fallback to original WAV:', e);
        triggerDownload(state.audioBlobWav, 'wav', false);
      } finally {
        downloadWavBtn.disabled = false;
      }
    } else {
      triggerDownload(state.audioBlobWav, 'wav', false);
    }
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

        // Spotify Green
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
