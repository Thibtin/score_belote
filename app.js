// ==========================================
// 1. ÉTAT GLOBAL & INITIALISATION
// ==========================================
let state = {
    players: ['Romain', 'Sophie', 'Claire', 'Pierre'],
    dealerIndex: 0,
    targetScore: 1000,
    rounds: [],
    selectedTrump: '♥',
    selectedTaker: 0,
    editingRoundIndex: null
};

document.addEventListener('DOMContentLoaded', () => {
    if (window.lucide) lucide.createIcons();
    loadState();
    updateUI();
});

function saveState() {
    localStorage.setItem('belote_state_v4', JSON.stringify(state));
}

function loadState() {
    const saved = localStorage.getItem('belote_state_v4');
    if (saved) {
        try {
            state = Object.assign(state, JSON.parse(saved));
        } catch(e){}
    }
}

function resetGame() {
    if (confirm("Commencer une nouvelle partie ? Tous les scores seront réinitialisés.")) {
        state.rounds = [];
        state.dealerIndex = 0;
        saveState();
        updateUI();
    }
}

function toggleTargetScore() {
    state.targetScore = state.targetScore === 1000 ? 1200 : state.targetScore === 1200 ? 501 : 1000;
    saveState();
    updateUI();
}

// ==========================================
// 2. GESTION DE L'AFFICHAGE (UI)
// ==========================================
function updateUI() {
    document.getElementById('p1NameDisplay').innerText = state.players[0];
    document.getElementById('p2NameDisplay').innerText = state.players[1];
    document.getElementById('p3NameDisplay').innerText = state.players[2];
    document.getElementById('p4NameDisplay').innerText = state.players[3];

    [0,1,2,3].forEach(idx => {
        const el = document.getElementById(`p${idx+1}Dealer`);
        if (el) el.classList.toggle('hidden', state.dealerIndex !== idx);
    });

    document.getElementById('targetScoreDisplay').innerText = state.targetScore;

    let t1Total = 0;
    let t2Total = 0;

    state.rounds.forEach(r => {
        t1Total += r.t1Score;
        t2Total += r.t2Score;
    });

    document.getElementById('team1Score').innerText = t1Total;
    document.getElementById('team2Score').innerText = t2Total;

    const diff = Math.abs(t1Total - t2Total);
    document.getElementById('scoreDiff').innerText = `Δ ${diff}`;

    const grandTotal = t1Total + t2Total || 1;
    const p1Pct = Math.round((t1Total / grandTotal) * 100);
    document.getElementById('p1Bar').style.width = `${p1Pct}%`;
    document.getElementById('p2Bar').style.width = `${100 - p1Pct}%`;

    renderRoundsList();
}

function renderRoundsList() {
    const listEl = document.getElementById('roundsList');
    const emptyEl = document.getElementById('emptyState');
    const headerEl = document.getElementById('historyHeader');

    listEl.innerHTML = '';

    if (state.rounds.length === 0) {
        emptyEl.classList.remove('hidden');
        headerEl.classList.add('hidden');
        return;
    }

    emptyEl.classList.add('hidden');
    headerEl.classList.remove('hidden');

    state.rounds.forEach((r, idx) => {
        const row = document.createElement('div');
        row.className = "grid grid-cols-12 text-sm py-3 px-2 border-b border-gray-100 items-center hover:bg-gray-50 cursor-pointer transition active:bg-teal-50/50";
        row.onclick = () => openEditModal(idx);

        const takerName = state.players[r.takerIndex];
        const takerIsT1 = (r.takerIndex === 0 || r.takerIndex === 2);

        row.innerHTML = `
            <div class="col-span-5 text-left font-bold ${r.t1Score > r.t2Score ? 'text-teal-700' : 'text-gray-600'}">
                ${r.t1Score}
                ${takerIsT1 ? `<span class="text-[10px] bg-teal-100 text-teal-800 px-1.5 py-0.5 rounded-full ml-1 font-normal">${r.trump}${takerName}</span>` : ''}
                ${r.isCapot && takerIsT1 ? `<span class="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded ml-0.5">Capot</span>` : ''}
            </div>
            <div class="col-span-2 text-center text-xs text-gray-400 font-semibold">${idx + 1}</div>
            <div class="col-span-5 text-right font-bold ${r.t2Score > r.t1Score ? 'text-amber-600' : 'text-gray-600'}">
                ${!takerIsT1 ? `<span class="text-[10px] bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded-full mr-1 font-normal">${r.trump}${takerName}</span>` : ''}
                ${r.isCapot && !takerIsT1 ? `<span class="text-[9px] bg-amber-100 text-amber-800 px-1 py-0.5 rounded mr-0.5">Capot</span>` : ''}
                ${r.t2Score}
            </div>
        `;
        listEl.appendChild(row);
    });
}

