from ultralytics import YOLO

model = YOLO("C:\\Users\\thiba\\Desktop\\belote-score\\model\\best.pt")
model.export(format="onnx")