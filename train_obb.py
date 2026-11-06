from ultralytics import YOLO

def main():
    # 1. Charger YOLO11 Nano OBB
    model = YOLO("yolo11n-obb.pt")

    # 2. Entraînement optimisé
    results = model.train(
        data="yolo/data.yaml",
        epochs=150,               # 150 époques suffisent amplement
        patience=25,              # Early stopping si stagnation
        imgsz=640,                # Standard idéal pour la PWA
        batch=16,                 # Recompense la vitesse à 640px
        name="belote_obb_clean",
        project="runs/obb",
        
        # --- Optimiseur ---
        optimizer="AdamW",
        lr0=0.001,
        cos_lr=True,
        
        # --- Geometrie & Rotations adaptées aux mains de cartes ---
        degrees=45.0,             # Rotation modérée (angles de prise de vue réels)
        fliplr=0.0,               # DÉSACTIVÉ : Évite d'inverser les lettres/chiffres
        flipud=0.0,               # DÉSACTIVÉ : Évite de mettre le coin la tête en bas
        scale=0.3,                # Zoom dynamique léger (±30%)
        perspective=0.0005,       # Inclinaison légère de la caméra
        
        # --- Couleurs & Luminosité (Invariable pour le Rouge/Noir) ---
        hsv_h=0.015,              # Garde la teinte intacte (Rouge/Noir)
        hsv_s=0.4,
        hsv_v=0.4,
        
        # --- Désactivations strictes ---
        erasing=0.0,
        mixup=0.0,
        copy_paste=0.0,
        
        # --- Mosaïque ---
        mosaic=1.0,
        close_mosaic=15,          # Affinement sans mosaïque à la fin
        
        device=0                  # GPU
    )

    # 3. Exportation ONNX pour PWA
    print("Exportation en ONNX pour le Web...")
    model.export(format="onnx", imgsz=640)

if __name__ == "__main__":
    main()