// ==========================================
// 3. SAISIE & ÉDITION DE SCORE
// ==========================================
function openAddModal() {
    state.editingRoundIndex = null;
    document.getElementById('modalTitle').innerText = "Nouveau Tour";
    document.getElementById('deleteBtn').classList.add('hidden');
    
    selectTrump('♥');
    renderTakerSelector(0);
    
    document.getElementById('t1ScoreInput').value = '';
    document.getElementById('t2ScoreInput').value = '';
    document.getElementById('beloteSelect').value = 'none';
    document.getElementById('derSelect').value = 't1';
    document.getElementById('chuteToggle').checked = false;
    document.getElementById('capotToggle').checked = false;

    updateInputLabels();
    document.getElementById('addModal').classList.remove('hidden');
}

function openEditModal(index) {
    state.editingRoundIndex = index;
    const r = state.rounds[index];

    document.getElementById('modalTitle').innerText = `Modifier le Tour ${index + 1}`;
    document.getElementById('deleteBtn').classList.remove('hidden');

    selectTrump(r.trump);
    renderTakerSelector(r.takerIndex);

    document.getElementById('capotToggle').checked = r.isCapot || false;
    document.getElementById('chuteToggle').checked = r.isChute || false;
    document.getElementById('beloteSelect').value = r.belote || 'none';
    document.getElementById('derSelect').value = r.der || 't1';

    document.getElementById('t1ScoreInput').value = r.t1Score;
    document.getElementById('t2ScoreInput').value = r.t2Score;

    updateInputLabels();
    document.getElementById('addModal').classList.remove('hidden');
}

function closeAddModal() {
    document.getElementById('addModal').classList.add('hidden');
}

function renderTakerSelector(selectedIndex) {
    state.selectedTaker = selectedIndex;
    const container = document.getElementById('takerSelector');
    container.innerHTML = '';

    state.players.forEach((p, idx) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.onclick = () => renderTakerSelector(idx);
        const isSelected = idx === selectedIndex;
        btn.className = `py-2 rounded-xl text-xs font-bold transition border ${isSelected ? 'bg-teal-700 text-white border-teal-700' : 'bg-gray-50 text-gray-700 border-gray-200'}`;
        btn.innerText = p;
        container.appendChild(btn);
    });
    updateInputLabels();
}

function selectTrump(suit) {
    state.selectedTrump = suit;
    document.querySelectorAll('.trump-btn').forEach(btn => {
        if (btn.dataset.trump === suit) {
            btn.classList.add('bg-teal-100', 'border-teal-500');
        } else {
            btn.classList.remove('bg-teal-100', 'border-teal-500');
        }
    });
}

function updateInputLabels() {
    document.getElementById('t1InputLabel').innerText = `${state.players[0]} & ${state.players[2]}`;
    document.getElementById('t2InputLabel').innerText = `${state.players[1]} & ${state.players[3]}`;
}

function onScoreInput(changed) {
    const capotToggle = document.getElementById('capotToggle');
    const t1Input = document.getElementById('t1ScoreInput');
    const t2Input = document.getElementById('t2ScoreInput');
    let baseTotal = 162;

    if (changed === 't1') {
        let val = parseInt(t1Input.value);
        if (isNaN(val)) {
            t2Input.value = '';
            return;
        }
        if (val > baseTotal && !capotToggle.checked) val = baseTotal;
        t1Input.value = val;
        t2Input.value = Math.max(0, baseTotal - val);
    } else {
        let val = parseInt(t2Input.value);
        if (isNaN(val)) {
            t1Input.value = '';
            return;
        }
        if (val > baseTotal && !capotToggle.checked) val = baseTotal;
        t2Input.value = val;
        t1Input.value = Math.max(0, baseTotal - val);
    }
}

