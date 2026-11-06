import cv2
import numpy as np
import os
import glob
import onnxruntime as ort

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# --- 1. CONFIGURATION DES CHEMINS ---
MODEL_YOLO_ONNX = os.path.join(SCRIPT_DIR, "..", "model", "best_obb_phase1.onnx")
MODEL_RANKS_ONNX = os.path.join(SCRIPT_DIR, "..", "model", "model_ranks.onnx")
MODEL_SUITS_ONNX = os.path.join(SCRIPT_DIR, "..", "model", "model_suits.onnx")

CLASSES_RANKS_PATH = os.path.join(SCRIPT_DIR, "classes_ranks.txt")
CLASSES_SUITS_PATH = os.path.join(SCRIPT_DIR, "classes_suits.txt")

OUTPUT_DEBUG_DIR = os.path.join(SCRIPT_DIR, "output_debug")
CROP_W, CROP_H = 120, 180
IMG_SIZE_CNN = (90, 120)

os.makedirs(OUTPUT_DEBUG_DIR, exist_ok=True)

# --- 2. INITIALISATION DES SESSIONS ONNX ---
def load_classes(filepath):
    with open(filepath, "r") as f:
        return [line.strip() for line in f.readlines() if line.strip()]

RANKS = load_classes(CLASSES_RANKS_PATH)
SUITS = load_classes(CLASSES_SUITS_PATH)

print(f"✅ Classes Rangs : {RANKS}")
print(f"✅ Classes Enseignes : {SUITS}")

providers = ['CPUExecutionProvider']
session_yolo = ort.InferenceSession(MODEL_YOLO_ONNX, providers=providers)
session_ranks = ort.InferenceSession(MODEL_RANKS_ONNX, providers=providers)
session_suits = ort.InferenceSession(MODEL_SUITS_ONNX, providers=providers)

# --- 3. DÉCODAGE & NMS (NON-MAXIMUM SUPPRESSION) ---
def letterbox(img, new_shape=(640, 640), color=(114, 114, 114)):
    shape = img.shape[:2]
    r = min(new_shape[0] / shape[0], new_shape[1] / shape[1])
    new_unpad = int(round(shape[1] * r)), int(round(shape[0] * r))
    dw, dh = new_shape[1] - new_unpad[0], new_shape[0] - new_unpad[1]
    dw /= 2
    dh /= 2

    if shape[::-1] != new_unpad:
        img = cv2.resize(img, new_unpad, interpolation=cv2.INTER_LINEAR)
    top, bottom = int(round(dh - 0.1)), int(round(dh + 0.1))
    left, right = int(round(dw - 0.1)), int(round(dw + 0.1))
    img = cv2.copyMakeBorder(img, top, bottom, left, right, cv2.BORDER_CONSTANT, value=color)
    return img, r, (dw, dh)

def rbox2points(cx, cy, w, h, angle):
    cos_a = np.cos(angle)
    sin_a = np.sin(angle)
    dx, dy = w / 2.0, h / 2.0

    pts = np.array([[-dx, -dy], [dx, -dy], [dx, dy], [-dx, dy]])
    rot = np.array([[cos_a, -sin_a], [sin_a, cos_a]])
    pts_rot = np.dot(pts, rot.T)
    pts_rot[:, 0] += cx
    pts_rot[:, 1] += cy
    return pts_rot

def nms_rotated_boxes(boxes, iou_thresh=0.35):
    """ Supprime les doublons de détection YOLO trop proches """
    if len(boxes) == 0:
        return []

    # Tri par score de confiance décroissant
    boxes.sort(key=lambda x: x[1], reverse=True)
    keep = []

    while len(boxes) > 0:
        current = boxes.pop(0)
        keep.append(current)
        
        pts_curr = current[0].astype(np.int32)
        area_curr = cv2.contourArea(pts_curr)

        filtered_boxes = []
        for b in boxes:
            pts_b = b[0].astype(np.int32)
            # Calcul de l'intersection entre les deux polygones OBB
            ret, inter_pts = cv2.intersectConicalPolygons if hasattr(cv2, 'intersectConicalPolygons') else cv2.intersectConvexConvex(pts_curr, pts_b)
            
            if ret > 0 and inter_pts is not None:
                inter_area = cv2.contourArea(inter_pts)
                area_b = cv2.contourArea(pts_b)
                union_area = area_curr + area_b - inter_area
                iou = inter_area / union_area if union_area > 0 else 0
            else:
                iou = 0.0

            if iou < iou_thresh:
                filtered_boxes.append(b)
                
        boxes = filtered_boxes

    return keep

