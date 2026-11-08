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
// 4. SCANNER CAMERA & LOGIQUE DUAL-ONNX
// ==========================================
const RANKS_CLASSES = ['10', '7', '8', '9', 'A', 'D', 'R', 'V'];
const SUITS_CLASSES = ['carreau', 'coeur', 'pique', 'trefle'];

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
// Résultat de la dernière analyse (rang/enseigne + polygone), indépendant de l'atout
let lastScan = { canvas: null, cards: [] };

function pointsForCard(card) {
    const values = BELOTE_VALUES[card.rankName];
    if (!values) return 0;
    const isTrump = SUIT_MAP[card.suitName] === currentScannerTrump;
    return isTrump ? values[0] : values[1];
}

// Recalcule les points avec l'atout courant et redessine, SANS relancer l'analyse
function refreshScanDisplay() {
    const canvas = lastScan.canvas;
    if (!canvas) return;
    const cards = lastScan.cards.map(c => ({ ...c, points: pointsForCard(c) }));
    const total = cards.reduce((sum, c) => sum + c.points, 0);
    document.getElementById('detectedCount').innerText = cards.length;
    document.getElementById('detectedPoints').innerText = total;
    drawDetectionsOnCanvas(canvas, cards);
}

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
    lastScan = { canvas: null, cards: [] };
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
    refreshScanDisplay();
}

// --------------------------------------------------
// CHARGEMENT DES 3 SESSIONS ONNX WEB
// --------------------------------------------------
function waitForOpenCv() {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        const check = () => {
            if (window.cv && cv.Mat && cv.getPerspectiveTransform) return resolve();
            if (Date.now() - start > 60000) return reject(new Error("OpenCV.js n'a pas pu être chargé"));
            setTimeout(check, 100);
        };
        check();
    });
}

async function initOnnxSessions() {
    await waitForOpenCv();
    if (!sessionYolo) sessionYolo = await ort.InferenceSession.create('./model/best_obb_phase1.onnx');
    if (!sessionRanks) sessionRanks = await ort.InferenceSession.create('./model/model_ranks.onnx');
    if (!sessionSuits) sessionSuits = await ort.InferenceSession.create('./model/model_suits.onnx');
}

