# SuaraKaca - Text to Speech Bahasa Indonesia (Spotify Liquid Glass)

Aplikasi web Text to Speech (TTS) bahasa Indonesia modern dengan estetika minimalis Spotify dan aksen Liquid Glass (frosted glassmorphism), dibangun sesuai standar kualitas desain bebas AI slop (Antislop).

## Fitur Utama

1. **Suara Bahasa Indonesia Neural Jernih**
   - **Gadis (Perempuan)**: `id-ID-GadisNeural` (artikulatif, ramah, studio quality).
   - **Ardi (Laki-laki)**: `id-ID-ArdiNeural` (berwibawa, hangat, natural).
2. **Pilihan Emosi dan Intonasi**
   - **Naratif**: Pacing stabil dan teratur, ideal untuk buku audio, artikel, atau podcast.
   - **Ceria**: Tempo lincah (+14%) dengan intonasi tinggi (+8Hz) penuh semangat positif.
   - **Sedih**: Tempo perlahan (-16%) dengan nada lembut mendalam (-8Hz) untuk nuansa reflektif.
   - Dilengkapi *slider* penyesuaian manual untuk Kecepatan Bicara dan Tinggi Nada (Pitch).
3. **Studio Pengeditan Audio Real-time (Pasca Konversi)**
   - **Tempo & Kecepatan Live**: Slider kecepatan (0.5x sampai 2.0x) dan tombol cepat (0.75x, 1.0x, 1.25x, 1.5x) yang langsung mengubah kecepatan suara saat diputar tanpa jeda.
   - **Pengubah Nada Live (Pitch Shift)**: Geser nada lebih rendah (-10) untuk vokal lebih berat/maskulin atau lebih tinggi (+10) untuk vokal lebih cerah/feminin.
   - **Sinkronisasi Dua Arah**: Penggeser *Kecepatan Bicara* dan *Tinggi Nada* di panel atas otomatis terhubung secara langsung dengan audio yang sedang aktif.
   - **Equalizer Vokal Studio**:
     - *Kejernihan Vokal (Clarity Boost 3.2 kHz)*: Menajamkan artikulasi konsonan agar suara tidak mendem.
     - *Kehangatan Vokal (Warmth & Bass 200 Hz)*: Menambah resonansi tebal dan empuk seperti mikrofon siaran radio/podcast.
   - **Efek Akustik Ruang (Studio Reverb)**: Pilihan mode *Studio Bersih (Dry)*, *Podcast Room*, dan *Panggung Narasi (Spacious)*.
   - **Pemotong Audio (Trimmer)**: Tentukan titik potong awal dan akhir (detik) dengan tombol *Putar Potongan*.
   - **Ekspor Master Terolah**: Mengunduh format `.WAV` otomatis menerapkan seluruh efek equalizer, nada, tempo, dan potongan waktu menggunakan *OfflineAudioContext*.

4. **Pemutar Audio Preview Gaya Spotify**
   - Panel *dock* bawah bergaya pemutar musik Spotify dengan efek *liquid glass*.
   - Visualizer spektrum frekuensi audio real-time (HTML5 Canvas).
   - Kontrol pemutaran lengkap: Putar/Jeda, Maju/Mundur 5 detik, *scrubber timeline*, dan pengatur volume.

5. **Ekspor dan Unduh Ganda**
   - **File .MP3**: Berkas audio terkompresi berkualitas tinggi (MPEG layer 3).
   - **File .WAV**: Berkas audio tanpa kompresi (16-bit PCM WAV Lossless) termasuk hasil olah studio.

6. **Desain Bersih & Aksesibel**
   - Bebas karakter ASCII art atau dekorasi biner acak.
   - Palet warna gelap obsidian khas Spotify (`#0c0d0f`, `#16171b`) dengan aksen hijau Spotify (`#1db954`).
   - Logo kustom dan favicon menggunakan `icon.png`.
   - Tombol profil pengembang **Kuroneko** di navigasi atas dengan foto profil `iconprofilesaya.png`.
   - Jendela profil interaktif *liquid glass* dengan tautan kredit Instagram [@bayuadirahayu](https://instagram.com/bayuadirahayu).
   - Kontras warna tinggi memenuhi standar WCAG AAA (R-25).
   - Dukungan navigasi penuh menggunakan keyboard (Tab, Enter, Spasi, Tombol Panah).

## Struktur Berkas

```
appTekstopeech/
├── app.py                  # Server FastAPI & integrasi Edge TTS
├── requirements.txt        # Dependensi Python
├── DESIGN.md               # Spesifikasi desain & antislop dials
├── start.bat               # Skrip praktis untuk menjalankan aplikasi
└── static/
    ├── index.html          # Halaman antarmuka Spotify Liquid Glass
    ├── css/
    │   └── style.css       # Styling Liquid Glass & responsive layout
    └── js/
        ├── wav_encoder.js  # Konverter PCM 16-bit WAV murni client-side
        └── app.js          # Logika pemutar, visualizer, & interaksi UI
```

## Cara Menjalankan

Cukup klik dua kali berkas `start.bat`, atau jalankan perintah berikut di terminal:

```bash
.venv\Scripts\python -m uvicorn app:app --host 127.0.0.1 --port 8000
```

Buka peramban (browser) di: `http://127.0.0.1:8000`
