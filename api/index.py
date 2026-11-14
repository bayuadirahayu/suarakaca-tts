import io
import re
import asyncio
import urllib.parse
import urllib.request
from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response, JSONResponse
from pydantic import BaseModel
import edge_tts

app = FastAPI(title="SuaraKaca TTS API")

class TTSRequest(BaseModel):
    text: str
    voice: Optional[str] = "id-ID-GadisNeural"
    tone: Optional[str] = "naratif"
    rate_adjust: Optional[int] = 0
    pitch_adjust: Optional[int] = 0

TONE_PROSODY = {
    "kreator": {"base_rate": 16, "base_pitch": 6},
    "ceria":   {"base_rate": 14, "base_pitch": 8},
    "sedih":   {"base_rate": -16,"base_pitch": -8},
    "naratif": {"base_rate": -2, "base_pitch": 0},
}

VOICES_DATA = {
    "voices": [
        {
            "id": "id-ID-GadisNeural",
            "name": "Gadis (Perempuan)",
            "gender": "female",
            "lang": "id-ID",
            "description": "Suara wanita Indonesia yang jernih, ramah, dan artikulatif."
        },
        {
            "id": "id-ID-ArdiNeural",
            "name": "Ardi (Laki-laki)",
            "gender": "male",
            "lang": "id-ID",
            "description": "Suara pria Indonesia yang berwibawa, hangat, dan natural."
        }
    ],
    "tones": [
        {
            "id": "kreator",
            "label": "Narasi Kreator (Reels/Shorts)",
            "description": "Gaya suara narasi video edukasi cepat, tegas, dan artikulatif ala TikTok/Reels."
        },
        {
            "id": "naratif",
            "label": "Naratif",
            "description": "Irama pas, tenang, dan stabil untuk buku audio, podcast, atau berita."
        },
        {
            "id": "ceria",
            "label": "Ceria",
            "description": "Intonasi riang, bersemangat, dan ekspresif untuk konten gembira."
        },
        {
            "id": "sedih",
            "label": "Sedih",
            "description": "Tempo lembut, perlahan, dan emosional untuk narasi haru."
        }
    ]
}


def fallback_google_tts(text: str) -> bytes:
    sentences = [s.strip() for s in re.split(r'[.,!?;:\n]+', text) if s.strip()]
    if not sentences:
        sentences = [text]

    audio_chunks = []
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Referer": "https://translate.google.com/"
    }

    for sentence in sentences:
        words = sentence.split()
        current_chunk = []
        current_len = 0
        sub_chunks = []

        for w in words:
            if current_len + len(w) + 1 > 180:
                sub_chunks.append(" ".join(current_chunk))
                current_chunk = [w]
                current_len = len(w)
            else:
                current_chunk.append(w)
                current_len += len(w) + 1

        if current_chunk:
            sub_chunks.append(" ".join(current_chunk))

        for chunk in sub_chunks:
            if not chunk.strip():
                continue
            encoded = urllib.parse.quote(chunk)
            url = f"https://translate.google.com/translate_tts?ie=UTF-8&q={encoded}&tl=id&client=tw-ob"
            req = urllib.request.Request(url, headers=headers)
            with urllib.request.urlopen(req, timeout=6) as resp:
                audio_chunks.append(resp.read())

    return b"".join(audio_chunks)


async def generate_with_edge_tts(text: str, voice: str, rate_str: str, pitch_str: str) -> bytes:
    communicate = edge_tts.Communicate(text=text, voice=voice, rate=rate_str, pitch=pitch_str)
    audio_stream = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_stream.write(chunk["data"])
    return audio_stream.getvalue()


async def _do_tts(payload: TTSRequest) -> Response:
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Teks tidak boleh kosong.")
    if len(text) > 4000:
        raise HTTPException(status_code=400, detail="Maksimum panjang teks adalah 4000 karakter.")

    voice = payload.voice
    if voice not in ["id-ID-GadisNeural", "id-ID-ArdiNeural"]:
        voice = "id-ID-GadisNeural"

    tone_preset = TONE_PROSODY.get(payload.tone, TONE_PROSODY["naratif"])
    effective_rate = max(-50, min(80, tone_preset["base_rate"] + payload.rate_adjust))
    effective_pitch = max(-50, min(50, tone_preset["base_pitch"] + payload.pitch_adjust))

    rate_str = f"{effective_rate:+d}%"
    pitch_str = f"{effective_pitch:+d}Hz"

    audio_bytes = None
    engine_used = "edge-neural"

    try:
        audio_bytes = await asyncio.wait_for(
            generate_with_edge_tts(text, voice, rate_str, pitch_str),
            timeout=3.5
        )
    except Exception as edge_err:
        print(f"Edge TTS fallback ({type(edge_err).__name__}): {edge_err}")
        audio_bytes = None

    if not audio_bytes:
        try:
            audio_bytes = await asyncio.to_thread(fallback_google_tts, text)
            engine_used = "google-id"
        except Exception as fallback_err:
            raise HTTPException(status_code=502, detail=f"Gagal memproses audio: {str(fallback_err)}")

    if not audio_bytes:
        raise HTTPException(status_code=502, detail="Tidak ada data audio yang dihasilkan.")

    return Response(
        content=audio_bytes,
        media_type="audio/mpeg",
        headers={
            "Content-Disposition": "inline; filename=suarakaca_speech.mp3",
            "Cache-Control": "no-cache",
            "X-Engine-Used": engine_used,
            "X-Tone-Applied": payload.tone,
            "X-Voice-Applied": voice
        }
    )


# ── Routes: register with both /api/* prefix AND bare /* ──────────────────────
# Vercel sometimes strips the /api prefix when routing to the serverless fn.

@app.get("/api/voices")
@app.get("/voices")
async def get_voices():
    return VOICES_DATA

@app.post("/api/tts")
@app.post("/tts")
async def generate_speech(payload: TTSRequest):
    return await _do_tts(payload)

@app.get("/api/health")
@app.get("/health")
@app.get("/")
async def health():
    return {"status": "ok", "service": "SuaraKaca TTS"}
