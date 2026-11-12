import cv2
import numpy as np
import os
import glob
from ultralytics import YOLO

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_PATH = os.path.join(SCRIPT_DIR, "..", "model", "best_obb_phase1.pt")
INPUT_IMAGES_DIR = r"C:\Users\thiba\Desktop\belote-score\IMAGE_TEST\Image_train_anglais"

# Dossiers de sortie pour les crops séparés
RANKS_RAW_DIR = os.path.join(SCRIPT_DIR, "dataset_phase2", "raw_ranks")
SUITS_RAW_DIR = os.path.join(SCRIPT_DIR, "dataset_phase2", "raw_suits")

CROP_W, CROP_H = 120, 180
os.makedirs(RANKS_RAW_DIR, exist_ok=True)
os.makedirs(SUITS_RAW_DIR, exist_ok=True)

def extract_and_warp_corner(image, points_4pt, out_w=CROP_W, out_h=CROP_H):
    """ Redresse le coin OBB à 0° """
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
    """
    Isole dynamiquement le Rang (haut) et l'Enseigne (bas) via composantes connexes.
    Retourne (rank_bw, suit_bgr).
    """
    h, w = crop_bgr.shape[:2]
    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    # Fond blanc (255), symbole noir (0) -> inverse pour le connexe
    if np.mean(bw) < 127:
        bw = cv2.bitwise_not(bw)

    inv_bw = cv2.bitwise_not(bw)
    inv_bw[0, :] = 0; inv_bw[-1, :] = 0
    inv_bw[:, 0] = 0; inv_bw[:, -1] = 0

    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(inv_bw)

    valid_components = []
    for i in range(1, num_labels):
        x, y, comp_w, comp_h, area = stats[i]
        if area >= 80:
            valid_components.append({
                'id': i, 'x1': x, 'y1': y, 'x2': x + comp_w, 'y2': y + comp_h,
                'cy': y + comp_h / 2
            })

    # Regroupement horizontal pour gérer le '10'
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
        # Bloc Rang
        rb = merged_blocks[0]
        rx1, ry1 = max(0, rb['x1'] - pad), max(0, rb['y1'] - pad)
        rx2, ry2 = min(w, rb['x2'] + pad), min(h, rb['y2'] + pad)
        
        # Bloc Enseigne
        sb = merged_blocks[1]
        sx1, sy1 = max(0, sb['x1'] - pad), max(0, sb['y1'] - pad)
        sx2, sy2 = min(w, sb['x2'] + pad), min(h, sb['y2'] + pad)

        # Crop Rang binarisé (Symbole BLANC sur fond NOIR pour le CNN)
        rank_bw = inv_bw[ry1:ry2, rx1:rx2]
        
        # Crop Enseigne en COULEUR (BGR)
        suit_bgr = crop_bgr[sy1:sy2, sx1:sx2]
    else:
        # Fallback si pas de séparation nette
        rank_bw = inv_bw[0:int(h * 0.50), :]
        suit_bgr = crop_bgr[int(h * 0.40):h, :]

    return rank_bw, suit_bgr

def generate_phase2_dataset():
    print("Chargement du modèle YOLO11-OBB...")
    model = YOLO(MODEL_PATH)

    images = glob.glob(os.path.join(INPUT_IMAGES_DIR, "*.jpg")) + glob.glob(os.path.join(INPUT_IMAGES_DIR, "*.png"))
    count = 0

    for img_path in images:
        img = cv2.imread(img_path)
        if img is None: continue
        
        results = model(img_path, conf=0.35, imgsz=640)[0]
        if results.obb is not None:
            boxes_pts = results.obb.xyxyxyxy.cpu().numpy()
            for idx, pts in enumerate(boxes_pts):
                # 1. Redressement OBB
                warped = extract_and_warp_corner(img, pts)
                
                # 2. Separation dynamique
                rank_bw, suit_bgr = split_components(warped)
                
                base_name = os.path.splitext(os.path.basename(img_path))[0]
                
                # Sauvegarde Rang (binarisé) et Enseigne (couleur)
                cv2.imwrite(os.path.join(RANKS_RAW_DIR, f"{base_name}_c{idx}_RANK.png"), rank_bw)
                cv2.imwrite(os.path.join(SUITS_RAW_DIR, f"{base_name}_c{idx}_SUIT.png"), suit_bgr)
                count += 1

    print(f"✅ {count} paires de crops générées !")
    print(f" 📂 Rangs binarisés -> {RANKS_RAW_DIR}")
    print(f" 📂 Enseignes couleurs -> {SUITS_RAW_DIR}")

if __name__ == "__main__":
    generate_phase2_dataset()