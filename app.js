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
    lucide.createIcons();
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
// 4. SCANNER CAMERA & LOGIQUE YOLO
// ==========================================
const YOLO_CLASSES = [
  '10C', '10D', '10H', '10S', '2C', '2D', '2H', '2S', 
  '3C', '3D', '3H', '3S', '4C', '4D', '4H', '4S', 
  '5C', '5D', '5H', '5S', '6C', '6D', '6H', '6S', 
  '7C', '7D', '7H', '7S', '8C', '8D', '8H', '8S', 
  '9C', '9D', '9H', '9S', 'AC', 'AD', 'AH', 'AS', 
  'JC', 'JD', 'JH', 'JS', 'KC', 'KD', 'KH', 'KS', 
  'QC', 'QD', 'QH', 'QS'
];

const BELOTE_VALUES = {
  'J': [20, 2],  '9': [14, 0],  'A': [11, 11], '10': [10, 10],
  'K': [4, 4],   'Q': [3, 3],   '8': [0, 0],   '7': [0, 0],
  '6': [0, 0],   '5': [0, 0],   '4': [0, 0],   '3': [0, 0],   '2': [0, 0]
};

let yoloSession = null;
let currentScannerTrump = 'H';

let videoStream = null;

async function openScannerModal() {
    document.getElementById('cameraFeed').style.backgroundImage = 'none';
    document.getElementById('scannerModal').classList.remove('hidden');
    document.getElementById('detectionsOverlay').classList.add('hidden');
    document.getElementById('detectedCount').innerText = '0';
    document.getElementById('detectedPoints').innerText = '0';
    document.getElementById('applyScanBtn').classList.add('hidden');
    document.getElementById('scanTriggerBtn').classList.remove('hidden');
    selectScannerTrump('H');

    // Démarrage de la caméra arrière du téléphone
    try {
        const video = document.getElementById('cameraFeed');
        videoStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { exact: "environment" } } // Force la caméra arrière
        });
        video.srcObject = videoStream;
    } catch (err) {
        console.warn("Caméra arrière indisponible, essai avec caméra par défaut...", err);
        try {
            const video = document.getElementById('cameraFeed');
            videoStream = await navigator.mediaDevices.getUserMedia({ video: true });
            video.srcObject = videoStream;
        } catch (e) {
            alert("Impossible d'accéder à la caméra. Vérifie les autorisations dans ton navigateur.");
        }
    }
}

