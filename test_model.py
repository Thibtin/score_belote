from pathlib import Path
import cv2
from ultralytics import YOLO

def main():
    # 1. Charger le modèle
    model_path = r"C:\Users\thiba\Desktop\belote-score\runs\obb\runs\obb\belote_obb_clean\weights\best.pt"
    model = YOLO(model_path)

    # 2. Dossier contenant les images à tester
    folder_path = Path(r"C:\Users\thiba\Desktop\belote-score\IMAGE_TEST")
    
    # Extensions d'images prises en compte
    valid_extensions = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
    image_paths = [p for p in folder_path.iterdir() if p.suffix.lower() in valid_extensions]

    if not image_paths:
        print(f"Aucune image trouvée dans : {folder_path}")
        return

    print(f"{len(image_paths)} image(s) trouvée(s).")
    print("Commandes : Appuie sur n'importe quelle touche pour passer à l'image suivante, ou 'q' / 'Échap' pour quitter.")

    # 3. Boucle sur chaque image du dossier
    for idx, image_path in enumerate(image_paths, start=1):
        print(f"\n[{idx}/{len(image_paths)}] Inférence sur : {image_path.name}")

        # Inférence
        results = model.predict(source=str(image_path), imgsz=1024, conf=0.25)

        # Image annotée
        annotated_frame = results[0].plot()

        # Redimensionnement (max 800px)
        h, w = annotated_frame.shape[:2]
        max_size = 800

        if max(h, w) > max_size:
            scale = max_size / float(max(h, w))
            new_w = int(w * scale)
            new_h = int(h * scale)
            resized_frame = cv2.resize(annotated_frame, (new_w, new_h), interpolation=cv2.INTER_AREA)
        else:
            resized_frame = annotated_frame

        # Affichage
        cv2.imshow("Detections YOLO OBB", resized_frame)

        # Attente d'une touche
        key = cv2.waitKey(0) & 0xFF
        # Touche 'q' (113) ou Échap (27) pour fermer prématurément
        if key in (ord('q'), 27):
            print("Interruption du test.")
            break

    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()