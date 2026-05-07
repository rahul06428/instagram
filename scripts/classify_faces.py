import cv2
from deepface import DeepFace
import os
import shutil
import argparse

def classify_images(input_folder):
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

    print(f"Found {len(files)} images. Starting classification with DeepFace (RetinaFace)...")

    count_face = 0
    count_nonface = 0

    for filename in files:
        file_path = os.path.join(input_folder, filename)
        
        try:
            # DeepFace.extract_faces returns a list of dictionaries.
            # Each dictionary contains 'face' (the cropped face), 'facial_area', and 'confidence'.
            # Using enforce_detection=False prevents it from raising an exception if no face is found.
            results = DeepFace.extract_faces(
                img_path=file_path, 
                detector_backend='retinaface', 
                enforce_detection=False
            )

            has_face = False
            if results:
                # Check if any detected face has a decent confidence level
                # When enforce_detection=False and no face is found, DeepFace might still return something.
                # We check the confidence score to ensure it's actually a face.
                max_confidence = max(face['confidence'] for face in results)
                if max_confidence > 0.5:  # Threshold for considering it a face
                    has_face = True

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
    parser = argparse.ArgumentParser(description="Classify images into face and non-face folders using DeepFace (RetinaFace).")
    parser.add_argument("folder", help="Path to the folder containing images.")
    args = parser.parse_args()

    if not os.path.isdir(args.folder):
        print(f"Error: {args.folder} is not a valid directory.")
    else:
        try:
            classify_images(args.folder)
        except Exception as e:
            print(f"An error occurred during execution: {e}")
