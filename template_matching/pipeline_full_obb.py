import cv2
import numpy as np
import os
import glob
from ultralytics import YOLO

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# --- CONFIGURATION ---
MODEL_PATH = os.path.join(SCRIPT_DIR, "..", "model", "best_obb_phase1.pt")
TEMPLATES_DIR = os.path.join(SCRIPT_DIR, "templates")
OUTPUT_CROPS_DIR = os.path.join(SCRIPT_DIR, "output_crops")

RANKS = ['7', '8', '9', '10', 'V', 'D', 'R', 'A']
SUITS_RED = ['coeur', 'carreau']
SUITS_BLACK = ['pique', 'trefle']

# Dimensions normalisées pour le crop du coin redressé
CROP_W, CROP_H = 120, 180

os.makedirs(OUTPUT_CROPS_DIR, exist_ok=True)

# --- 1. CHARGEMENT DES TEMPLATES ---
def load_templates():
    templates_ranks = {}
    for r in RANKS:
        path = os.path.join(TEMPLATES_DIR, "ranks", f"{r}.png")
        if os.path.exists(path):
            templates_ranks[r] = cv2.imread(path, cv2.IMREAD_GRAYSCALE)

    templates_suits = {}
    for s in SUITS_RED + SUITS_BLACK:
        path = os.path.join(TEMPLATES_DIR, "suits", f"{s}.png")
        if os.path.exists(path):
            templates_suits[s] = cv2.imread(path, cv2.IMREAD_GRAYSCALE)

    return templates_ranks, templates_suits

templates_ranks, templates_suits = load_templates()

# --- 2. FONCTIONS AUXILIAIRES ---
def extract_and_warp_corner(image, points_4pt, out_w=CROP_W, out_h=CROP_H):
    """
    Applique une transformation de perspective (warpPerspective)
    à partir des 4 points OBB pour obtenir un crop à 0° parfait.
    """
    pts_src = np.array(points_4pt, dtype="float32")

    s = pts_src.sum(axis=1)
    diff = np.diff(pts_src, axis=1)

    tl = pts_src[np.argmin(s)]
    br = pts_src[np.argmax(s)]
    tr = pts_src[np.argmin(diff)]
    bl = pts_src[np.argmax(diff)]

    w1 = np.linalg.norm(br - bl)
    w2 = np.linalg.norm(tr - tl)
    max_w = max(int(w1), int(w2))

    h1 = np.linalg.norm(tr - br)
    h2 = np.linalg.norm(tl - bl)
    max_h = max(int(h1), int(h2))

    rect = np.array([tl, tr, br, bl], dtype="float32")

    if max_w > max_h:
        dst = np.array([
            [0, out_h - 1],
            [0, 0],
            [out_w - 1, 0],
            [out_w - 1, out_h - 1]
        ], dtype="float32")
    else:
        dst = np.array([
            [0, 0],
            [out_w - 1, 0],
            [out_w - 1, out_h - 1],
            [0, out_h - 1]
        ], dtype="float32")

    M = cv2.getPerspectiveTransform(rect, dst)
    return cv2.warpPerspective(image, M, (out_w, out_h))

def detect_color_hsv(crop_bgr):
    """ Filtre HSV pour détecter si l'enseigne est Rouge ou Noire """
    hsv = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2HSV)
    lower_red1, upper_red1 = np.array([0, 40, 40]), np.array([10, 255, 255])
    lower_red2, upper_red2 = np.array([170, 40, 40]), np.array([180, 255, 255])
    mask = cv2.inRange(hsv, lower_red1, upper_red1) + cv2.inRange(hsv, lower_red2, upper_red2)
    ratio = np.sum(mask > 0) / float(crop_bgr.shape[0] * crop_bgr.shape[1] + 1e-5)
    return "RED" if ratio > 0.02 else "BLACK"

def crop_tight_component(bw_img, min_area=80):
    """
    Isole dynamiquement la bounding box exacte du Rang (haut)
    et de l'Enseigne (bas) sans coupe fixe arbitraire.
    """
    h, w = bw_img.shape
    inv_bw = cv2.bitwise_not(bw_img)
    
    # Nettoyage préventif des bordures extrêmes (1 px)
    inv_bw[0, :] = 0
    inv_bw[-1, :] = 0
    inv_bw[:, 0] = 0
    inv_bw[:, -1] = 0

    num_labels, labels, stats, centroids = cv2.connectedComponentsWithStats(inv_bw)

    valid_components = []
    for i in range(1, num_labels):
        x, y, comp_w, comp_h, area = stats[i]
        if area >= min_area:
            valid_components.append({
                'id': i, 'x1': x, 'y1': y, 'x2': x + comp_w, 'y2': y + comp_h,
                'w': comp_w, 'h': comp_h, 'area': area, 'cy': y + comp_h / 2
            })

    if not valid_components:
        return bw_img[0:int(h*0.5), :], bw_img[int(h*0.4):h, :]

    # Regroupement horizontal pour le '10' (composants à hauteur Y similaire)
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

    def get_crop(block):
        pad = 2
        x1 = max(0, block['x1'] - pad)
        y1 = max(0, block['y1'] - pad)
        x2 = min(w, block['x2'] + pad)
        y2 = min(h, block['y2'] + pad)
        return bw_img[y1:y2, x1:x2]

    if len(merged_blocks) >= 2:
        rank_crop_bw = get_crop(merged_blocks[0])
        suit_crop_bw = get_crop(merged_blocks[1])
    else:
        rank_crop_bw = bw_img[0:int(h * 0.50), :]
        suit_crop_bw = bw_img[int(h * 0.40):h, :]

    return rank_crop_bw, suit_crop_bw

