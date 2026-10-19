import cv2
import numpy as np
from ultralytics import YOLO
import os

os.makedirs("crops", exist_ok=True)

model_obb = YOLO(r"C:\Users\thiba\Desktop\belote-score\model\best_cards.pt")
image_path = r"C:\Users\thiba\Desktop\belote-score\unnamed.png"
img = cv2.imread(image_path)
results = model_obb(image_path)

def order_points(pts):
    # Réordonne les points : haut-gauche, haut-droit, bas-droit, bas-gauche
    rect = np.zeros((4, 2), dtype="float32")
    s = pts.sum(axis=1)
    rect[0] = pts[np.argmin(s)]  # Haut-gauche (somme x+y minimale)
    rect[2] = pts[np.argmax(s)]  # Bas-droit (somme x+y maximale)

    diff = np.diff(pts, axis=1)
    rect[1] = pts[np.argmin(diff)] # Haut-droit (différence y-x minimale)
    rect[3] = pts[np.argmax(diff)] # Bas-gauche (différence y-x maximale)
    return rect

# Extraction et redressement de chaque carte détectée
for i, obb in enumerate(results[0].obb):
    raw_pts = obb.xyxyxyxy[0].cpu().numpy().astype(np.float32)
    
    # 1. Tri géométrique strict des 4 coins
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

    # 2. Si la carte est à l'horizontale, on pivote
    if w > h:
        crop = cv2.rotate(crop, cv2.ROTATE_90_CLOCKWISE)

    # 3. Découpe stricte des 35% du coin SUPÉRIEUR GAUCHE
    h_crop, w_crop = crop.shape[:2]
    
    # C'EST CETTE LIGNE QUI DÉCOUPE LE COIN HAUT-GAUCHE :
    corner_crop = crop[0:int(h_crop * 0.35), 0:int(w_crop * 0.35)]

    output_file = f"crops/card_{i}.jpg"
    cv2.imwrite(output_file, corner_crop)
    print(f"Coin haut-gauche enregistré : {output_file}")