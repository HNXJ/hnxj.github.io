from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
import os

app = FastAPI(title="GLLLM Backend API")

# --- CORS CONFIGURATION ---
# This allows your GitHub Pages frontend to fetch data and embed iframes
app.add_middleware(
    CORSMiddleware,
    allow_origins=["https://hnxj.github.io"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DYNAMIC ASSET INDEXING ---
@app.get("/api/list-figures")
async def list_figures():
    """Dynamically returns a list of all HTML figures available on the backend."""
    figures_path = "static/figures"
    if os.path.exists(figures_path):
        return [f for f in os.listdir(figures_path) if f.endswith('.html')]
    return []

# --- STATIC FILE SERVING ---
# Figures will be available at: /static/figures/your_file.html
# Data will be available at: /static/data/summary_scores.json
app.mount("/static", StaticFiles(directory="static"), name="static")

@app.get("/")
async def root():
    return {
        "status": "online",
        "service": "GLLLM Research Backend",
        "frontend": "https://hnxj.github.io"
    }