def run_yolo_obb_onnx(image_bgr, conf_thresh=0.45):
    img_padded, ratio, (dw, dh) = letterbox(image_bgr, (640, 640))
    
    blob = cv2.cvtColor(img_padded, cv2.COLOR_BGR2RGB).astype(np.float32) / 255.0
    blob = np.transpose(blob, (2, 0, 1))
    blob = np.expand_dims(blob, axis=0)

    input_name = session_yolo.get_inputs()[0].name
    outputs = session_yolo.run(None, {input_name: blob})[0]

    preds = outputs[0]
    if preds.shape[0] < preds.shape[1]:
        preds = preds.T

    raw_boxes = []
    for pred in preds:
        cx, cy, w, h = pred[0:4]
        scores = pred[4:-1] if len(pred) > 5 else [pred[4]]
        conf = float(np.max(scores))
        
        if conf >= conf_thresh:
            angle = pred[-1]
            cx = (cx - dw) / ratio
            cy = (cy - dh) / ratio
            w /= ratio
            h /= ratio
            
            pts = rbox2points(cx, cy, w, h, angle)
            raw_boxes.append((pts, conf))

    # Application du NMS pour éliminer les détections multiples sur la même carte
    return nms_rotated_boxes(raw_boxes, iou_thresh=0.30)

# --- 4. REDRESSEMENT & CLASSIFICATION ---
def extract_and_warp_corner(image, points_4pt, out_w=CROP_W, out_h=CROP_H):
    pts_src = np.array(points_4pt, dtype="float32")
    s = pts_src.sum(axis=1)
    diff = np.diff(pts_src, axis=1)

    tl = pts_src[np.argmin(s)]
    br = pts_src[np.argmax(s)]
    tr = pts_src[np.argmin(diff)]
    bl = pts_src[np.argmax(diff)]

    w1, w2 = np.linalg.norm(br - bl), np.linalg.norm(tr - tl)
    h1, h2 = np.linalg.norm(tr - br), np.linalg.norm(tl - bl)
    max_w, max_h = max(int(w1), int(w2)), max(int(h1), int(h2))

    rect = np.array([tl, tr, br, bl], dtype="float32")
    if max_w > max_h:
        dst = np.array([[0, out_h - 1], [0, 0], [out_w - 1, 0], [out_w - 1, out_h - 1]], dtype="float32")
    else:
        dst = np.array([[0, 0], [out_w - 1, 0], [out_w - 1, out_h - 1], [0, out_h - 1]], dtype="float32")

    M = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, M, (out_w, out_h))

def split_components(crop_bgr):
    h, w = crop_bgr.shape[:2]
    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    if np.mean(bw) < 127:
        bw = cv2.bitwise_not(bw)

    inv_bw = cv2.bitwise_not(bw)
    
    # Nettoyage des bords parasites (ligne du cadre de la carte)
    margin_h = int(h * 0.06)
    margin_w = int(w * 0.05)
    
    inv_bw[0:margin_h, :] = 0
    inv_bw[h - margin_h:h, :] = 0
    inv_bw[:, 0:margin_w] = 0
    inv_bw[:, w - margin_w:w] = 0

    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(inv_bw)

    valid_components = []
    for i in range(1, num_labels):
        x, y, comp_w, comp_h, area = stats[i]
        if area >= 80 and comp_h > 8 and comp_w > 8:
            valid_components.append({
                'id': i, 'x1': x, 'y1': y, 'x2': x + comp_w, 'y2': y + comp_h,
                'cy': y + comp_h / 2
            })

    valid_components.sort(key=lambda c: c['cy'])
    merged_blocks = []
    for comp in valid_components:
        matched = False
        for block in merged_blocks:
            if abs(comp['cy'] - block['cy']) < (h * 0.18):
                block['x1'] = min(block['x1'], comp['x1'])
                block['y1'] = min(block['y1'], comp['y1'])
                block['x2'] = max(block['x2'], comp['x2'])
                block['y2'] = max(block['y2'], comp['y2'])
                block['cy'] = (block['y1'] + block['y2']) / 2
                matched = True
                break
        if not matched:
            merged_blocks.append(comp)

    merged_blocks.sort(key=lambda b: b['y1'])

    pad = 2
    if len(merged_blocks) >= 2:
        rb = merged_blocks[0]
        rx1, ry1 = max(0, rb['x1'] - pad), max(0, rb['y1'] - pad)
        rx2, ry2 = min(w, rb['x2'] + pad), min(h, rb['y2'] + pad)
        
        sb = merged_blocks[1]
        sx1, sy1 = max(0, sb['x1'] - pad), max(0, sb['y1'] - pad)
        sx2, sy2 = min(w, sb['x2'] + pad), min(h, sb['y2'] + pad)

        rank_bw = inv_bw[ry1:ry2, rx1:rx2]
        suit_bgr = crop_bgr[sy1:sy2, sx1:sx2]
    else:
        rank_bw = inv_bw[int(h * 0.05):int(h * 0.50), :]
        suit_bgr = crop_bgr[int(h * 0.42):int(h * 0.95), :]

    return rank_bw, suit_bgr

