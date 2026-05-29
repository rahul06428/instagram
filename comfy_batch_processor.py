import asyncio
import aiohttp
import json
import os
import sys
import base64
import random
import argparse
from pathlib import Path
from io import BytesIO
from PIL import Image

async def process_batch(session, semaphore, prompt, negative_prompt, image_paths, workflow, config):
    """Processes a batch of images (up to 5) in a single ComfyUI request."""
    filenames = ", ".join([p.name for p in image_paths])
    #print(f"[INFO] Batch queued: [{filenames}]")
    async with semaphore:
        try:
            # 1. Prepare Base64 Images for the whole batch
            base64_list = []
            for path in image_paths:
                with open(path, "rb") as img_file:
                    img_data = img_file.read()
                    b64 = f"data:image/png;base64,{base64.b64encode(img_data).decode('utf-8')}"
                    base64_list.append(b64)

            # 2. Modify Workflow
            new_workflow = json.loads(json.dumps(workflow))  # Deep copy
            
            for node_id, node in new_workflow.items():
                title = node.get("_meta", {}).get("title")
                class_type = node.get("class_type")

                if title == "PositivePrompt":
                    node["inputs"]["prompt"] = prompt
                elif title == "NegativePrompt":
                    node["inputs"]["prompt"] = negative_prompt
                elif title == "image1":
                    # The workflow expects a JSON stringified list of base64 images
                    node["inputs"]["base64Images"] = json.dumps(base64_list)
                elif class_type == "KSampler":
                    node["inputs"]["seed"] = random.randint(0, 9999999999)

            # 3. Submit Prompt
            url = config['comfyui_url']
            #print(f"[INFO] Submitting batch to ComfyUI for images: [{filenames}]")
            async with session.post(f"{url}/prompt", json={"prompt": new_workflow, "client_id": "python_batch_processor"}) as resp:
                if resp.status != 200:
                    print(f"Error submitting batch for {image_paths[0].name}: {resp.status}")
                    return

                data = await resp.json()
                prompt_id = data.get("prompt_id") or list(data.keys())[0]

            # 4. Poll History
            filenames = ", ".join([p.name for p in image_paths])
            print(f"Started processing batch of {len(image_paths)} (ID: {prompt_id}) containing: [{filenames}]")
            while True:
                async with session.get(f"{url}/history/{prompt_id}") as hist_resp:
                    if hist_resp.status == 200:
                        hist = await hist_resp.json()
                        if prompt_id in hist:
                            run_data = hist[prompt_id]
                            output_images_base64 = []
                            for output in run_data.get("outputs", {}).values():
                                if "base64Images" in output:
                                    output_images_base64.extend(output["base64Images"])
                            
                            if output_images_base64:
                                # Save results
                                processed_dir = image_paths[0].parent / "processed"
                                processed_dir.mkdir(exist_ok=True)
                                
                                for i, b64 in enumerate(output_images_base64):
                                    if "," in b64:
                                        b64 = b64.split(",")[1]
                                    
                                    img_bytes = base64.b64decode(b64)
                                    img = Image.open(BytesIO(img_bytes))
                                    # Try to name it based on the original image index if possible, 
                                    # but for simplicity we use batch info
                                    out_name = f"batch_{prompt_id[:8]}_{i}.png"
                                    img.save(processed_dir / out_name)
                                    #print(f"[SUCCESS] Saved: {out_name}")
                                
                                print(f"[SUCCESS] Completed batch: {len(output_images_base64)} image(s) saved in {processed_dir}")
                                return
                            elif "error" in run_data:
                                print(f"[ERROR] ComfyUI error for batch {prompt_id}: {run_data['error']}")
                                return
                    
                await asyncio.sleep(2)

        except Exception as e:
            print(f"[ERROR] Failed to process batch starting with {image_paths[0].name}: {str(e)}")

async def main():
    parser = argparse.ArgumentParser(description="ComfyUI Batch Image Processor (Optimized)")
    parser.add_argument("folder", type=str, help="Path to the input folder containing images")
    args = parser.parse_args()

    input_folder = Path(args.folder)
    if not input_folder.is_dir():
        print(f"Error: {args.folder} is not a directory.")
        return

    # Load Config
    try:
        with open("config.json", "r") as f:
            config = json.load(f)
    except Exception as e:
        print(f"Error loading config.json: {e}")
        return

    # Load Workflow
    try:
        with open(config["workflow_file"], "r") as f:
            workflow = json.load(f)
    except Exception as e:
        print(f"Error loading workflow file: {e}")
        return

    # Load Prompts
    prompt_file = Path("prompt.txt")
    if not prompt_file.exists():
        print("Creating default prompt.txt...")
        with open(prompt_file, "w") as f:
            f.write("a beautiful landscape\na futuristic city\na cute cat\n")
    
    with open(prompt_file, "r") as f:
        prompts = [line.strip() for line in f if line.strip()]
    
    if not prompts:
        print("Error: prompt.txt is empty.")
        return

    negative_prompt = "low quality, blurry face, blurry features, blurry hands"

    # Find images
    image_extensions = {".png", ".jpg", ".jpeg", ".webp"}
    images = sorted([f for f in input_folder.iterdir() if f.suffix.lower() in image_extensions])
    
    if not images:
        print(f"No images found in {input_folder}")
        return

    # Group images into batches of 10
    batch_size = 10
    batches = [images[i:i + batch_size] for i in range(0, len(images), batch_size)]

    print(f"Found {len(images)} images. Created {len(batches)} batches (size {batch_size}).")
    print(f"Using {len(prompts)} available prompts.")
    print(f"Processing with a concurrency of 3 batches at a time...")

    # Semaphore to limit concurrent batch requests to 3 as requested
    semaphore = asyncio.Semaphore(3)
    async with aiohttp.ClientSession() as session:
        tasks = []
        for idx, batch_images in enumerate(batches):
            # Use one prompt per batch (cycling through prompts if needed)
            prompt = prompts[idx % len(prompts)] 
            tasks.append(process_batch(session, semaphore, prompt, negative_prompt, batch_images, workflow, config))
        
        # Using return_exceptions=True so that one failed batch doesn't stop the whole process
        await asyncio.gather(*tasks, return_exceptions=True)

    print("\nAll batches completed.")

if __name__ == "__main__":
    asyncio.run(main())
