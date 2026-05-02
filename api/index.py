import os
import time
from typing import List, Optional
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from supabase import create_client

app = FastAPI(title="Gamma Arena Observation Service", version="1.0.0")

# --- SUPABASE CLIENT ---
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_SERVICE_ROLE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
db = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) if SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY else None

# --- CORS CONFIGURATION ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://hnxj.github.io"],
    allow_methods=["GET"],
    allow_headers=["*"],
)

# --- UTILS ---
def get_provenance(source: str = "supabase_observer", degraded: bool = False) -> dict:
    return {
        "source": source,
        "timestamp": time.time(),
        "stale_seconds": 0,
        "readonly": True,
        "degraded": degraded
    }

# --- V1 OBSERVATION API ---

@app.get("/api/v1/health")
async def health():
    return {
        "status": "online",
        "service": "Gamma Arena Observation Service",
        "provenance": get_provenance("backend_runtime", False)
    }

@app.get("/api/v1/status")
async def get_status():
    if not db:
        return {"status": "UNREACHABLE", "detail": "Supabase client not configured"}
    
    current = db.table("arena_current").select("*").execute()
    if not current.data:
        return {"status": "INITIALIZING", "detail": "No snapshot pointer found"}
        
    return {
        "status": "online",
        "provenance": get_provenance(),
        "pointer": current.data[0]
    }

@app.get("/api/v1/persistence")
async def get_persistence():
    if not db:
        return {"status": "UNREACHABLE"}
        
    current = db.table("arena_current").select("snapshot_sequence_id").execute()
    if not current.data:
        return {"error": "No persistence state found"}
        
    snapshot_id = current.data[0]["snapshot_sequence_id"]
    snapshot = db.table("arena_snapshots").select("*").eq("sequence_id", snapshot_id).execute()
    
    return {
        "snapshot": snapshot.data[0] if snapshot.data else None,
        "provenance": get_provenance()
    }

@app.get("/api/v1/events/recent")
async def get_events():
    if not db:
        return {"events": []}
    
    events = db.table("arena_events").select("*").order("sequence_id", desc=True).limit(20).execute()
    return {"events": events.data, "provenance": get_provenance()}

@app.get("/api/v1/agents")
async def get_agents():
    if not db:
        return {"agents": [], "provenance": get_provenance()}
    
    current = db.table("arena_current").select("snapshot_sequence_id").execute()
    if not current.data:
        return {"agents": [], "provenance": get_provenance()}
        
    snapshot_id = current.data[0]["snapshot_sequence_id"]
    snapshot = db.table("arena_snapshots").select("state_blob").eq("sequence_id", snapshot_id).execute()
    
    agents = []
    if snapshot.data:
        state = snapshot.data[0]["state_blob"]
        queue = state.get("queue", [])
        active = state.get("active_agents", [])
        for agent_id in queue:
            agents.append({
                "id": agent_id,
                "status": "ACTIVE" if agent_id in active else "IDLE",
                "role": agent_id.split("-")[-1] if "-" in agent_id else "unknown"
            })
            
    return {"agents": agents, "provenance": get_provenance()}

@app.get("/api/v1/manifest")
async def get_manifest():
    """Returns machine-readable service discovery metadata."""
    return {
        "service": "Gamma Arena Observation Service",
        "version": "1.0.0",
        "contract": "v1",
        "endpoints": {
            "/api/v1/health": "Service heartbeat and connectivity status",
            "/api/v1/status": "Authoritative system pointer and truth class",
            "/api/v1/persistence": "Latest state blob and sequence data",
            "/api/v1/events/recent": "Recent Turn Reflections and turn events",
            "/api/v1/agents": "Active researcher registry and status",
            "/api/v1/manifest": "Service discovery and route metadata"
        },
        "topology": {
            "truth": "Supabase-backed laminar snapshots",
            "execution": "Restricted MacOS Safe-Mode Runtime"
        },
        "provenance": get_provenance()
    }

