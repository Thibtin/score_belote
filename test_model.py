import cv2
from ultralytics import YOLO

def main():
    # 1. Charger le modèle
    model_path = "C:\\Users\\thiba\\Desktop\\belote-score\\model\\best_cards.pt"
    model = YOLO(model_path)

    # 2. Image à tester
    image_path = "C:\\Users\\thiba\\Desktop\\belote-score\\IMAGE_TEST\\20261005_142750.jpg"

    # 3. Inférence
    results = model.predict(source=image_path, imgsz=1024, conf=0.25)

    # 4. Image annotée
    annotated_frame = results[0].plot()

    # 5. Redimensionner l'image directement (max 800px de large/haut)
    h, w = annotated_frame.shape[:2]
    max_size = 800

    if max(h, w) > max_size:
        scale = max_size / float(max(h, w))
        new_w = int(w * scale)
        new_h = int(h * scale)
        resized_frame = cv2.resize(annotated_frame, (new_w, new_h), interpolation=cv2.INTER_AREA)
    else:
        resized_frame = annotated_frame

    # 6. Affichage unique
    cv2.imshow("Detections YOLO OBB", resized_frame)
    
    print("Appuie sur une touche dans la fenêtre pour fermer...")
    cv2.waitKey(0)
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()