// --------------------------------------------------
// IMPORTATION FICHIER & TÉLÉCHARGEMENT PHOTO DE TEST
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
// CAPTURE CAMÉRA ET DÉROULEMENT PIPELINE
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
    const overlay = document.getElementById('detectionsOverlay');

    // 🧹 RESET STRICT : Réinitialise l'affichage et les compteurs pour effacer l'ancien scan
    lastScan = { canvas: photoCanvas, cards: [] };
    if (overlay) {
        overlay.innerHTML = '';
        overlay.classList.add('hidden');
    }
    document.getElementById('detectedCount').innerText = '0';
    document.getElementById('detectedPoints').innerText = '0';

    if (scanBtn) {
        scanBtn.innerText = "Analyse en cours...";
        scanBtn.disabled = true;
    }

    try {
        await initOnnxSessions();

        // 1. Inférence Phase 1 (YOLO-OBB)
        const rawBoxes = await runYoloObbInference(photoCanvas);
        const filteredBoxes = applyRotatedNMS(rawBoxes, 0.30);

        // 2. Inférence Phase 2 (Redressement & Micro-CNNs) — identique au script Python (OpenCV.js)
        const candidates = [];

        const photoMat = cv.imread(photoCanvas);
        try {
            for (const box of filteredBoxes) {
                const warped = warpCornerCv(photoMat, box.pts, 120, 180);
                const { rankCanvas, suitCanvas } = splitComponentsCv(warped);
                warped.delete();

                const rankPred = await predictMicroCNN(sessionRanks, rankCanvas, true);
                const suitPred = await predictMicroCNN(sessionSuits, suitCanvas, false);

                const rankName = RANKS_CLASSES[rankPred.idx];
                const suitName = SUITS_CLASSES[suitPred.idx];

                candidates.push({
                    key: `${rankName}_${suitName}`,
                    pts: box.pts,
                    rankName,
                    suitName,
                    // confiance globale = YOLO x rang x enseigne
                    score: box.conf * rankPred.conf * suitPred.conf
                });
            }
        } finally {
            photoMat.delete();
        }

        // Une même carte ne peut exister qu'une fois dans un pli : on garde la plus confiante
        const bestByCard = new Map();
        for (const c of candidates) {
            const prev = bestByCard.get(c.key);
            if (!prev || c.score > prev.score) bestByCard.set(c.key, c);
        }
        const detections = [...bestByCard.values()];

        // On mémorise l'analyse : un changement d'atout ne relance pas l'inférence
        lastScan = { canvas: photoCanvas, cards: detections };
        refreshScanDisplay();

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
// DESSIN DES CONTOURS ET VISUEL SUR LA PHOTO RÉELLE
// --------------------------------------------------
const SUIT_SYMBOLS = { 'coeur': '♥', 'carreau': '♦', 'pique': '♠', 'trefle': '♣' };
const SUIT_IS_RED = { 'coeur': true, 'carreau': true, 'pique': false, 'trefle': false };
const TRUMP_SYMBOLS = { H: '♥', D: '♦', S: '♠', C: '♣' };

function drawDetectionsOnCanvas(sourceCanvas, detections = []) {
    const overlay = document.getElementById('detectionsOverlay');
    if (!overlay) return;

    overlay.classList.remove('hidden');
    overlay.innerHTML = '';

    const W = sourceCanvas.width, H = sourceCanvas.height;
    const displayCanvas = document.createElement('canvas');
    displayCanvas.width = W;
    displayCanvas.height = H;
    displayCanvas.className = "w-full h-full object-contain rounded-2xl";

    const ctx = displayCanvas.getContext('2d');
    ctx.drawImage(sourceCanvas, 0, 0);

    const lineW = Math.max(3, Math.floor(W / 250));
    const bbox = pts => {
        const xs = pts.map(p => p.x), ys = pts.map(p => p.y);
        const minX = Math.min(...xs), maxX = Math.max(...xs);
        const minY = Math.min(...ys), maxY = Math.max(...ys);
        return { minX, maxX, minY, maxY, cx: (minX + maxX) / 2, cy: (minY + maxY) / 2 };
    };

    // 1. Contours des cartes détectées
    detections.forEach(det => {
        ctx.beginPath();
        det.pts.forEach((p, k) => k === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.strokeStyle = '#00FF00';
        ctx.lineWidth = lineW;
        ctx.stroke();
        ctx.fillStyle = 'rgba(0, 255, 0, 0.15)';
        ctx.fill();
    });

    // 2. Étiquette courte (ex. "V♣") près de chaque carte, sans chevauchement
    const labelFont = Math.max(18, Math.floor(W / 26));
    const gap = Math.max(4, Math.floor(labelFont * 0.25));
    const padX = Math.floor(labelFont * 0.3), padY = Math.floor(labelFont * 0.2);
    const lh = labelFont + 2 * padY;
    ctx.font = `bold ${labelFont}px sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    const placed = [];
    const overlaps = r => placed.some(p => r.x < p.x + p.w && r.x + r.w > p.x && r.y < p.y + p.h && r.y + r.h > p.y);
    const inside = r => r.x >= 0 && r.y >= 0 && r.x + r.w <= W && r.y + r.h <= H;
    const clampX = (x, w) => Math.min(Math.max(x, 0), W - w);

    [...detections].sort((a, b) => b.score - a.score).forEach(det => {
        const sym = SUIT_SYMBOLS[det.suitName] || '?';
        const rw = ctx.measureText(det.rankName).width;
        const sw = ctx.measureText(sym).width;
        const w = rw + sw + 2 * padX;
        const bb = bbox(det.pts);

        const candidates = [
            { x: clampX(bb.cx - w / 2, w), y: bb.minY - lh - gap },
            { x: clampX(bb.cx - w / 2, w), y: bb.maxY + gap },
            { x: clampX(bb.cx - w / 2, w), y: bb.minY - 2 * lh - 2 * gap },
            { x: clampX(bb.cx - w / 2, w), y: bb.maxY + lh + 2 * gap },
            { x: bb.minX - w - gap, y: bb.cy - lh / 2 },
            { x: bb.maxX + gap, y: bb.cy - lh / 2 },
            { x: clampX(bb.cx - w / 2, w), y: bb.minY - 3 * lh - 3 * gap },
            { x: clampX(bb.cx - w / 2, w), y: bb.maxY + 2 * lh + 3 * gap }
        ].map(c => ({ ...c, w, h: lh }));

        let pickIdx = candidates.findIndex(c => inside(c) && !overlaps(c));
        if (pickIdx < 0) pickIdx = 0;
        const box = { ...candidates[pickIdx] };
        box.x = clampX(box.x, w);
        box.y = Math.min(Math.max(box.y, 0), H - lh);
        placed.push(box);

        // Trait de liaison si l'étiquette a dû être décalée
        if (pickIdx > 1) {
            ctx.beginPath();
            ctx.moveTo(box.x + w / 2, box.y + lh / 2);
            ctx.lineTo(bb.cx, bb.cy);
            ctx.strokeStyle = '#FACC15';
            ctx.lineWidth = 2;
            ctx.stroke();
        }

        const isTrump = SUIT_MAP[det.suitName] === currentScannerTrump;
        ctx.fillStyle = 'rgba(255, 255, 255, 0.96)';
        ctx.fillRect(box.x, box.y, w, lh);
        ctx.lineWidth = isTrump ? 4 : 2;
        ctx.strokeStyle = isTrump ? '#F59E0B' : '#111827';
        ctx.strokeRect(box.x, box.y, w, lh);

        ctx.fillStyle = '#111827';
        ctx.fillText(det.rankName, box.x + padX, box.y + lh / 2 + 1);
        ctx.fillStyle = SUIT_IS_RED[det.suitName] ? '#DC2626' : '#111827';
        ctx.fillText(sym, box.x + padX + rw, box.y + lh / 2 + 1);
    });

    // 3. Bandeau des points en bas de la photo
    if (detections.length > 0) {
        const bandFont = Math.max(16, Math.floor(W / 30));
        const pad = Math.floor(bandFont * 0.6);
        const lineH = Math.floor(bandFont * 1.5);
        const sep = Math.floor(bandFont * 1.1);
        ctx.font = `bold ${bandFont}px sans-serif`;

        const entries = [...detections]
            .sort((a, b) => bbox(a.pts).cx - bbox(b.pts).cx)
            .map(d => {
                const sym = SUIT_SYMBOLS[d.suitName] || '?';
                const parts = [
                    { t: d.rankName, c: '#FFFFFF' },
                    { t: sym, c: SUIT_IS_RED[d.suitName] ? '#F87171' : '#E5E7EB' },
                    { t: ` ${d.points}`, c: '#FACC15' }
                ];
                const width = parts.reduce((a, p) => a + ctx.measureText(p.t).width, 0);
                return { parts, width };
            });

        const lines = [[]];
        let lineWidth = 0;
        const maxW = W - 2 * pad;
        entries.forEach(e => {
            if (lineWidth > 0 && lineWidth + sep + e.width > maxW) {
                lines.push([]);
                lineWidth = 0;
            }
            lines[lines.length - 1].push(e);
            lineWidth += (lineWidth > 0 ? sep : 0) + e.width;
        });

        const totalPoints = detections.reduce((a, d) => a + d.points, 0);
        const bandH = (lines.length + 1) * lineH + 2 * pad;
        const y0 = H - bandH;

        ctx.fillStyle = 'rgba(17, 24, 39, 0.85)';
        ctx.fillRect(0, y0, W, bandH);

        lines.forEach((line, li) => {
            let x = pad;
            const y = y0 + pad + li * lineH + lineH / 2;
            line.forEach(e => {
                e.parts.forEach(p => {
                    ctx.fillStyle = p.c;
                    ctx.fillText(p.t, x, y);
                    x += ctx.measureText(p.t).width;
                });
                x += sep;
            });
        });

        const ty = y0 + pad + lines.length * lineH + lineH / 2;
        const trumpSym = TRUMP_SYMBOLS[currentScannerTrump] || '';
        let tx = pad;
        ctx.fillStyle = '#9CA3AF';
        ctx.fillText('Atout ', tx, ty);
        tx += ctx.measureText('Atout ').width;
        ctx.fillStyle = (currentScannerTrump === 'H' || currentScannerTrump === 'D') ? '#F87171' : '#E5E7EB';
        ctx.fillText(trumpSym, tx, ty);
        tx += ctx.measureText(trumpSym).width;
        ctx.fillStyle = '#FACC15';
        ctx.fillText(`   Total : ${totalPoints} pt`, tx, ty);
    }

    ctx.textAlign = 'start';
    ctx.textBaseline = 'alphabetic';
    overlay.appendChild(displayCanvas);
}

// --------------------------------------------------
// INFÉRENCE YOLO11-OBB ONNX WEB
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
    const plane = 640 * 640;
    const floatInput = new Float32Array(3 * plane);
    for (let i = 0, p = 0; i < data.length; i += 4, p++) {
        floatInput[p] = data[i] / 255.0;
        floatInput[plane + p] = data[i + 1] / 255.0;
        floatInput[2 * plane + p] = data[i + 2] / 255.0;
    }

    const inputTensor = new ort.Tensor('float32', floatInput, [1, 3, 640, 640]);
    const outputs = await sessionYolo.run({ [sessionYolo.inputNames[0]]: inputTensor });
    const outputData = outputs[Object.keys(outputs)[0]].data;

    const boxes = [];
    const confThresh = 0.45;

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

// Aire d'un polygone (formule du lacet)
function polyArea(poly) {
    let a = 0;
    for (let i = 0; i < poly.length; i++) {
        const p = poly[i], q = poly[(i + 1) % poly.length];
        a += p.x * q.y - q.x * p.y;
    }
    return a / 2;
}

// Intersection de deux polygones convexes (Sutherland–Hodgman)
function clipConvex(subject, clip) {
    // on force un sens anti-horaire pour le polygone de découpe
    const c = polyArea(clip) < 0 ? [...clip].reverse() : clip;
    let output = subject;
    for (let i = 0; i < c.length; i++) {
        const a = c[i], b = c[(i + 1) % c.length];
        const input = output;
        output = [];
        if (input.length === 0) break;
        const inside = p => (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x) >= 0;
        const inter = (p, q) => {
            const A1 = q.y - p.y, B1 = p.x - q.x, C1 = A1 * p.x + B1 * p.y;
            const A2 = b.y - a.y, B2 = a.x - b.x, C2 = A2 * a.x + B2 * a.y;
            const det = A1 * B2 - A2 * B1;
            return { x: (B2 * C1 - B1 * C2) / det, y: (A1 * C2 - A2 * C1) / det };
        };
        for (let j = 0; j < input.length; j++) {
            const cur = input[j], prev = input[(j + input.length - 1) % input.length];
            if (inside(cur)) {
                if (!inside(prev)) output.push(inter(prev, cur));
                output.push(cur);
            } else if (inside(prev)) {
                output.push(inter(prev, cur));
            }
        }
    }
    return output;
}

function polygonIoU(p1, p2) {
    const inter = clipConvex(p1, p2);
    if (inter.length < 3) return 0;
    const interArea = Math.abs(polyArea(inter));
    const a1 = Math.abs(polyArea(p1)), a2 = Math.abs(polyArea(p2));
    const union = a1 + a2 - interArea;
    return union > 0 ? interArea / union : 0;
}

function applyRotatedNMS(boxes, iouThreshold = 0.30) {
    boxes.sort((a, b) => b.conf - a.conf);
    const result = [];

    while (boxes.length > 0) {
        const curr = boxes.shift();
        result.push(curr);
        boxes = boxes.filter(b => polygonIoU(curr.pts, b.pts) < iouThreshold);
    }
    return result;
}

// --------------------------------------------------
// REDRESSEMENT PERSPECTIVE (port exact de extract_and_warp_corner)
// --------------------------------------------------
function orderPoints(pts) {
    const s = pts.map(p => p.x + p.y);
    const d = pts.map(p => p.y - p.x);            // np.diff(axis=1)
    return {
        tl: pts[s.indexOf(Math.min(...s))],
        br: pts[s.indexOf(Math.max(...s))],
        tr: pts[d.indexOf(Math.min(...d))],
        bl: pts[d.indexOf(Math.max(...d))]
    };
}

function warpCornerCv(srcMat, pts, outW = 120, outH = 180) {
    const { tl, tr, br, bl } = orderPoints(pts);
    const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
    const maxW = Math.max(Math.trunc(dist(br, bl)), Math.trunc(dist(tr, tl)));
    const maxH = Math.max(Math.trunc(dist(tr, br)), Math.trunc(dist(tl, bl)));

    const src = cv.matFromArray(4, 1, cv.CV_32FC2,
        [tl.x, tl.y, tr.x, tr.y, br.x, br.y, bl.x, bl.y]);
    const dstArr = maxW > maxH
        ? [0, outH - 1, 0, 0, outW - 1, 0, outW - 1, outH - 1]
        : [0, 0, outW - 1, 0, outW - 1, outH - 1, 0, outH - 1];
    const dst = cv.matFromArray(4, 1, cv.CV_32FC2, dstArr);

    const M = cv.getPerspectiveTransform(src, dst);
    const out = new cv.Mat();
    cv.warpPerspective(srcMat, out, M, new cv.Size(outW, outH),
        cv.INTER_LINEAR, cv.BORDER_CONSTANT, new cv.Scalar());
    src.delete(); dst.delete(); M.delete();
    return out;                                    // RGBA, outW x outH
}

// --------------------------------------------------
// SÉPARATION RANG / ENSEIGNE (port exact de split_components)
// --------------------------------------------------
function splitComponentsCv(crop) {
    const h = crop.rows, w = crop.cols;
    const gray = new cv.Mat(), bw = new cv.Mat(), inv = new cv.Mat();
    cv.cvtColor(crop, gray, cv.COLOR_RGBA2GRAY);
    cv.threshold(gray, bw, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
    if (cv.mean(bw)[0] < 127) cv.bitwise_not(bw, bw);
    cv.bitwise_not(bw, inv);

    const mh = Math.trunc(h * 0.06), mw = Math.trunc(w * 0.05);
    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            if (y < mh || y >= h - mh || x < mw || x >= w - mw) inv.data[y * w + x] = 0;
        }
    }

    const labels = new cv.Mat(), stats = new cv.Mat(), cents = new cv.Mat();
    const n = cv.connectedComponentsWithStats(inv, labels, stats, cents);

    const comps = [];
    for (let i = 1; i < n; i++) {
        const x = stats.intAt(i, 0), y = stats.intAt(i, 1);
        const cw = stats.intAt(i, 2), ch = stats.intAt(i, 3), area = stats.intAt(i, 4);
        if (area >= 80 && ch > 8 && cw > 8) {
            comps.push({ x1: x, y1: y, x2: x + cw, y2: y + ch, cy: y + ch / 2 });
        }
    }
    comps.sort((a, b) => a.cy - b.cy);

    const blocks = [];
    for (const c of comps) {
        const b = blocks.find(b => Math.abs(c.cy - b.cy) < h * 0.18);
        if (b) {
            b.x1 = Math.min(b.x1, c.x1); b.y1 = Math.min(b.y1, c.y1);
            b.x2 = Math.max(b.x2, c.x2); b.y2 = Math.max(b.y2, c.y2);
            b.cy = (b.y1 + b.y2) / 2;
        } else {
            blocks.push({ ...c });
        }
    }
    blocks.sort((a, b) => a.y1 - b.y1);

    const pad = 2;
    const makeRect = blk => {
        const x1 = Math.max(0, blk.x1 - pad), y1 = Math.max(0, blk.y1 - pad);
        const x2 = Math.min(w, blk.x2 + pad), y2 = Math.min(h, blk.y2 + pad);
        return new cv.Rect(x1, y1, x2 - x1, y2 - y1);
    };

    let rankMat, suitMat;
    if (blocks.length >= 2) {
        rankMat = inv.roi(makeRect(blocks[0])).clone();
        suitMat = crop.roi(makeRect(blocks[1])).clone();
    } else {
        const ry1 = Math.trunc(h * 0.05), ry2 = Math.trunc(h * 0.50);
        const sy1 = Math.trunc(h * 0.42), sy2 = Math.trunc(h * 0.95);
        rankMat = inv.roi(new cv.Rect(0, ry1, w, ry2 - ry1)).clone();
        suitMat = crop.roi(new cv.Rect(0, sy1, w, sy2 - sy1)).clone();
    }

    // cv2.resize INTER_LINEAR vers 90x120 (comme predict_onnx), puis conversion en canvas
    const toCanvas = m => {
        const r = new cv.Mat();
        cv.resize(m, r, new cv.Size(90, 120), 0, 0, cv.INTER_LINEAR);
        const c = document.createElement('canvas');
        cv.imshow(c, r);
        r.delete(); m.delete();
        return c;
    };
    const result = { rankCanvas: toCanvas(rankMat), suitCanvas: toCanvas(suitMat) };

    [gray, bw, inv, labels, stats, cents].forEach(m => m.delete());
    return result;
}

// --------------------------------------------------
// INFÉRENCE MICRO-CNNS (CORRECTIF TENSEUR ALIGNÉ PYTHON)
// --------------------------------------------------
async function predictMicroCNN(session, inputCanvas, isRank = true) {
    const targetW = 90;
    const targetH = 120;
    
    const prepCanvas = document.createElement('canvas');
    prepCanvas.width = targetW;
    prepCanvas.height = targetH;
    const pCtx = prepCanvas.getContext('2d');
    pCtx.drawImage(inputCanvas, 0, 0);   // déjà en 90x120 (resize OpenCV)

    const imgData = pCtx.getImageData(0, 0, targetW, targetH).data;
    
    // Matrice Tenseur NCHW : [1, 3, 120, 90]
    const floatData = new Float32Array(3 * targetH * targetW);
    const channelSize = targetH * targetW;

    const mean = [0.485, 0.456, 0.406];
    const std = [0.229, 0.224, 0.225];

    for (let y = 0; y < targetH; y++) {
        for (let x = 0; x < targetW; x++) {
            const pixelIdx = (y * targetW + x);
            const dataIdx = pixelIdx * 4;

            const r = imgData[dataIdx] / 255.0;
            const g = imgData[dataIdx + 1] / 255.0;
            const b = imgData[dataIdx + 2] / 255.0;

            if (isRank) {
                const val = (r - 0.5) / 0.5;
                floatData[pixelIdx] = val;                   // R
                floatData[channelSize + pixelIdx] = val;     // G
                floatData[2 * channelSize + pixelIdx] = val; // B
            } else {
                floatData[pixelIdx] = (r - mean[0]) / std[0];                   // R
                floatData[channelSize + pixelIdx] = (g - mean[1]) / std[1];     // G
                floatData[2 * channelSize + pixelIdx] = (b - mean[2]) / std[2]; // B
            }
        }
    }

    const inputTensor = new ort.Tensor('float32', floatData, [1, 3, targetH, targetW]);
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
    // softmax : la proba du max vaut 1 / somme(exp(logit - max))
    let sumExp = 0;
    for (let i = 0; i < logits.length; i++) sumExp += Math.exp(logits[i] - maxVal);
    return { idx: maxIdx, conf: 1 / sumExp };
}

function applyScanToScore() {
    closeScannerModal();
    openAddModal();
    const pts = parseInt(document.getElementById('detectedPoints').innerText) || 0;
    document.getElementById('t1ScoreInput').value = pts;
    onScoreInput('t1');
}