def predict_onnx(session, img_input, is_rank=True):
    img_resized = cv2.resize(img_input, IMG_SIZE_CNN)
    
    if is_rank:
        if len(img_resized.shape) == 2:
            img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_GRAY2RGB)
        else:
            img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
        img_norm = (img_rgb.astype(np.float32) / 255.0 - 0.5) / 0.5
    else:
        img_rgb = cv2.cvtColor(img_resized, cv2.COLOR_BGR2RGB)
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        img_norm = ((img_rgb.astype(np.float32) / 255.0) - mean) / std

    blob = np.transpose(img_norm, (2, 0, 1))
    blob = np.expand_dims(blob, axis=0).astype(np.float32)

    input_name = session.get_inputs()[0].name
    output = session.run(None, {input_name: blob})[0]
    
    probs = np.exp(output - np.max(output)) / np.sum(np.exp(output - np.max(output)))
    class_idx = np.argmax(probs)
    return class_idx, float(probs[0][class_idx])

# --- 5. FONCTION DE DEBUG VISUEL ---
def save_debug_image(image_bgr, detected_cards, image_name):
    """ Dessine les polygones OBB et les prédictions sur l'image source """
    debug_img = image_bgr.copy()

    for item in detected_cards:
        pts = item['pts'].astype(np.int32)
        card_label = f"{item['card']} ({item['yolo_conf']:.2f})"
        
        # Dessiner le polygone du coin découpé par YOLO-OBB
        cv2.polylines(debug_img, [pts], isClosed=True, color=(0, 255, 0), thickness=3)
        
        # Position du texte au-dessus du polygone
        text_pos = (int(pts[0][0]), max(20, int(pts[0][1]) - 10))
        cv2.putText(debug_img, card_label, text_pos, cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 0, 255), 2, cv2.LINE_AA)

    out_path = os.path.join(OUTPUT_DEBUG_DIR, f"debug_{image_name}")
    cv2.imwrite(out_path, debug_img)
    print(f"🖼️ Image de debug enregistrée dans : {out_path}")

# --- 6. EXÉCUTION DE LA PIPELINE ---
def process_image(image_path):
    image = cv2.imread(image_path)
    if image is None: return

    # Inférence YOLO-OBB avec NMS
    detected_boxes = run_yolo_obb_onnx(image, conf_thresh=0.45)
    cards_found = []

    for pts, conf_yolo in detected_boxes:
        warped = extract_and_warp_corner(image, pts)
        rank_bw, suit_bgr = split_components(warped)

        # Inférence Micro-CNNs
        rank_idx, conf_r = predict_onnx(session_ranks, rank_bw, is_rank=True)
        suit_idx, conf_s = predict_onnx(session_suits, suit_bgr, is_rank=False)

        card_name = f"{RANKS[rank_idx]}_{SUITS[suit_idx]}"
        cards_found.append({
            'card': card_name,
            'pts': pts,
            'yolo_conf': conf_yolo,
            'conf_rank': conf_r,
            'conf_suit': conf_s
        })

    img_name = os.path.basename(image_path)
    print(f"\n📸 Image : {img_name}")
    print(f"🃏 {len(cards_found)} carte(s) unique(s) identifiée(s) :")
    for c in cards_found:
        print(f"   -> {c['card']} (YOLO-OBB: {c['yolo_conf']:.2f} | Conf Rang: {c['conf_rank']:.2f} | Conf Enseigne: {c['conf_suit']:.2f})")

    # Génération du visuel de debug
    save_debug_image(image, cards_found, img_name)

if __name__ == "__main__":
    print("\n⚡ Exécution Pipeline ONNX (YOLO-OBB NMS + Micro-CNNs)...")
    input_folder = r"C:\Users\thiba\Desktop\belote-score\IMAGE_TEST\Test1"
    
    test_images = sorted(list(set(
        glob.glob(os.path.join(input_folder, "*.jpg")) + 
        glob.glob(os.path.join(input_folder, "*.png"))
    )))

    for img_p in test_images:
        process_image(img_p)