import { chromium } from 'playwright';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_STATE_PATH = path.join(__dirname, '../auth_state.json');

/**
 * Launches a headed browser and waits for the user to log in manually.
 * Once the home page is detected, it saves the authentication state.
 */
export async function performManualLogin(): Promise<void> {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('Navigating to Instagram...');
    await page.goto('https://www.instagram.com/');

    console.log('Waiting for manual login...');
    console.log('Please log in to your Instagram account in the opened browser window.');

    // We detect "Home" by looking for the home icon/link in the sidebar or feed presence.
    const homeSelector = '[aria-label="Home"]'; 
    
    await page.waitForSelector(homeSelector, { timeout: 0 }); // Timeout 0 means wait indefinitely

    console.log('Login detected! Home page is displayed.');

    // Save storage state (cookies + local storage)
    await context.storageState({ path: AUTH_STATE_PATH });
    console.log(`Authentication state saved to: ${AUTH_STATE_PATH}`);

  } catch (error) {
    console.error('An error occurred during the login process:', error);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

// Create a main entry point for execution since ESM doesn't support require.main
async function main() {
    try {
        await performManualLogin();
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
}

main();
