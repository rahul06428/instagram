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

### 1. Authentication (One-time setup)

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