function onCapotToggle() {
    const isCapot = document.getElementById('capotToggle').checked;
    const takerIsT1 = (state.selectedTaker === 0 || state.selectedTaker === 2);
    const belote = document.getElementById('beloteSelect').value;

    if (isCapot) {
        let winnerScore = 252;
        if ((takerIsT1 && belote === 't1') || (!takerIsT1 && belote === 't2')) {
            winnerScore = 272;
        }

        if (takerIsT1) {
            document.getElementById('t1ScoreInput').value = winnerScore;
            document.getElementById('t2ScoreInput').value = 0;
        } else {
            document.getElementById('t1ScoreInput').value = 0;
            document.getElementById('t2ScoreInput').value = winnerScore;
        }
    } else {
        if (takerIsT1) {
            document.getElementById('t1ScoreInput').value = 162;
            document.getElementById('t2ScoreInput').value = 0;
        } else {
            document.getElementById('t1ScoreInput').value = 0;
            document.getElementById('t2ScoreInput').value = 162;
        }
    }
}

function onChuteToggle() {
    const isChute = document.getElementById('chuteToggle').checked;
    if (isChute) {
        document.getElementById('capotToggle').checked = false;
        const takerIsT1 = (state.selectedTaker === 0 || state.selectedTaker === 2);
        if (takerIsT1) {
            document.getElementById('t1ScoreInput').value = 0;
            document.getElementById('t2ScoreInput').value = 162;
        } else {
            document.getElementById('t1ScoreInput').value = 162;
            document.getElementById('t2ScoreInput').value = 0;
        }
    }
}

function recalculateScores() {
    if (document.getElementById('capotToggle').checked) {
        onCapotToggle();
    } else {
        onScoreInput('t1');
    }
}

function saveRound(e) {
    e.preventDefault();

    let t1 = parseInt(document.getElementById('t1ScoreInput').value) || 0;
    let t2 = parseInt(document.getElementById('t2ScoreInput').value) || 0;
    const belote = document.getElementById('beloteSelect').value;
    const isCapot = document.getElementById('capotToggle').checked;

    if (!isCapot) {
        if (belote === 't1') t1 += 20;
        if (belote === 't2') t2 += 20;
    }

    const roundData = {
        t1Score: t1,
        t2Score: t2,
        trump: state.selectedTrump,
        takerIndex: state.selectedTaker,
        belote: belote,
        der: document.getElementById('derSelect').value,
        isChute: document.getElementById('chuteToggle').checked,
        isCapot: isCapot
    };

    if (state.editingRoundIndex !== null) {
        state.rounds[state.editingRoundIndex] = roundData;
    } else {
        state.rounds.push(roundData);
        state.dealerIndex = (state.dealerIndex + 1) % 4;
    }

    saveState();
    updateUI();
    closeAddModal();
}

function deleteCurrentRound() {
    if (state.editingRoundIndex !== null && confirm("Supprimer ce tour ?")) {
        state.rounds.splice(state.editingRoundIndex, 1);
        saveState();
        updateUI();
        closeAddModal();
    }
}

function editPlayerNames() {
    document.getElementById('p1Input').value = state.players[0];
    document.getElementById('p2Input').value = state.players[1];
    document.getElementById('p3Input').value = state.players[2];
    document.getElementById('p4Input').value = state.players[3];
    document.getElementById('playersModal').classList.remove('hidden');
}

function closePlayersModal() {
    document.getElementById('playersModal').classList.add('hidden');
}

function savePlayerNames() {
    state.players[0] = document.getElementById('p1Input').value || 'Joueur 1';
    state.players[1] = document.getElementById('p2Input').value || 'Joueur 2';
    state.players[2] = document.getElementById('p3Input').value || 'Joueur 3';
    state.players[3] = document.getElementById('p4Input').value || 'Joueur 4';
    saveState();
    updateUI();
    closePlayersModal();
}

// ==========================================
// 4. SCANNER CAMERA & LOGIQUE DUAL-ONNX (YOLO-OBB + MICRO-CNNS)
// ==========================================
const RANKS_CLASSES = ['10', '7', '8', '9', 'A', 'D', 'R', 'V'];
const SUITS_CLASSES = ['carreau', 'coeur', 'pique', 'trefle']; // Ordre alphabétique ImageFolder

