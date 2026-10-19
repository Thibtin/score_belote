import json
import os

# Nom de ton fichier JSON COCO
coco_json_path = "labels_my-project-name_2026-10-06-02-00-28.json"
output_dir = "labels"

# Créer le dossier de sortie pour les fichiers .txt
os.makedirs(output_dir, exist_ok=True)

# Charger le fichier JSON
with open(coco_json_path, "r", encoding="utf-8") as f:
    coco_data = json.load(f)

# 1. Indexer les catégories (COCO ID -> YOLO ID qui commence à 0)
category_map = {}
for idx, cat in enumerate(coco_data.get("categories", [])):
    category_map[cat["id"]] = idx

# 2. Indexer les images (ID -> {file_name, width, height})
image_map = {}
for img in coco_data.get("images", []):
    image_map[img["id"]] = {
        "file_name": img["file_name"],
        "width": img["width"],
        "height": img["height"]
    }

# 3. Dictionnaire pour regrouper les annotations par image
annotations_by_image = {img_id: [] for img_id in image_map.keys()}

for ann in coco_data.get("annotations", []):
    img_id = ann["image_id"]
    category_id = ann["category_id"]
    segmentation = ann.get("segmentation", [])

    if not segmentation or img_id not in image_map:
        continue

    # COCO stocke la segmentation sous forme [[x1, y1, x2, y2, x3, y3, x4, y4]]
    pts = segmentation[0]
    
    # Vérifier qu'on a bien au moins 4 points (8 coordonnées)
    if len(pts) >= 8:
        yolo_cat_id = category_map.get(category_id, 0)
        annotations_by_image[img_id].append((yolo_cat_id, pts[:8]))

# 4. Générer les fichiers .txt
converted_count = 0

for img_id, img_info in image_map.items():
    img_width = img_info["width"]
    img_height = img_info["height"]
    base_name = os.path.splitext(img_info["file_name"])[0]
    txt_filename = os.path.join(output_dir, f"{base_name}.txt")

    lines = []
    for cat_id, pts in annotations_by_image[img_id]:
        # Normalisation des coordonnées entre 0 et 1
        norm_pts = []
        for i in range(0, 8, 2):
            norm_x = pts[i] / img_width
            norm_y = pts[i+1] / img_height
            norm_pts.extend([norm_x, norm_y])

        # Format YOLO OBB : class_id x1 y1 x2 y2 x3 y3 x4 y4
        pts_str = " ".join([f"{coord:.6f}" for coord in norm_pts])
        lines.append(f"{cat_id} {pts_str}")

    # Écrire le fichier .txt (même s'il est vide si aucune annotation)
    with open(txt_filename, "w", encoding="utf-8") as out_file:
        out_file.write("\n".join(lines))
    
    converted_count += 1

print(f"Conversion terminée ! {converted_count} fichiers de labels générés dans le dossier '{output_dir}'.")