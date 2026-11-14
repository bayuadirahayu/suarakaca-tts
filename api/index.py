import os
import io
import re
import asyncio
import urllib.parse
import urllib.request
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response, FileResponse
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
    "ceria": {
        "base_rate": 14,
        "base_pitch": 8
    },
    "sedih": {
        "base_rate": -16,
        "base_pitch": -8
    },
    "naratif": {
        "base_rate": -2,
        "base_pitch": 0
    }
}

def fallback_google_tts(text: str) -> bytes:
    """
    Ultra-reliable, zero-block Indonesian TTS fallback.
    Splits text into readable chunks and fetches clean MP3 stream without blocking.
    """
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

@app.get("/")
async def root():
    if os.path.exists("index.html"):
        return FileResponse("index.html")
    if os.path.exists("public/index.html"):
        return FileResponse("public/index.html")
    return {"status": "ok", "service": "SuaraKaca TTS API"}

@app.get("/api/voices")
async def get_voices():
    return {
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
                "id": "ceria",
                "label": "Ceria",
                "description": "Intonasi riang, bersemangat, dan ekspresif untuk konten gembira."
            },
            {
                "id": "sedih",
                "label": "Sedih",
                "description": "Tempo lembut, perlahan, dan emosional untuk narasi haru."
            },
            {
                "id": "naratif",
                "label": "Naratif",
                "description": "Irama pas, tenang, dan stabil untuk buku audio, podcast, atau berita."
            }
        ]
    }

async def generate_with_edge_tts(text: str, voice: str, rate_str: str, pitch_str: str) -> bytes:
    communicate = edge_tts.Communicate(
        text=text,
        voice=voice,
        rate=rate_str,
        pitch=pitch_str
    )
    audio_stream = io.BytesIO()
    async for chunk in communicate.stream():
        if chunk["type"] == "audio":
            audio_stream.write(chunk["data"])
    return audio_stream.getvalue()

@app.post("/api/tts")
async def generate_speech(payload: TTSRequest):
    text = payload.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Teks tidak boleh kosong.")

    if len(text) > 4000:
        raise HTTPException(status_code=400, detail="Maksimum panjang teks adalah 4000 karakter.")

    voice = payload.voice
    if voice not in ["id-ID-GadisNeural", "id-ID-ArdiNeural"]:
        voice = "id-ID-GadisNeural"

    tone_preset = TONE_PROSODY.get(payload.tone, TONE_PROSODY["naratif"])
    effective_rate = tone_preset["base_rate"] + payload.rate_adjust
    effective_pitch = tone_preset["base_pitch"] + payload.pitch_adjust

    effective_rate = max(-50, min(80, effective_rate))
    effective_pitch = max(-50, min(50, effective_pitch))

    rate_str = f"{effective_rate:+d}%"
    pitch_str = f"{effective_pitch:+d}Hz"

    audio_bytes = None
    engine_used = "edge-neural"

    # 1. Try Edge TTS with strict 3.5-second timeout (avoids long hanging on blocked networks / Vercel)
    try:
        audio_bytes = await asyncio.wait_for(
            generate_with_edge_tts(text, voice, rate_str, pitch_str),
            timeout=3.5
        )
    except Exception as edge_err:
        print(f"Edge TTS connection notice ({type(edge_err).__name__}): {edge_err}. Switching to reliable fallback...")
        audio_bytes = None

    # 2. Transparent fallback to high-reliability Google Indonesian TTS
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