const SUIT_MAP = {
    'coeur': 'H',
    'carreau': 'D',
    'pique': 'S',
    'trefle': 'C'
};

const BELOTE_VALUES = {
    'V': [20, 2],  '9': [14, 0],  'A': [11, 11], '10': [10, 10],
    'R': [4, 4],   'D': [3, 3],   '8': [0, 0],   '7': [0, 0]
};

let sessionYolo = null;
let sessionRanks = null;
let sessionSuits = null;
let currentScannerTrump = 'H';
let videoStream = null;
let currentPhotoCanvas = null;

async function openScannerModal() {
    const video = document.getElementById('cameraFeed');
    const overlay = document.getElementById('detectionsOverlay');
    const downloadBtn = document.getElementById('downloadPicBtn');
    
    if (video) video.classList.remove('hidden');
    if (overlay) {
        overlay.classList.add('hidden');
        overlay.innerHTML = '';
    }
    if (downloadBtn) downloadBtn.classList.add('hidden');
    
    document.getElementById('scannerModal').classList.remove('hidden');
    document.getElementById('detectedCount').innerText = '0';
    document.getElementById('detectedPoints').innerText = '0';
    document.getElementById('applyScanBtn').classList.add('hidden');
    document.getElementById('scanTriggerBtn').classList.remove('hidden');
    selectScannerTrump('H');

    try {
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { exact: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } }
        });
        video.srcObject = videoStream;
    } catch (err) {
        try {
            videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = videoStream;
        } catch (e) {
            alert("Impossible d'accéder à la caméra.");
        }
    }
}

function closeScannerModal() {
    document.getElementById('scannerModal').classList.add('hidden');
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
}

function selectScannerTrump(suit) {
    currentScannerTrump = suit;
    document.querySelectorAll('.scan-trump-btn').forEach(btn => {
        if (btn.dataset.strump === suit) {
            btn.classList.add('bg-teal-600', 'border-teal-400');
            btn.classList.remove('bg-gray-700', 'border-gray-600');
        } else {
            btn.classList.remove('bg-teal-600', 'border-teal-400');
            btn.classList.add('bg-gray-700', 'border-gray-600');
        }
    });
}

// --------------------------------------------------
// CHARGEMENT DES 3 SESSIONS ONNX
// --------------------------------------------------
async function initOnnxSessions() {
    if (!sessionYolo) sessionYolo = await ort.InferenceSession.create('./model/best_obb_phase1.onnx');
    if (!sessionRanks) sessionRanks = await ort.InferenceSession.create('./model/model_ranks.onnx');
    if (!sessionSuits) sessionSuits = await ort.InferenceSession.create('./model/model_suits.onnx');
}

// --------------------------------------------------
// GESTION FICHIER & TÉLÉCHARGEMENT DE DEBUG
// --------------------------------------------------
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.onload = function() {
            const photoCanvas = document.createElement('canvas');
            photoCanvas.width = img.width;
            photoCanvas.height = img.height;
            const ctx = photoCanvas.getContext('2d');
            ctx.drawImage(img, 0, 0);

            currentPhotoCanvas = photoCanvas;

            if (videoStream) {
                videoStream.getTracks().forEach(track => track.stop());
                videoStream = null;
            }

            const video = document.getElementById('cameraFeed');
            if (video) video.classList.add('hidden');

            const downloadBtn = document.getElementById('downloadPicBtn');
            if (downloadBtn) downloadBtn.classList.remove('hidden');

            drawDetectionsOnCanvas(photoCanvas, []);
            processCanvasImage(photoCanvas);
        };
        img.src = e.target.result;
    };
    reader.readAsDataURL(file);
}

function downloadCapturedPhoto() {
    if (!currentPhotoCanvas) return;
    const link = document.createElement('a');
    link.download = `belote_test_${Date.now()}.jpg`;
    link.href = currentPhotoCanvas.toDataURL('image/jpeg', 0.95);
    link.click();
}

