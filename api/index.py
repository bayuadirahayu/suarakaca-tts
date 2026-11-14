import io
import asyncio
from typing import Optional
from fastapi import FastAPI, HTTPException
from fastapi.responses import Response
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
    
    try:
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
                
        audio_bytes = audio_stream.getvalue()
        if not audio_bytes:
            raise HTTPException(status_code=502, detail="Gagal menghasilkan audio dari mesin TTS.")
            
        return Response(
            content=audio_bytes,
            media_type="audio/mpeg",
            headers={
                "Content-Disposition": "inline; filename=suarakaca_speech.mp3",
                "Cache-Control": "no-cache",
                "X-Tone-Applied": payload.tone,
                "X-Voice-Applied": voice
            }
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Terjadi kendala saat sintesis suara: {str(e)}")
