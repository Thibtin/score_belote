from ultralytics import YOLO

model = YOLO("C:\\Users\\thiba\\Desktop\\belote-score\\model\\best_obb_phase1.pt")
model.export(format="onnx")