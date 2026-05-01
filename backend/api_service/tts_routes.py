from __future__ import annotations

import os

import httpx
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel

router = APIRouter(tags=["tts"])

_OPENAI_TTS_URL = "https://api.openai.com/v1/audio/speech"


class TTSRequest(BaseModel):
    text: str


@router.post("/api/tts")
async def text_to_speech(req: TTSRequest):
    api_key = os.getenv("OPENAI_API_KEY", "")
    if not api_key:
        raise HTTPException(status_code=503, detail="TTS not configured — OPENAI_API_KEY missing")

    text = req.text.strip()[:500]
    if not text:
        raise HTTPException(status_code=400, detail="text is required")

    async with httpx.AsyncClient(timeout=20) as client:
        resp = await client.post(
            _OPENAI_TTS_URL,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json={
                "model": "tts-1",
                "voice": "alloy",
                "input": text,
                "response_format": "mp3",
                "speed": 0.95,
            },
        )

    if resp.status_code != 200:
        raise HTTPException(status_code=502, detail="OpenAI TTS error")

    return Response(
        content=resp.content,
        media_type="audio/mpeg",
        headers={"Cache-Control": "no-cache"},
    )
