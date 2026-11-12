import os
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms, models

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
# Mettre à jour avec le chemin exact vers le dossier 'cards'
DATASET_BASE = os.path.join(SCRIPT_DIR, "dataset_phase2", "cards")

BATCH_SIZE = 16
EPOCHS = 35
LR = 0.001
IMG_SIZE = (120, 90)  # Hauteur, Largeur

# 1. Augmentation spécifique pour le Rang (Images binarisées N&B)
transform_rank = transforms.Compose([
    transforms.Resize(IMG_SIZE),
    transforms.RandomRotation(degrees=4),
    transforms.RandomAffine(degrees=0, translate=(0.03, 0.03), scale=(0.96, 1.04)),
    transforms.ToTensor(),
    transforms.Normalize([0.5], [0.5])
])

# 2. Augmentation spécifique pour l'Enseigne (Images Couleur)
transform_suit = transforms.Compose([
    transforms.Resize(IMG_SIZE),
    transforms.RandomRotation(degrees=4),
    transforms.ColorJitter(brightness=0.3, contrast=0.3),
    transforms.ToTensor(),
    transforms.Normalize([0.485, 0.456, 0.406], [0.229, 0.224, 0.225])
])

def train_sub_classifier(task_name):
    dataset_dir = os.path.join(DATASET_BASE, task_name)
    if not os.path.exists(dataset_dir):
        print(f"❌ Dossier introuvable : {dataset_dir}")
        return

    trans = transform_rank if task_name == "ranks" else transform_suit
    dataset = datasets.ImageFolder(dataset_dir, transform=trans)
    class_names = dataset.classes
    num_classes = len(class_names)
    
    print(f"\n==========================================")
    print(f"🚀 ENTRAÎNEMENT DU MODÈLE : {task_name.upper()} ({num_classes} classes)")
    print(f"Classes détectées : {class_names}")
    print(f"Total d'images d'entraînement : {len(dataset)}")
    print(f"==========================================")

    dataloader = torch.utils.data.DataLoader(dataset, batch_size=BATCH_SIZE, shuffle=True)
    device = torch.device("cuda:0" if torch.cuda.is_available() else "cpu")
    print(f"🖥️ Exécution des calculs sur : {device}")

    # Transfer Learning via MobileNetV3-Small
    model = models.mobilenet_v3_small(weights=models.MobileNet_V3_Small_Weights.DEFAULT)
    
    # Adapter la tête de sortie du modèle
    in_features = model.classifier[3].in_features
    model.classifier[3] = nn.Linear(in_features, num_classes)
    model = model.to(device)

    criterion = nn.CrossEntropyLoss()
    optimizer = optim.AdamW(model.parameters(), lr=LR)

    model.train()
    for epoch in range(EPOCHS):
        running_loss = 0.0
        corrects = 0

        for inputs, labels in dataloader:
            inputs, labels = inputs.to(device), labels.to(device)
            optimizer.zero_grad()

            outputs = model(inputs)
            _, preds = torch.max(outputs, 1)
            loss = criterion(outputs, labels)

            loss.backward()
            optimizer.step()

            running_loss += loss.item() * inputs.size(0)
            corrects += torch.sum(preds == labels.data)

        epoch_loss = running_loss / len(dataset)
        epoch_acc = corrects.double() / len(dataset)
        print(f"Epoch {epoch+1:02d}/{EPOCHS} - Loss: {epoch_loss:.4f} - Précision: {epoch_acc:.4f}")

    # Sauvegarde des noms de classes dans un fichier texte
    classes_file = os.path.join(SCRIPT_DIR, f"classes_{task_name}.txt")
    with open(classes_file, "w") as f:
        f.write("\n".join(class_names))
    print(f"📄 Noms des classes enregistrés dans : {classes_file}")

    # Exportation du modèle au format ONNX pour la PWA
    onnx_path = os.path.join(SCRIPT_DIR, f"model_{task_name}.onnx")
    print(f"📦 Exportation du modèle en ONNX vers : {onnx_path}")
    model.eval()
    dummy_input = torch.randn(1, 3, IMG_SIZE[0], IMG_SIZE[1]).to(device)

    torch.onnx.export(
        model, dummy_input, onnx_path,
        input_names=['input'], output_names=['output'],
        dynamic_axes={'input': {0: 'batch_size'}, 'output': {0: 'batch_size'}}
    )
    print(f"✅ Modèle {task_name} exporté avec succès !\n")

if __name__ == "__main__":
    # 1. Entraîner le classifieur de Rangs (7, 8, 9, 10, V, D, R, A)
    train_sub_classifier("ranks")
    
    # 2. Entraîner le classifieur d'Enseignes (coeur, carreau, pique, trefle)
    #train_sub_classifier("suits")