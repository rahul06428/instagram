# Instagram Profile Image Downloader

A lightweight tool built with Playwright to download high-quality profile images from Instagram profiles by automating a browser session.

## Features

- **Automated Scrolling**: Automatically scrolls through a profile to discover and load all available images.
- **Authentication Support**: Uses saved authentication state to access profiles that require login.
- **Duplicate Prevention**: Uses MD5 hashing to ensure the same image isn't downloaded multiple times.
- **Smart Filtering**: Filters out small thumbnails and icons, focusing on high-resolution content.
- **Organized Downloads**: Saves images into directories named after the target username.

## Prerequisites

- [Node.js](https://nodejs.org/) (Latest LTS recommended)
- [npm](https://www.npmjs.com/)

## Installation

1. Clone this repository:
   ```bash
   git clone https://github.com/rahul06428/instagram.git
   cd instagram
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Install Playwright browsers:
   ```bash
   npx playwright install chromium
   ```

## Usage

### 1. Image Classification (Advanced Attribute Analysis)

The tool includes a powerful classification script `scripts/classify_faces.py` that uses **InsightFace** to perform advanced face analysis (gender and age detection). It is designed to automatically curate specific datasets.

**Key Features:**
- **Smart Segregation**: Filters for images containing only adult females ($\ge$ 18) by strictly excluding any images with males or children present.
- **Detailed Rejection Reasons**: When an image is moved to the `rejected` folder, the console explicitly logs why (e.g., `contains male`, `no adult female found`).
- **Progress & Log Tracking**: Real-time progress is displayed in the console and simultaneously saved to log files for easy auditing.

**Installation:**
```bash
pip install -r requirements.txt
```

**Running Classification via Batch Script (Recommended):**
The provided batch scripts handle environment setup, dependency installation, and automated logging to the `logs/` directory.

Run:
```bash
run_classification.bat <FOLDER_PATH>
```

**Running Manually:**
```bash
python scripts/classify_faces.py <FOLDER_PATH>
```

**Example:**
If your images are in `downloads/nasa/`, run:
```bash
run_classification.bat downloads/nasa/
```
>>>>+++ REPLACE


### 2. Authentication (One-time setup)

Because Instagram requires login to view most profiles, you must first authenticate your session.

Run the following command:
```bash
npx ts-node src/auth.ts
```

A browser window will open. **Manually log in to your Instagram account.** Once you see your home feed, the script will automatically save your session state to `auth_state.json` and close the browser.

### 2. Downloading Images

Once authenticated, you can download images from any public profile by providing its URL.

Run:
```bash
npx ts-node src/downloader.ts <INSTAGRAM_PROFILE_URL>
```

**Example:**
```bash
npx ts-node src/downloader.ts https://www.instagram.com/nasa/
```

Images will be saved in the `downloads/<username>/` directory.

## Project Structure

- `src/auth.ts`: Handles the manual login process and session saving.
- `src/downloader.ts`: The core logic for navigating profiles and downloading images.
- `auth_state.json`: Stores your Instagram session (do not commit this to public repositories).
- `downloads/`: Directory where downloaded images are stored.

## Important Notes

- **Security**: The `auth_state.json` file contains sensitive session information. It is included in `.gitignore` to prevent accidental leaks. Never share this file.
- **Rate Limiting**: Use the tool responsibly. Excessive automated requests may lead to Instagram temporarily restricting your account.
- **Headless Mode**: By default, the downloader runs in "headed" mode (you will see the browser window) to ensure stability and visibility during the scrolling process.