function closeScannerModal() {
    document.getElementById('scannerModal').classList.add('hidden');
    // Éteindre la caméra pour économiser la batterie
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

async function runYoloDetection() {
    const scanBtn = document.getElementById('scanTriggerBtn');
    const applyBtn = document.getElementById('applyScanBtn');
    const overlay = document.getElementById('detectionsOverlay');
    const video = document.getElementById('cameraFeed');

    if (!video || !video.videoWidth) {
        alert("La caméra n'est pas encore prête.");
        return;
    }

    scanBtn.innerText = "Capture & Analyse...";
    scanBtn.disabled = true;

    try {
        // 1. DESSINER LA PHOTO FIGÉE SUR UN CANVAS PERMANENT
        const photoCanvas = document.createElement('canvas');
        photoCanvas.width = video.videoWidth;
        photoCanvas.height = video.videoHeight;
        const photoCtx = photoCanvas.getContext('2d');
        photoCtx.drawImage(video, 0, 0, photoCanvas.width, photoCanvas.height);

        // 2. ÉTEINDRE LA CAMÉRA IMMÉDIATEMENT POUR FIGER L'IMAGE
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
        }

        // Remplacer la vidéo active par la photo capturée dans le viseur
        video.pause();
        video.style.backgroundImage = `url(${photoCanvas.toDataURL('image/jpeg')})`;
        video.style.backgroundSize = 'cover';
        video.style.backgroundPosition = 'center';

        // 3. PRÉPARER L'IMAGE DANS LE FORMAT 640x640 POUR YOLO
        if (!yoloSession) {
            yoloSession = await ort.InferenceSession.create('./model/best.onnx');
        }

        const yoloCanvas = document.createElement('canvas');
        yoloCanvas.width = 640;
        yoloCanvas.height = 640;
        const yoloCtx = yoloCanvas.getContext('2d');
        yoloCtx.drawImage(photoCanvas, 0, 0, 640, 640);
        
        const { data } = yoloCtx.getImageData(0, 0, 640, 640);

        // Conversion RGBA -> Tensor Float32 [1, 3, 640, 640]
        const red = [], green = [], blue = [];
        for (let i = 0; i < data.length; i += 4) {
            red.push(data[i] / 255.0);
            green.push(data[i + 1] / 255.0);
            blue.push(data[i + 2] / 255.0);
        }
        const tensor = new ort.Tensor('float32', Float32Array.from([...red, ...green, ...blue]), [1, 3, 640, 640]);

        // 4. EXÉCUTER LE MODÈLE SUR LA PHOTO FIGÉE
        const outputs = await yoloSession.run({ images: tensor });
        const output = outputs[Object.keys(outputs)[0]];

        const detections = processDetections(output.data, currentScannerTrump);

        // 5. AFFICHER LES CADRES SUR LA PHOTO CAPTURÉE
        overlay.innerHTML = '';
        overlay.classList.remove('hidden');

        let totalPts = 0;
        detections.forEach(det => {
            totalPts += det.points;
            const box = document.createElement('div');
            box.className = 'absolute border-2 border-yellow-400 bg-yellow-500/30 rounded px-1.5 py-0.5 text-xs text-black font-extrabold shadow-lg z-30';
            box.style.left = `${(det.x / 640) * 100}%`;
            box.style.top = `${(det.y / 640) * 100}%`;
            box.style.width = `${(det.w / 640) * 100}%`;
            box.style.height = `${(det.h / 640) * 100}%`;
            box.innerHTML = `<span class="bg-yellow-400 px-1 rounded">${det.label}</span> (${det.points}pt)`;
            overlay.appendChild(box);
        });

        document.getElementById('detectedCount').innerText = detections.length;
        document.getElementById('detectedPoints').innerText = totalPts;

        scanBtn.classList.add('hidden');
        applyBtn.classList.remove('hidden');

    } catch (e) {
        console.error("YOLO Error:", e);
        alert("Erreur lors de l'analyse : " + e.message);
    } finally {
        scanBtn.innerText = "Scanner le pli";
        scanBtn.disabled = false;
    }
}

function processDetections(data, trumpSuit) {
    const threshold = 0.45;
    const boxes = [];

    for (let i = 0; i < 8400; i++) {
        let maxScore = 0;
        let classId = -1;

        for (let c = 0; c < YOLO_CLASSES.length; c++) {
            const score = data[(4 + c) * 8400 + i];
            if (score > maxScore) {
                maxScore = score;
                classId = c;
            }
        }

        if (maxScore > threshold) {
            const cx = data[0 * 8400 + i];
            const cy = data[1 * 8400 + i];
            const w = data[2 * 8400 + i];
            const h = data[3 * 8400 + i];

            const label = YOLO_CLASSES[classId];
            const suit = label.slice(-1);
            const rank = label.slice(0, -1);

            const isTrump = (suit === trumpSuit);
            const pts = BELOTE_VALUES[rank] ? (isTrump ? BELOTE_VALUES[rank][0] : BELOTE_VALUES[rank][1]) : 0;

            boxes.push({
                x: cx - w / 2,
                y: cy - h / 2,
                w: w, h: h,
                label: label,
                points: pts,
                score: maxScore
            });
        }
    }

    return applyNMS(boxes);
}

function applyNMS(boxes, iouThreshold = 0.4) {
    boxes.sort((a, b) => b.score - a.score);
    const result = [];

    while (boxes.length > 0) {
        const curr = boxes.shift();
        result.push(curr);
        boxes = boxes.filter(b => {
            const interX1 = Math.max(curr.x, b.x);
            const interY1 = Math.max(curr.y, b.y);
            const interX2 = Math.min(curr.x + curr.w, b.x + b.w);
            const interY2 = Math.min(curr.y + curr.h, b.y + b.h);

            const interArea = Math.max(0, interX2 - interX1) * Math.max(0, interY2 - interY1);
            const iou = interArea / ((curr.w * curr.h) + (b.w * b.h) - interArea);
            return iou < iouThreshold;
        });
    }

    return result;
}

function applyScanToScore() {
    closeScannerModal();
    openAddModal();
    const pts = parseInt(document.getElementById('detectedPoints').innerText) || 0;
    document.getElementById('t1ScoreInput').value = pts;
    onScoreInput('t1');
}
