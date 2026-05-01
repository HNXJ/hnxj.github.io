import os
import time
from typing import List, Optional
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel

app = FastAPI(title="Gamma Arena Observation Service", version="1.0.0")

# --- CORS CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://hnxj.github.io"],
    allow_credentials=True,
    allow_methods=["GET"],
    allow_headers=["*"],
)

# --- MODELS ---
class Provenance(BaseModel):
    source: str
    timestamp: float
    stale_seconds: int
    readonly: bool
    degraded: bool

class HealthResponse(BaseModel):
    status: str
    service: str
    version: str
    provenance: Provenance

class ManifestResponse(BaseModel):
    role: str
    version: str
    available_endpoints: List[str]
    readonly: bool
    degraded: bool
    provenance_policy: str

class DegradedResponse(BaseModel):
    status: str
    detail: str
    provenance: Provenance

# --- UTILS ---
def get_provenance(source: str = "degraded_unavailable", degraded: bool = True) -> dict:
    return {
        "source": source,
        "timestamp": time.time(),
        "stale_seconds": 0,
        "readonly": True,
        "degraded": degraded
    }

# --- ERROR HANDLING ---
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    return JSONResponse(
        status_code=503,
        content={
            "status": "CRITICAL_FAILURE",
            "detail": "Service temporarily unavailable or degraded",
            "provenance": get_provenance()
        }
    )

# --- V1 OBSERVATION API ---

@app.get("/api/v1/health", response_model=HealthResponse)
async def health():
    return {
        "status": "online",
        "service": "Gamma Arena Observation Service",
        "version": "1.0.0",
        "provenance": get_provenance("backend_runtime", False)
    }

@app.get("/api/v1/manifest", response_model=ManifestResponse)
async def manifest():
    return {
        "role": "public_observation_plane",
        "version": "1.0.0",
        "available_endpoints": [
            "/api/v1/health",
            "/api/v1/manifest",
            "/api/v1/status",
            "/api/v1/progression",
            "/api/v1/agents",
            "/api/v1/persistence",
            "/api/v1/events/recent",
            "/api/v1/truth-labels"
        ],
        "readonly": True,
        "degraded": True, # Currently no live Gamma backend attached
        "provenance_policy": "All responses include strict provenance tracing. Mutation is strictly prohibited."
    }

# STUBS FOR GAMMA BACKEND (Degraded/Null Adapters)
@app.get("/api/v1/status")
async def get_status():
    return DegradedResponse(
        status="UNREACHABLE",
        detail="Authoritative execution substrate is currently detached from the public observation plane.",
        provenance=get_provenance()
    )

@app.get("/api/v1/progression")
async def get_progression():
    return DegradedResponse(
        status="UNREACHABLE",
        detail="Progression metrics require committed truth from Gamma.",
        provenance=get_provenance()
    )

@app.get("/api/v1/agents")
async def get_agents():
    return DegradedResponse(
        status="UNREACHABLE",
        detail="Agent signatures cannot be verified without authoritative link.",
        provenance=get_provenance()
    )

@app.get("/api/v1/persistence")
async def get_persistence():
    return DegradedResponse(
        status="UNREACHABLE",
        detail="Persistence layer requires authoritative link for attestation.",
        provenance=get_provenance()
    )

@app.get("/api/v1/events/recent")
async def get_events():
    return DegradedResponse(
        status="UNREACHABLE",
        detail="Event streams are detached.",
        provenance=get_provenance()
    )

@app.get("/api/v1/truth-labels")
async def get_truth_labels():
    return DegradedResponse(
        status="UNREACHABLE",
        detail="No grounded truth vectors available in observation plane.",
        provenance=get_provenance()
    )


# --- LEGACY / COMPATIBILITY ROUTES ---
# Legacy /api/list-figures was tied to glllmx_backend/static which is currently ignored and unportable.
# We retain the endpoint but stub it safely to prevent deployment crashes.
@app.get("/api/list-figures")
async def list_figures():
    """Legacy route: Stubbed gracefully since static assets are unlinked."""
    return []

@app.get("/api/v1")
@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "Gamma Arena Observation Service",
        "frontend": "https://hnxj.github.io/pages/gammarena/"
    }
