let globalData = null;

async function loadData() {
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        // Use cache-busting to prevent stale data
        const response = await fetch(`mllm_data.json?t=${Date.now()}`, {
            signal: controller.signal,
            cache: 'no-store'
        });
        clearTimeout(timeoutId);

        if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
        
        const data = await response.json();
        globalData = data;
        
        // Update basic stats
        document.getElementById('stat-subject').textContent = data.status.subject || "IDLE";
        document.getElementById('stat-progress').textContent = data.status.progress || "0%";
        document.getElementById('stat-hw').textContent = data.hardware.cpu_percent + "%";
        
        // Update log with auto-scroll if scrolled to bottom
        const logWindow = document.getElementById('log-window');
        const isScrolledToBottom = logWindow.scrollHeight - logWindow.clientHeight <= logWindow.scrollTop + 50;
        logWindow.textContent = data.status.log;
        if (isScrolledToBottom) {
            logWindow.scrollTop = logWindow.scrollHeight;
        }

        document.getElementById('ts-val').textContent = data.timestamp;

        // Populate Dropdowns
        const plotData = data.analysis || [];
        const models = [...new Set(plotData.map(d => d.model))].sort();
        const papers = [...new Set(plotData.map(d => d.paper))].sort();
        
        const paperSelect = document.getElementById('select-paper');
        const modelSelect = document.getElementById('select-model');
        
        const currentPaper = paperSelect.value;
        const currentModel = modelSelect.value;

        paperSelect.innerHTML = papers.map(p => `<option value="${p}" ${p === currentPaper ? 'selected' : ''}>${p}</option>`).join('');
        modelSelect.innerHTML = models.map(m => `<option value="${m}" ${m === currentModel ? 'selected' : ''}>${m}</option>`).join('');

        if (!currentPaper && papers.length) updateReasoning();

        // Render Plots using React instead of newPlot for performance
        renderPlots(data);
    } catch (e) {
        console.error("Data Fetch Error:", e);
        const logWindow = document.getElementById('log-window');
        if (logWindow.textContent.includes("Loading snapshot")) {
            logWindow.textContent = `Error loading data snapshot: ${e.message}\nRetrying in 30 seconds...`;
        }
    }
}

function updateReasoning() {
    if (!globalData) return;
    const paper = document.getElementById('select-paper').value;
    const model = document.getElementById('select-model').value;
    const contentDiv = document.getElementById('reasoning-content');
    
    const matches = globalData.analysis.filter(d => d.paper === paper && d.model === model);
    
    if (matches.length === 0) {
        contentDiv.innerHTML = `<div style="opacity: 0.5; padding: 20px;">No reasoning data found for this combination.</div>`;
        return;
    }

    let html = "";
    matches.forEach(m => {
        const isLO = m.factor_id.includes('_LO');
        const displayId = m.factor_id.replace('_LO', '').replace('_GO', '');
        const contextLabel = isLO ? '<span style="color: #FFD700; font-size: 0.7rem;">[LOCAL]</span>' : '<span style="color: #9400D3; font-size: 0.7rem;">[GLOBAL]</span>';

        html += `<div style="margin-bottom: 30px; border-bottom: 1px solid #222; padding-bottom: 20px; background: rgba(255,255,255,0.02); padding: 15px; border-radius: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
                <div style="color: #CFB87C; font-weight: bold; font-size: 1rem;">FACTOR ${displayId} ${contextLabel}</div>
                <div style="background: #9400D3; color: #fff; padding: 2px 10px; border-radius: 10px; font-size: 0.8rem; font-weight: bold;">SCORE: ${m.score}</div>
            </div>
            <div class="thought-block" style="background: rgba(148, 0, 211, 0.05); padding: 15px; border-left: 3px solid #9400D3; margin-bottom: 10px; font-style: italic; color: #ddd;">
                ${m.reasoning || "No detailed reasoning trace captured."}
            </div>
            <div style="font-size: 0.85rem; color: #888; border-top: 1px solid #333; pt: 10px;">
                <strong style="color: #CFB87C;">EVIDENCE:</strong> ${m.evidence || "No direct evidence quote extracted."}
            </div>
        </div>`;
    });
    contentDiv.innerHTML = html;
}

function renderPlots(data) {
    const plotData = data.analysis || [];
    const models = [...new Set(plotData.map(d => d.model))];
    const papers = [...new Set(plotData.map(d => d.paper))];
    
    // Heatmap
    const zValues = models.map(m => {
        return papers.map(p => {
            const scores = plotData.filter(d => d.model === m && d.paper === p).map(d => d.score);
            return scores.length ? scores.reduce((a,b) => a+b, 0) / scores.length : null;
        });
    });
    
    const heatmapLayout = { 
        title: 'Avg Score Heatmap', 
        paper_bgcolor: 'rgba(0,0,0,0)', 
        plot_bgcolor: 'rgba(0,0,0,0)', 
        font: { color: '#CFB87C', size: 10 },
        margin: { t: 40, b: 80, l: 80, r: 20 }
    };
    
    Plotly.react('plot-heatmap', [{
        z: zValues, x: papers, y: models, type: 'heatmap', colorscale: [[0, '#000000'], [1, '#9400D3']]
    }], heatmapLayout);

    // Deviation
    const paperAvg = {};
    papers.forEach(p => {
        const scores = plotData.filter(d => d.paper === p).map(d => d.score);
        paperAvg[p] = scores.length ? scores.reduce((a,b) => a+b, 0) / scores.length : 0;
    });
    const modelDev = models.map(m => {
        const diffs = plotData.filter(d => d.model === m).map(d => Math.abs(d.score - paperAvg[d.paper]));
        return diffs.length ? diffs.reduce((a,b) => a+b, 0) / diffs.length : 0;
    });
    
    const deviationLayout = { 
        title: 'Model Deviation from Mean', 
        paper_bgcolor: 'rgba(0,0,0,0)', 
        plot_bgcolor: 'rgba(0,0,0,0)', 
        font: { color: '#CFB87C', size: 10 }
    };
    
    Plotly.react('plot-deviation', [{
        x: models, y: modelDev, type: 'bar', marker: { color: '#9400D3' }
    }], deviationLayout);

    // Factor Agreement
    const factors = [...new Set(plotData.map(d => d.factor_id))].sort((a,b) => parseInt(a) - parseInt(b));
    const factorAgreement = factors.map(f => {
        const scores = plotData.filter(d => d.factor_id === f).map(d => d.score);
        if (scores.length < 2) return 0;
        const mean = scores.reduce((a,b) => a+b, 0) / scores.length;
        const variance = scores.reduce((a,b) => a + Math.pow(b - mean, 2), 0) / scores.length;
        return 1 - Math.sqrt(variance);
    });
    
    const factorLayout = { 
        title: 'Cross-Factor Consensus (1.0 = Perfect Agreement)', 
        paper_bgcolor: 'rgba(0,0,0,0)', 
        plot_bgcolor: 'rgba(0,0,0,0)', 
        font: { color: '#CFB87C', size: 10 }
    };
    
    Plotly.react('plot-factors', [{
        x: factors, y: factorAgreement, type: 'scatter', mode: 'lines+markers', line: { color: '#9400D3' }
    }], factorLayout);
}

// Ensure DOM is ready before querying elements
document.addEventListener('DOMContentLoaded', () => {
    // Add event listeners programmatically
    document.getElementById('select-paper').addEventListener('change', updateReasoning);
    document.getElementById('select-model').addEventListener('change', updateReasoning);

    loadData();
    setInterval(loadData, 30000); // Auto-refresh every 30s
});