// --------------------------------------------------
// CAPTURE CAMÉRA ET PIPELINE
// --------------------------------------------------
async function runYoloDetection() {
    const video = document.getElementById('cameraFeed');
    if (!video || !video.videoWidth) {
        alert("La caméra n'est pas encore prête.");
        return;
    }

    const photoCanvas = document.createElement('canvas');
    photoCanvas.width = video.videoWidth;
    photoCanvas.height = video.videoHeight;
    const photoCtx = photoCanvas.getContext('2d');
    photoCtx.drawImage(video, 0, 0, photoCanvas.width, photoCanvas.height);

    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }

    currentPhotoCanvas = photoCanvas;
    video.classList.add('hidden');
    const downloadBtn = document.getElementById('downloadPicBtn');
    if (downloadBtn) downloadBtn.classList.remove('hidden');

    await processCanvasImage(photoCanvas);
}

async function processCanvasImage(photoCanvas) {
    const scanBtn = document.getElementById('scanTriggerBtn');
    const applyBtn = document.getElementById('applyScanBtn');

    if (scanBtn) {
        scanBtn.innerText = "Analyse en cours...";
        scanBtn.disabled = true;
    }

    try {
        await initOnnxSessions();

        // 1. Inférence Phase 1 (YOLO-OBB) + NMS
        const rawBoxes = await runYoloObbInference(photoCanvas);
        const filteredBoxes = applyRotatedNMS(rawBoxes, 0.30);

        // 2. Inférence Phase 2 (Redressement & Micro-CNNs)
        const detections = [];
        let totalPts = 0;

        for (const box of filteredBoxes) {
            const warpedCanvas = warpPerspectiveJS(photoCanvas, box.pts, 120, 180);
            const { rankCanvas, suitCanvas } = splitComponentsCanvas(warpedCanvas);

            const predRank = await predictMicroCNN(sessionRanks, rankCanvas, true);
            const predSuit = await predictMicroCNN(sessionSuits, suitCanvas, false);

            const rankName = RANKS_CLASSES[predRank];
            const suitName = SUITS_CLASSES[predSuit];
            const suitCode = SUIT_MAP[suitName];

            const isTrump = (suitCode === currentScannerTrump);
            const pts = BELOTE_VALUES[rankName] ? (isTrump ? BELOTE_VALUES[rankName][0] : BELOTE_VALUES[rankName][1]) : 0;
            totalPts += pts;

            detections.push({
                pts: box.pts,
                label: `${rankName} ${suitName}`,
                points: pts
            });
        }

        drawDetectionsOnCanvas(photoCanvas, detections);

        document.getElementById('detectedCount').innerText = detections.length;
        document.getElementById('detectedPoints').innerText = totalPts;

        if (scanBtn) scanBtn.classList.add('hidden');
        if (applyBtn) applyBtn.classList.remove('hidden');

    } catch (e) {
        console.error("Pipeline Error:", e);
        alert("Erreur lors de l'analyse : " + e.message);
    } finally {
        if (scanBtn) {
            scanBtn.innerText = "Scanner le pli";
            scanBtn.disabled = false;
        }
    }
}

// --------------------------------------------------
// AFFICHAGE RENDU DÉTECTIONS SUR PHOTO RÉELLE
// --------------------------------------------------
function drawDetectionsOnCanvas(sourceCanvas, detections = []) {
    const overlay = document.getElementById('detectionsOverlay');
    if (!overlay) return;

    overlay.classList.remove('hidden');
    overlay.innerHTML = '';

    const displayCanvas = document.createElement('canvas');
    displayCanvas.width = sourceCanvas.width;
    displayCanvas.height = sourceCanvas.height;
    displayCanvas.className = "w-full h-full object-contain rounded-2xl";

    const ctx = displayCanvas.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0);

    detections.forEach(det => {
        const pts = det.pts;

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);
        ctx.lineTo(pts[1].x, pts[1].y);
        ctx.lineTo(pts[2].x, pts[2].y);
        ctx.lineTo(pts[3].x, pts[3].y);
        ctx.closePath();

        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = Math.max(4, Math.floor(sourceCanvas.width / 200));
        ctx.stroke();

        ctx.fillStyle = 'rgba(0, 255, 0, 0.15)';
        ctx.fill();

        const labelText = `${det.label} (${det.points}pt)`;
        const fontSize = Math.max(18, Math.floor(sourceCanvas.width / 30));
        ctx.font = `bold ${fontSize}px sans-serif`;

        const textWidth = ctx.measureText(labelText).width;
        const textX = Math.max(10, pts[0].x);
        const textY = Math.max(fontSize + 10, pts[0].y - 10);

        ctx.fillStyle = '#FACC15';
        ctx.fillRect(textX - 4, textY - fontSize, textWidth + 8, fontSize + 6);

        ctx.fillStyle = '#000000';
        ctx.fillText(labelText, textX, textY);
    });

    overlay.appendChild(displayCanvas);
}

