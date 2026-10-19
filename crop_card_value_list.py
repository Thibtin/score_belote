import cv2
import numpy as np
from ultralytics import YOLO
import os
import glob

# 1. Dossiers d'entrée et de sortie
input_dir = r"C:\Users\thiba\Desktop\belote-score\DATA"
output_dir = r"C:\Users\thiba\Desktop\belote-score\CROPS"

os.makedirs(output_dir, exist_ok=True)

# 2. Charger le modèle OBB Phase 1
model_obb = YOLO(r"C:\Users\thiba\Desktop\belote-score\model\best_cards.pt")

def order_points(pts):
    """ Tri géométrique : haut-gauche, haut-droit, bas-droit, bas-gauche """
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]  # Haut-gauche
    rect[2] = pts[np.argmax(s)]  # Bas-droit

    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)] # Haut-droit
    rect[3] = pts[np.argmax(diff)] # Bas-gauche
    return rect

# 3. Récupérer toutes les images du dossier
extensions = ("*.jpg", "*.jpeg", "*.png", "*.JPG", "*.PNG")
image_paths = []
for ext in extensions:
    image_paths.extend(glob.glob(os.path.join(input_dir, ext)))

print(f"Nombre d'images trouvées : {len(image_paths)}")

card_counter = 0

# 4. Boucle sur chaque image
for img_path in image_paths:
    base_name = os.path.splitext(os.path.basename(img_path))[0]
    img = cv2.imread(img_path)
    
    if img is None:
        continue

    results = model_obb(img_path, verbose=False)

    for i, obb in enumerate(results[0].obb):
        raw_pts = obb.xyxyxyxy[0].cpu().numpy().astype(np.float32)
        pts = order_points(raw_pts)

        w = int(np.linalg.norm(pts[0] - pts[1]))
        h = int(np.linalg.norm(pts[0] - pts[3]))

        dst_pts = np.array([
            [0, 0],
            [w - 1, 0],
            [w - 1, h - 1],
            [0, h - 1]
        ], dtype=np.float32)

        M = cv2.getPerspectiveTransform(pts, dst_pts)
        crop = cv2.warpPerspective(img, M, (w, h))

        # Pivotement vertical si nécessaire
        if w > h:
            crop = cv2.rotate(crop, cv2.ROTATE_90_CLOCKWISE)

        # Extrait les 35% du coin supérieur gauche
        h_crop, w_crop = crop.shape[:2]
        corner_crop = crop[0:int(h_crop * 0.35), 0:int(w_crop * 0.35)]

        # Nom de fichier : nomSource_card_X.jpg
        output_filename = f"{base_name}_card_{i}.jpg"
        output_path = os.path.join(output_dir, output_filename)
        
        cv2.imwrite(output_path, corner_crop)
        card_counter += 1

print(f"Extraction terminée ! {card_counter} coins de cartes générés dans '{output_dir}'.")