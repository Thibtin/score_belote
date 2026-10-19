from ultralytics import YOLO

def main():
    # 1. Utilisation du modèle Medium OBB (meilleure extraction de features que le Nano)
    model = YOLO("yolo11m-obb.pt")

    # 2. Lancement de l'entraînement hyper-optimisé
    results = model.train(
        # --- Configuration globale ---
        data="yolo/data.yaml",
        epochs=200,               # Plus de tours pour un petit dataset
        patience=30,              # Early stopping si plus de progrès pendant 30 epochs
        imgsz=1024,               # Haute résolution : clé pour lire les index de cartes
        batch=8,                  # Réduit à 8 car imgsz est passé à 1024 (évite les erreurs mémoire GPU)
        name="belote_obb_max_precision",
        project="runs/obb",
        
        # --- Optimiseur & Learning Rate ---
        optimizer="AdamW",         # Excellent pour éviter l'overfitting sur petit dataset
        lr0=0.001,                # Taux d'apprentissage initial
        lrf=0.01,                 # Taux d'apprentissage final (Cosine Decay)
        cos_lr=True,              # Décroissance en cosinus pour une convergence douce
        weight_decay=0.0005,      # Régularisation
        
        # --- Rotations & Orientations (Crucial pour les cartes) ---
        degrees=180.0,            # Rotation complète (cartes dans tous les sens)
        fliplr=0.5,               # Miroir horizontal
        flipud=0.5,               # Miroir vertical
        scale=0.4,                # Zoom dynamique (±40%) pour simuler des distances variées
        
        # --- Légères déformations 3D (Caméra Smartphone) ---
        shear=2.0,                # Très léger cisaillement pour l'inclinaison sur table
        perspective=0.0005,       # Légère perspective dynamique 3D
        translate=0.1,            # Décalage léger dans l'image
        
        # --- Ajustements Lumineux (Ombres & Reflets) ---
        hsv_h=0.015,              # Faible variation de couleur (évite de fausser rouge/noir)
        hsv_s=0.5,                # Saturation
        hsv_v=0.4,                # Luminosité (simule l'éclairage de la pièce)
        
        # --- Desactivation des augmentations destructrices ---
        erasing=0.0,              # DÉSACTIVÉ : Ne pas masquer les chiffres/index dans les coins
        mixup=0.0,                # DÉSACTIVÉ : Évite de mélanger 2 cartes l'une sur l'autre
        copy_paste=0.0,           # DÉSACTIVÉ : Inutile pour de l'OBB simple
        
        # --- Mosaïque & Affinement final ---
        mosaic=1.0,               # Combine 4 images pour simuler des tapis remplis de cartes
        close_mosaic=20,          # DÉSACTIVE la mosaïque sur les 20 dernières epochs pour affiner la précision
        
        # --- Matériel ---
        device=0                  # Utilise le GPU CUDA 0
    )

    # 3. Exportation directe en ONNX une fois terminé
    print("Entraînement terminé ! Exportation en ONNX pour le PWA...")
    model.export(format="onnx", imgsz=1024)

if __name__ == "__main__":
    main()