// --------------------------------------------------
// INFÉRENCE YOLO11-OBB ONNX
// --------------------------------------------------
async function runYoloObbInference(sourceCanvas) {
    const inputCanvas = document.createElement('canvas');
    inputCanvas.width = 640;
    inputCanvas.height = 640;
    const ctx = inputCanvas.getContext('2d');
    
    const scale = Math.min(640 / sourceCanvas.width, 640 / sourceCanvas.height);
    const nw = sourceCanvas.width * scale;
    const nh = sourceCanvas.height * scale;
    const dx = (640 - nw) / 2;
    const dy = (640 - nh) / 2;

    ctx.fillStyle = '#727272';
    ctx.fillRect(0, 0, 640, 640);
    ctx.drawImage(sourceCanvas, dx, dy, nw, nh);

    const { data } = ctx.getImageData(0, 0, 640, 640);
    const red = [], green = [], blue = [];

    for (let i = 0; i < data.length; i += 4) {
        red.push(data[i] / 255.0);
        green.push(data[i + 1] / 255.0);
        blue.push(data[i + 2] / 255.0);
    }

    const inputTensor = new ort.Tensor('float32', Float32Array.from([...red, ...green, ...blue]), [1, 3, 640, 640]);
    const outputs = await sessionYolo.run({ [sessionYolo.inputNames[0]]: inputTensor });
    const outputData = outputs[Object.keys(outputs)[0]].data;

    const boxes = [];
    const confThresh = 0.40;

    for (let i = 0; i < 8400; i++) {
        const conf = outputData[4 * 8400 + i];
        if (conf >= confThresh) {
            let cx = (outputData[0 * 8400 + i] - dx) / scale;
            let cy = (outputData[1 * 8400 + i] - dy) / scale;
            let w = outputData[2 * 8400 + i] / scale;
            let h = outputData[3 * 8400 + i] / scale;
            const angle = outputData[5 * 8400 + i];

            const pts = getObbCorners(cx, cy, w, h, angle);
            boxes.push({ cx, cy, w, h, angle, pts, conf });
        }
    }
    return boxes;
}

function getObbCorners(cx, cy, w, h, angle) {
    const cosA = Math.cos(angle);
    const sinA = Math.sin(angle);
    const dx = w / 2;
    const dy = h / 2;

    const corners = [[-dx, -dy], [dx, -dy], [dx, dy], [-dx, dy]];
    return corners.map(([x, y]) => ({
        x: cx + (x * cosA - y * sinA),
        y: cy + (x * sinA + y * cosA)
    }));
}

function applyRotatedNMS(boxes, iouThreshold = 0.30) {
    boxes.sort((a, b) => b.conf - a.conf);
    const result = [];

    while (boxes.length > 0) {
        const curr = boxes.shift();
        result.push(curr);

        boxes = boxes.filter(b => {
            const dist = Math.hypot(curr.cx - b.cx, curr.cy - b.cy);
            const maxDim = Math.max(curr.w, curr.h);
            return dist > (maxDim * 0.4);
        });
    }
    return result;
}

// --------------------------------------------------
// REDRESSEMENT 0° HOMOGRAPHIQUE (WARP PERSPECTIVE)
// --------------------------------------------------
function warpPerspectiveJS(sourceCanvas, pts, outW = 120, outH = 180) {
    const outCanvas = document.createElement('canvas');
    outCanvas.width = outW;
    outCanvas.height = outH;
    const ctx = outCanvas.getContext('2d');

    const sum = pts.map(p => p.x + p.y);
    const diff = pts.map(p => p.x - p.y);

    const tl = pts[sum.indexOf(Math.min(...sum))];
    const tr = pts[diff.indexOf(Math.max(...diff))];

    const srcW = Math.hypot(tr.x - tl.x, tr.y - tl.y);
    const srcH = Math.hypot(pts[3].x - tl.x, pts[3].y - tl.y);

    ctx.save();
    const angle = Math.atan2(tr.y - tl.y, tr.x - tl.x);
    ctx.rotate(-angle);
    ctx.drawImage(sourceCanvas, tl.x, tl.y, srcW, srcH, 0, 0, outW, outH);
    ctx.restore();

    return outCanvas;
}

