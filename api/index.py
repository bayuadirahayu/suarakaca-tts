import os
import io
import re
import json
import wave
import base64
import asyncio
import urllib.parse
import urllib.request
from typing import Optional
from fastapi import FastAPI, HTTPException, Request
from fastapi.responses import Response, JSONResponse, FileResponse
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
        },
        {
            "id": "id-ID-LarasNeural",
            "name": "Laras (Perempuan)",
            "gender": "female",
            "lang": "id-ID",
            "description": "Suara wanita Indonesia yang lembut, santai, dan ekspresif."
        },
        {
            "id": "id-ID-BagasNeural",
            "name": "Bagas (Laki-laki)",
            "gender": "male",
            "lang": "id-ID",
            "description": "Suara pria Indonesia yang mantap, bersahaja, dan tegas."
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
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
        "Referer": "https://translate.google.com/"
    }

    import httpx
    with httpx.Client(timeout=4.0, follow_redirects=True, headers=headers) as client:
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
                resp = client.get(url)
                if resp.status_code == 200:
                    audio_chunks.append(resp.content)

    return b"".join(audio_chunks)


async def generate_with_gemini_tts(text: str, gemini_voice: str, tone: str) -> Optional[bytes]:
    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        return None

    directives = {
        "kreator": "Ucapkan dalam Bahasa Indonesia dengan tempo cepat, tegas, dinamis ala narasi video pendek",
        "ceria": "Ucapkan dalam Bahasa Indonesia dengan nada sangat ceria, antusias, ramah, dan berenergi positif",
        "sedih": "Ucapkan dalam Bahasa Indonesia dengan nada sedih, lembut, penuh empati, dan menyentuh perasaan",
        "naratif": "Ucapkan dalam Bahasa Indonesia dengan intonasi tenang, stabil, dan artikulatif"
    }
    directive = directives.get(tone, directives["naratif"])
    prompt_text = f"{directive}. Bacakan teks berikut secara langsung tanpa kata pengantar tambahan:\n\n\"{text}\""

    url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key={api_key}"
    payload = {
        "contents": [{"parts": [{"text": prompt_text}]}],
        "generationConfig": {
            "responseModalities": ["AUDIO"],
            "speechConfig": {
                "voiceConfig": {
                    "prebuiltVoiceConfig": {
                        "voiceName": gemini_voice
                    }
                }
            }
        }
    }

    def _fetch():
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=8) as resp:
            res_json = json.loads(resp.read().decode("utf-8"))
            candidate = res_json.get("candidates", [{}])[0]
            parts = candidate.get("content", {}).get("parts", [])
            for p in parts:
                if "inlineData" in p:
                    b64 = p["inlineData"]["data"]
                    raw_bytes = base64.b64decode(b64)
                    mime = p["inlineData"].get("mimeType", "")
                    rate = 24000
                    if "rate=" in mime:
                        try:
                            rate = int(re.search(r"rate=(\d+)", mime).group(1))
                        except Exception:
                            rate = 24000
                    wav_buf = io.BytesIO()
                    with wave.open(wav_buf, "wb") as wf:
                        wf.setnchannels(1)
                        wf.setsampwidth(2)
                        wf.setframerate(rate)
                        wf.writeframes(raw_bytes)
                    return wav_buf.getvalue()
        return None

    try:
        return await asyncio.wait_for(asyncio.to_thread(_fetch), timeout=7.0)
    except Exception as e:
        print(f"Gemini TTS Notice ({type(e).__name__}): {e}")
        return None


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

    requested_voice = payload.voice or "id-ID-GadisNeural"
    valid_voices = ["id-ID-GadisNeural", "id-ID-ArdiNeural", "id-ID-LarasNeural", "id-ID-BagasNeural"]
    if requested_voice not in valid_voices:
        requested_voice = "id-ID-GadisNeural"

    tone_preset = TONE_PROSODY.get(payload.tone, TONE_PROSODY["naratif"])
    effective_rate = max(-50, min(80, tone_preset["base_rate"] + payload.rate_adjust))
    effective_pitch = max(-50, min(50, tone_preset["base_pitch"] + payload.pitch_adjust))

    audio_bytes = None
    engine_used = "edge-neural"
    media_type = "audio/mpeg"

    # 1. Check if Gemini TTS model applies for Laras (Aoede) or Bagas (Orus)
    if requested_voice == "id-ID-LarasNeural":
        audio_bytes = await generate_with_gemini_tts(text, "Aoede", payload.tone)
        if audio_bytes:
            engine_used = "gemini-tts"
            media_type = "audio/wav"
    elif requested_voice == "id-ID-BagasNeural":
        audio_bytes = await generate_with_gemini_tts(text, "Orus", payload.tone)
        if audio_bytes:
            engine_used = "gemini-tts"
            media_type = "audio/wav"

    # 2. Edge TTS engine (strict 2.8s timeout to avoid Vercel 10s serverless timeout)
    if not audio_bytes:
        edge_voice = "id-ID-GadisNeural"
        if requested_voice == "id-ID-ArdiNeural":
            edge_voice = "id-ID-ArdiNeural"
        elif requested_voice == "id-ID-LarasNeural":
            edge_voice = "id-ID-GadisNeural"
            effective_rate -= 3
            effective_pitch += 3
        elif requested_voice == "id-ID-BagasNeural":
            edge_voice = "id-ID-ArdiNeural"
            effective_rate -= 2
            effective_pitch -= 3

        rate_str = f"{effective_rate:+d}%"
        pitch_str = f"{effective_pitch:+d}Hz"

        try:
            audio_bytes = await asyncio.wait_for(
                generate_with_edge_tts(text, edge_voice, rate_str, pitch_str),
                timeout=2.8
            )
            engine_used = "edge-neural"
            media_type = "audio/mpeg"
        except Exception as edge_err:
            print(f"Edge TTS notice ({type(edge_err).__name__}): {edge_err}. Switching to reliable fallback...")
            audio_bytes = None

    # 3. Transparent fallback to high-reliability Google Indonesian TTS
    if not audio_bytes:
        try:
            audio_bytes = await asyncio.wait_for(
                asyncio.to_thread(fallback_google_tts, text),
                timeout=4.5
            )
            engine_used = "google-id"
            media_type = "audio/mpeg"
        except Exception as fallback_err:
            raise HTTPException(
                status_code=502,
                detail="Serverless Vercel dibatasi jaringan cloud. Tambahkan GEMINI_API_KEY di Vercel Environment Variables untuk performa stabil 100%."
            )

    if not audio_bytes:
        raise HTTPException(status_code=502, detail="Tidak ada data audio yang dihasilkan.")

    return Response(
        content=audio_bytes,
        media_type=media_type,
        headers={
            "Content-Disposition": "inline; filename=suarakaca_speech.mp3",
            "Cache-Control": "no-cache",
            "X-Engine-Used": engine_used,
            "X-Tone-Applied": payload.tone,
            "X-Voice-Applied": requested_voice
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
async def health():
    return {"status": "ok", "service": "SuaraKaca TTS"}

@app.get("/")
async def root():
    for p in ["index.html", "static/index.html", "public/index.html"]:
        if os.path.exists(p):
            return FileResponse(p)
    return {"status": "ok", "service": "SuaraKaca TTS"}
