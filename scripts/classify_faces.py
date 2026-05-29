import cv2
import numpy as np
from insightface.app import FaceAnalysis
import os
import shutil
import argparse

def classify_images(input_folder):
    # Initialize InsightFace FaceAnalysis app
    # buffalo_l is a robust model pack providing detection and attribute analysis (age, gender)
    print("Initializing InsightFace (this may take a moment on first run)...")
    app = FaceAnalysis(providers=['CPUExecutionProvider'], det_size=(640, 640))
    app.prepare(ctx_id=0, det_thresh=0.5)

    # Define subfolders
    adult_females_dir = os.path.join(input_folder, 'adult_females')
    rejected_dir = os.path.join(input_folder, 'rejected')

    # Create directories if they don't exist
    os.makedirs(adult_females_dir, exist_ok=True)
    os.makedirs(rejected_dir, exist_ok=True)

    # Supported image extensions
    valid_extensions = ('.jpg', '.jpeg', '.png', '.bmp', '.webp')

    # Get all files in the folder
    files = [f for f in os.listdir(input_folder) if f.lower().endswith(valid_extensions)]
    
    if not files:
        print(f"No images found in {input_folder}")
        return

    print(f"Found {len(files)} images. Starting classification with InsightFace...")

    count_adult_females = 0
    count_rejected = 0

    for i, filename in enumerate(files, 1):
        file_path = os.path.join(input_folder, filename)
        print(f"[{i}/{len(files)}] Processing {filename}...", end=" ", flush=True)
        
        try:
            # Load image with OpenCV
            img = cv2.imread(file_path)
            if img is None:
                print(f"-> Copied to 'rejected' (could not read image)")
                shutil.copy(file_path, os.path.join(rejected_dir, filename))
                count_rejected += 1
                continue

            # Detect faces and analyze attributes in one pass
            faces = app.get(img)

            if not faces:
                shutil.copy(file_path, os.path.join(rejected_dir, filename))
                count_rejected += 1
                print(f"-> Copied to 'rejected' (no faces detected)")
                continue

            has_adult_female = False
            contains_male = False
            contains_kid = False

            for face in faces:
                # InsightFace attributes:
                # gender: 0 for Female, 1 for Male
                # age: integer representing estimated age
                gender = face.gender
                age = face.age

                if age < 10:
                    contains_kid = True
                elif gender == 1:  # Male
                    contains_male = True
                elif gender == 0 and age >= 10:  # Female & Adult
                    has_adult_female = True

            # Final criteria check: At least one adult female AND no males AND no kids
            if has_adult_female and not contains_male and not contains_kid:
                shutil.copy(file_path, os.path.join(adult_females_dir, filename))
                count_adult_females += 1
                print(f"-> Copied to 'adult_females'")
            else:
                reasons = []
                if contains_male:
                    reasons.append("contains male")
                if contains_kid:
                    reasons.append("contains kid")
                if not has_adult_female:
                    reasons.append("no adult female found")
                
                reason_str = ", ".join(reasons)
                shutil.copy(file_path, os.path.join(rejected_dir, filename))
                count_rejected += 1
                print(f"-> Copied to 'rejected' ({reason_str})")

        except Exception as e:
            print(f"\n[!] Error processing {filename}: {e}")

    print("\nClassification complete.")
    print(f"Adult females found and copied to '{adult_females_dir}': {count_adult_females}")
    print(f"Rejected images copied to '{rejected_dir}': {count_rejected}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Classify images into adult_females and rejected folders using InsightFace.")
    parser.add_argument("folder", help="Path to the folder containing images.")
    args = parser.parse_args()

    if not os.path.isdir(args.folder):
        print(f"Error: {args.folder} is not a valid directory.")
    else:
        try:
            classify_images(args.folder)
        except Exception as e:
            print(f"An error occurred during execution: {e}")