// --------------------------------------------------
// PRÉTRAITEMENT RANGS & ENSEIGNES (COMPOSANTES CONNEXES)
// --------------------------------------------------
function splitComponentsCanvas(cropCanvas) {
    const w = cropCanvas.width;
    const h = cropCanvas.height;
    const ctx = cropCanvas.getContext('2d');
    const imgData = ctx.getImageData(0, 0, w, h);
    const data = imgData.data;

    const rankCanvas = document.createElement('canvas');
    rankCanvas.width = w;
    rankCanvas.height = Math.floor(h * 0.48);
    const rCtx = rankCanvas.getContext('2d');
    const rData = rCtx.createImageData(w, rankCanvas.height);

    const marginH = Math.floor(h * 0.06);
    const marginW = Math.floor(w * 0.05);

    for (let y = 0; y < rankCanvas.height; y++) {
        for (let x = 0; x < w; x++) {
            const idx = (y * w + x) * 4;
            const isEdge = (y < marginH || y > rankCanvas.height - marginH || x < marginW || x > w - marginW);
            
            if (isEdge) {
                rData.data[idx] = 0;
                rData.data[idx + 1] = 0;
                rData.data[idx + 2] = 0;
                rData.data[idx + 3] = 255;
            } else {
                const gray = 0.299 * data[idx] + 0.587 * data[idx + 1] + 0.114 * data[idx + 2];
                const bw = gray < 128 ? 255 : 0;
                rData.data[idx] = bw;
                rData.data[idx + 1] = bw;
                rData.data[idx + 2] = bw;
                rData.data[idx + 3] = 255;
            }
        }
    }
    rCtx.putImageData(rData, 0, 0);

    const suitCanvas = document.createElement('canvas');
    suitCanvas.width = w;
    suitCanvas.height = Math.floor(h * 0.50);
    const sCtx = suitCanvas.getContext('2d');
    sCtx.drawImage(cropCanvas, 0, Math.floor(h * 0.45), w, suitCanvas.height, 0, 0, w, suitCanvas.height);

    return { rankCanvas, suitCanvas };
}

// --------------------------------------------------
// INFÉRENCE MICRO-CNNS ONNX WEB
// --------------------------------------------------
async function predictMicroCNN(session, inputCanvas, isRank = true) {
    const targetW = 90;
    const targetH = 120;
    
    const prepCanvas = document.createElement('canvas');
    prepCanvas.width = targetW;
    prepCanvas.height = targetH;
    const pCtx = prepCanvas.getContext('2d');
    pCtx.drawImage(inputCanvas, 0, 0, targetW, targetH);

    const imgData = pCtx.getImageData(0, 0, targetW, targetH).data;
    const red = [], green = [], blue = [];

    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];

    for (let i = 0; i < imgData.length; i += 4) {
        const r = imgData[i] / 255.0;
        const g = imgData[i + 1] / 255.0;
        const b = imgData[i + 2] / 255.0;

        if (isRank) {
            const val = (r - 0.5) / 0.5;
            red.push(val); green.push(val); blue.push(val);
        } else {
            red.push((r - mean[0]) / std[0]);
            green.push((g - mean[1]) / std[1]);
            blue.push((b - mean[2]) / std[2]);
        }
    }

    const inputTensor = new ort.Tensor('float32', Float32Array.from([...red, ...green, ...blue]), [1, 3, targetH, targetW]);
    const outputs = await session.run({ [session.inputNames[0]]: inputTensor });
    const logits = outputs[Object.keys(outputs)[0]].data;

    let maxIdx = 0;
    let maxVal = logits[0];
    for (let i = 1; i < logits.length; i++) {
        if (logits[i] > maxVal) {
            maxVal = logits[i];
            maxIdx = i;
        }
    }
    return maxIdx;
}

function applyScanToScore() {
    closeScannerModal();
    openAddModal();
    const pts = parseInt(document.getElementById('detectedPoints').innerText) || 0;
    document.getElementById('t1ScoreInput').value = pts;
    onScoreInput('t1');
}