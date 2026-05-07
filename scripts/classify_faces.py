import cv2
import os
import shutil
import argparse
import urllib.request
import numpy as np

def download_file(url, filename):
    if not os.path.exists(filename):
        print(f"Downloading {filename}...")
        urllib.request.urlretrieve(url, filename)
        print("Download complete.")

def classify_images(input_folder, prototxt_path, model_path):
    # Define subfolders
    face_dir = os.path.join(input_folder, 'face')
    nonface_dir = os.path.join(input_folder, 'nonface')

    # Create directories if they don't exist
    os.makedirs(face_dir, exist_ok=True)
    os.makedirs(nonface_dir, exist_ok=True)

    # Supported image extensions
    valid_extensions = ('.jpg', '.jpeg', '.png', '.bmp', '.webp')

    # Get all files in the folder
    files = [f for f in os.listdir(input_folder) if f.lower().endswith(valid_extensions)]
    
    if not files:
        print(f"No images found in {input_folder}")
        return

    # Load DNN model
    net = cv2.dnn.readNetFromCaffe(prototxt_path, model_path)

    print(f"Found {len(files)} images. Starting classification with DNN...")

    count_face = 0
    count_nonface = 0

    for filename in files:
        file_path = os.path.join(input_folder, filename)
        
        try:
            img = cv2.imread(file_path)
            if img is None:
                print(f"Skipping {filename}: Could not read image.")
                continue

            # Prepare blob for DNN
            blob = cv2.dnn.blobFromImage(cv2.resize(img, (300, 300)), 1.0, (300, 300), (104.0, 177.0, 123.0))
            net.setInput(blob)
            detections = net.forward()

            has_face = False
            for i in range(0, detections.shape[2]):
                confidence = detections[0, 0, i, 2]
                if confidence > 0.5:  # Threshold
                    has_face = True
                    break

            if has_face:
                shutil.move(file_path, os.path.join(face_dir, filename))
                count_face += 1
            else:
                shutil.move(file_path, os.path.join(nonface_dir, filename))
                count_nonface += 1

        except Exception as e:
            print(f"Error processing {filename}: {e}")

    print("Classification complete.")
    print(f"Faces found and moved to '{face_dir}': {count_face}")
    print(f"Non-faces moved to '{nonface_dir}': {count_nonface}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Classify images into face and non-face folders using DNN.")
    parser.add_argument("folder", help="Path to the folder containing images.")
    args = parser.parse_args()

    prototxt_path = "deploy.prototxt"
    model_path = "res10_300x300_ssd_iter_140000.caffemodel"
    
    # URLs for OpenCV DNN Face Detector (ResNet SSD)
    prototxt_url = "https://raw.githubusercontent.com/opencv/opencv/master/samples/dnn/face_detector/deploy.prototxt"
    model_url = "https://github.com/opencv/opencv_3rdparty/raw/dnn_samples_face_detector_20170830/res10_300x300_ssd_iter_140000.caffemodel"

    if not os.path.isdir(args.folder):
        print(f"Error: {args.folder} is not a valid directory.")
    else:
        try:
            download_file(prototxt_url, prototxt_path)
            download_file(model_url, model_path)
            classify_images(args.folder, prototxt_path, model_path)
        except Exception as e:
            print(f"An error occurred during setup/execution: {e}")