def match_template_robust(crop_bw, template_dict, keys):
    """ Matching adaptatif en dimension """
    best_key, max_score = "UNKNOWN", -1.0
    if crop_bw is None or crop_bw.size == 0:
        return best_key, 0.0

    h_c, w_c = crop_bw.shape[:2]

    for k in keys:
        if k not in template_dict or template_dict[k] is None:
            continue
        tmpl = template_dict[k]
        
        tmpl_resized = cv2.resize(tmpl, (w_c, h_c), interpolation=cv2.INTER_AREA)
        res = cv2.matchTemplate(crop_bw, tmpl_resized, cv2.TM_CCOEFF_NORMED)
        score = res[0][0]

        if score > max_score:
            max_score = score
            best_key = k

    return best_key, max_score

def identify_straight_crop(crop_bgr):
    """ Phase 2 : Isolation dynamique & Template Matching """
    h, w = crop_bgr.shape[:2]
    gray = cv2.cvtColor(crop_bgr, cv2.COLOR_BGR2GRAY)
    _, bw = cv2.threshold(gray, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    
    if np.mean(bw) < 127:
        bw = cv2.bitwise_not(bw)

    # 1. Extraction dynamique serrée
    rank_bw, suit_bw = crop_tight_component(bw)

    # 2. Zone d'enseigne BGR pour détection couleur HSV
    suit_bgr = crop_bgr[int(h * 0.40):h, :]

    # 3. Matching Rang
    rank, score_r = match_template_robust(rank_bw, templates_ranks, RANKS)

    # 4. Matching Enseigne
    color = detect_color_hsv(suit_bgr)
    candidates = SUITS_RED if color == "RED" else SUITS_BLACK
    suit, score_s = match_template_robust(suit_bw, templates_suits, candidates)

    return f"{rank}_{suit}", score_r, score_s

# --- 3. PIPELINE GLOBALE ---
def process_image(image_path, model, conf_thresh=0.40):
    image = cv2.imread(image_path)
    if image is None:
        print(f"Erreur d'ouverture : {image_path}")
        return

    results = model(image_path, conf=conf_thresh, imgsz=640)[0]
    detected_cards = []

    if results.obb is not None:
        boxes_pts = results.obb.xyxyxyxy.cpu().numpy()
        confidences = results.obb.conf.cpu().numpy()

        for idx, (pts, conf) in enumerate(zip(boxes_pts, confidences)):
            warped_crop = extract_and_warp_corner(image, pts)

            base_name = os.path.splitext(os.path.basename(image_path))[0]
            crop_filename = f"{base_name}_crop_{idx}.jpg"
            cv2.imwrite(os.path.join(OUTPUT_CROPS_DIR, crop_filename), warped_crop)

            card_id, score_r, score_s = identify_straight_crop(warped_crop)
            detected_cards.append({
                'card': card_id,
                'conf_obb': float(conf),
                'score_rank': float(score_r),
                'score_suit': float(score_s)
            })

    print(f"\n📸 Image : {os.path.basename(image_path)}")
    print(f"🃏 {len(detected_cards)} cartes détectées :")
    for c in detected_cards:
        print(f"   -> {c['card']} (OBB Conf: {c['conf_obb']:.2f} | Score Rang: {c['score_rank']:.2f} | Score Enseigne: {c['score_suit']:.2f})")

    return detected_cards

if __name__ == "__main__":
    print("Chargement du modèle YOLO11-OBB...")
    model = YOLO(MODEL_PATH)

    input_folder = r"C:\Users\thiba\Desktop\belote-score\IMAGE_TEST\Test1"
    
    # 1. Récupération sans doublons sous Windows
    raw_images = []
    for ext in ("*.jpg", "*.jpeg", "*.png"):
        raw_images.extend(glob.glob(os.path.join(input_folder, ext)))
        raw_images.extend(glob.glob(os.path.join(input_folder, ext.upper())))

    # Éliminer les doublons de chemins générés par Windows
    test_images = sorted(list(set(os.path.abspath(p) for p in raw_images)))

    print(f"🔍 {len(test_images)} image(s) unique(s) trouvée(s) dans : {input_folder}")

    if len(test_images) == 0:
        print("⚠️ Aucune image n'a été trouvée dans le dossier !")
    else:
        for img_p in test_images:
            process_image(img_p, model, conf_thresh=0.40)

    print("\n✅ Traitement terminé pour toutes les images.")