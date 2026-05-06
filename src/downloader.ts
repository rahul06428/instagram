import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { imageSize } from 'image-size';
import * as crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_STATE_PATH = path.join(__dirname, '../auth_state.json');

/**
 * Helper to introduce randomized delays (jitter)
 */
async function randomDelay(min: number, max: number): Promise<void> {
  const ms = Math.floor(Math.random() * (max - min + 1) + min);
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Extracts a short identifier from a URL for cleaner logging
 */
function getIdentifier(url: string): string {
  try {
    const cleanUrl = url.split('?')[0].replace(/\/$/, '');
    if (!cleanUrl) return url;
    const parts = cleanUrl.split('/');
    const lastPart = parts[parts.length - 1];
    return (typeof lastPart === 'string' && lastPart !== '') ? lastPart : url;
  } catch (e) {
    return url;
  }
}

/**
 * Processes an individual post page, handling carousels by clicking "Next"
 */
async function processPost(page: Page, postUrl: string): Promise<void> {
  console.log(`Navigating to post: ${getIdentifier(postUrl)}`);
  try {
    await page.goto(postUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    // Initial delay after navigation to allow content to load and trigger requests
    await randomDelay(2000, 4000);

    let swiped = true;
    while (swiped) {
      // Look for the "Next" button in a carousel. Instagram usually uses aria-label="Next"
      const nextButton = await page.$('[aria-label="Next"]');
      if (!nextButton) {
        swiped = false;
        continue;
      }

      try {
        await nextButton.click();
        // Wait for the new image/video to load and trigger network requests
        await randomDelay(1500, 3500);
      } catch (e) {
        // If click fails, it might be because button is not visible or clickable yet
        console.warn(`Failed to click 'Next' button on ${getIdentifier(postUrl)}, might be end of carousel.`);
        swiped = false;
      }
    }
  } catch (err) {
    console.error(`Error processing post ${getIdentifier(postUrl)}:`, err);
  }
}

export async function downloadProfileImages(profileUrl: string, debugMode: boolean = false): Promise<void> {
  if (!fs.existsSync(AUTH_STATE_PATH)) {
    throw new Error('Authentication state not found. Please run login first.');
  }

  console.log(`Launching browser (Debug Mode: ${debugMode}) to download images from: ${getIdentifier(profileUrl)}`);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ storageState: AUTH_STATE_PATH });

  // Extract username for directory naming
  const urlParts = profileUrl.replace(/\/$/, '').split('/');
  const username = urlParts[urlParts.length - 1] || 'unknown';
  const downloadDir = path.join(__dirname, '../downloads', username);

  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const downloadedUrls = new Set<string>();
  const downloadedHashes = new Set<string>();
  const seenPosts = new Set<string>(); // All posts encountered in DOM
  const postQueue: string[] = [];     // Posts to be processed
  let imageCount = 0;

  console.log(`Created download directory: ${downloadDir}`);

    // Intercept network responses at the CONTEXT level to catch all tabs/pages
    context.on('response', async (response) => {
      const url = response.url();
      const headers = response.headers();
      const contentType = headers['content-type'];

      const isInstagramContent = url.includes('fbcdn.net') || url.includes('instagram.com');
      const isAdOrTracker = url.includes('google.com') || url.includes('doubleclick.net') || url.includes('facebook.com/tr/');

      // Detect videos for logging purposes
      if (typeof contentType === 'string' && contentType.startsWith('video/') && isInstagramContent && !isAdOrTracker) {
        console.log(`[Detected] Video content found: ${getIdentifier(url)}`);
      }

      // Only process images
      if (typeof contentType === 'string' && contentType.startsWith('image/') && isInstagramContent && !isAdOrTracker) {
        const contentTypeStr = contentType; 
        if (!downloadedUrls.has(url)) {
          downloadedUrls.add(url);
          try {
            const buffer = await response.body();

            // Filter out small images (thumbnails, icons) - only for images
            try {
              const dimensions = imageSize(buffer);
              if (dimensions.width < 400 || dimensions.height < 400) return;
            } catch (e) {
              return;
            }

            // Check for duplicates using MD5 hash
            const hash = crypto.createHash('md5').update(buffer).digest('hex');
            if (downloadedHashes.has(hash)) return;
            downloadedHashes.add(hash);

            const parts = contentTypeStr.split('/');
            let extension: string = 'jpg';
            if (parts.length > 1 && parts[1]) {
              const subParts = parts[1].split(';');
              extension = subParts[0] ?? 'jpg';
            }
            const ext = extension;
            const fileName = `${Date.now()}-${imageCount}.${ext}`;
            const filePath = path.join(downloadDir, fileName);

            fs.writeFileSync(filePath, buffer);
            imageCount++;
            console.log(`Downloaded: ${fileName}`);
          } catch (err) {
            // Fail silently for individual image download errors
          }
        }
      }
    });

  const mainPage = await context.newPage();

  try {
    await mainPage.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    try {
      await mainPage.waitForSelector('header, article, [role="main"]', { timeout: 15000 });
      console.log('Profile page loaded.');
    } catch (e) {
      console.warn('Could not detect specific profile element, continuing anyway...');
    }

    let scrollAttempts = 0;
    const maxScrolls = debugMode ? 3 : 200;
    let consecutiveNoChangeCount = 0;
    const maxConsecutiveNoChange = 8;

    console.log(`Starting interleaved loop (Max scrolls: ${maxScrolls})...`);

    while (scrollAttempts < maxScrolls) {
      // 1. Scroll on main page
      const previousHeight = await mainPage.evaluate(() => document.body.scrollHeight);
      await mainPage.evaluate(() => window.scrollBy(0, window.innerHeight * (1.2 + Math.random() * 0.6)));
      await randomDelay(2500, 4500);

      const currentHeight = await mainPage.evaluate(() => document.body.scrollHeight);

      if (currentHeight <= previousHeight) {
        consecutiveNoChangeCount++;
        console.log(`No height change (${consecutiveNoChangeCount}/${maxConsecutiveNoChange})`);
        if (consecutiveNoChangeCount >= maxConsecutiveNoChange) break;
      } else {
        consecutiveNoChangeCount = 0;
      }

      scrollAttempts++;

      // 2. Discover ALL posts in current view and add to queue
      const postUrls = (await mainPage.evaluate(() => {
        const anchors = Array.from(document.querySelectorAll('a[href*="/p/"]')) as HTMLAnchorElement[];
        return anchors.map((a) => a.href.split('?')[0]);
      })) as string[];

      let newlyDiscoveredCount = 0;
      for (const url of postUrls) {
          if (!seenPosts.has(url)) {
              seenPosts.add(url);
              postQueue.push(url);
              newlyDiscoveredCount++;
          }
      }

      if (newlyDiscoveredCount > 0) {
        console.log(`[Discovery] Found ${newlyDiscoveredCount} new posts. Total seen so far: ${seenPosts.size}. Queue size: ${postQueue.length}`);
      }

      // 3. Process one from queue if available
      if (postQueue.length > 0) {
        const randomIndex = Math.floor(Math.random() * postQueue.length);
        const targetPostUrl = postQueue.splice(randomIndex, 1)[0]!;
        
        console.log(`[Processing] ${getIdentifier(targetPostUrl)} | Remaining in queue: ${postQueue.length}`);

        const postPage = await context.newPage();
        await processPost(postPage, targetPostUrl);
        await postPage.close();

        // Jitter after returning to main page
        await randomDelay(2000, 5000);
      } else {
        console.log('No posts in queue to process, scrolling more...');
      }
    }

    // 4. Drain remaining queue
    if (postQueue.length > 0) {
      console.log(`[Cleanup] Scroll loop finished. Draining remaining ${postQueue.length} posts from queue...`);
      while (postQueue.length > 0) {
        const randomIndex = Math.floor(Math.random() * postQueue.length);
        const targetPostUrl = postQueue.splice(randomIndex, 1)[0]!;

        console.log(`[Processing] ${getIdentifier(targetPostUrl)} | Remaining in queue: ${postQueue.length}`);

        const postPage = await context.newPage();
        await processPost(postPage, targetPostUrl);
        await postPage.close();

        await randomDelay(2000, 4000);
      }
    }

    console.log(`Finished. Total images downloaded: ${imageCount}`);
  } catch (error) {
    console.error('An error occurred during the download process:', error);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

// For testing directly
if (process.argv[2]) {
  const url = process.argv[2];
  const debugMode = process.argv.includes('--debug');
  downloadProfileImages(url, debugMode).catch((err) => console.error(err));
}


