from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

from .extract import OUTPUT_ROOT, ExtractionError, extract_matte


class ExtractionRequest(BaseModel):
    job_id: str = Field(alias="jobId")
    input_url: str = Field(alias="inputUrl")
    start_seconds: float = Field(default=0, alias="startSeconds", ge=0)
    max_duration_seconds: float | None = Field(default=None, alias="maxDurationSeconds", gt=0)

    model_config = {
        "populate_by_name": True
    }


class ExtractionResponse(BaseModel):
    job_id: str = Field(alias="jobId")
    matte_url: str = Field(alias="matteUrl")
    audio_url: str = Field(alias="audioUrl")
    duration_seconds: float = Field(alias="durationSeconds")
    duration_in_frames: int = Field(alias="durationInFrames")
    fps: float
    width: int
    height: int

    model_config = {
        "populate_by_name": True
    }


app = FastAPI(title="Prometheus RVM Pipeline", version="0.1.0")
OUTPUT_ROOT.mkdir(parents=True, exist_ok=True)
app.mount("/artifacts", StaticFiles(directory=Path(OUTPUT_ROOT)), name="artifacts")


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/extract", response_model=ExtractionResponse, response_model_by_alias=True)
def extract(request: ExtractionRequest) -> ExtractionResponse:
    try:
        result = extract_matte(
            job_id=request.job_id,
            input_url=request.input_url,
            start_seconds=request.start_seconds,
            max_duration_seconds=request.max_duration_seconds,
        )
    except ExtractionError as error:
        raise HTTPException(status_code=422, detail=str(error)) from error
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error)) from error

    return ExtractionResponse(
        jobId=result.job_id,
        matteUrl=result.matte_url,
        audioUrl=result.audio_url,
        durationSeconds=result.duration_seconds,
        durationInFrames=result.duration_in_frames,
        fps=result.fps,
        width=result.width,
        height=result.height,
    )
