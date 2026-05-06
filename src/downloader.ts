import { chromium, type Browser, type Page, type BrowserContext } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { imageSize } from 'image-size';
import * as crypto from 'crypto';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const AUTH_STATE_PATH = path.join(__dirname, '../auth_state.json');

export async function downloadProfileImages(profileUrl: string): Promise<void> {
  if (!fs.existsSync(AUTH_STATE_PATH)) {
    throw new Error('Authentication state not found. Please run login first.');
  }

  console.log(`Launching browser to download images from: ${profileUrl}`);
  const browser = await chromium.launch({ headless: false }); // Headed for visibility during development
  const context = await browser.newContext({ storageState: AUTH_STATE_PATH });
  const page = await context.newPage();

  // Extract username from URL to create a directory name
  const urlParts = profileUrl.replace(/\/$/, '').split('/');
  const username = urlParts[urlParts.length - 1] || 'unknown';
  const downloadDir = path.join(__dirname, '../downloads', username);

  if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
  }

  const downloadedUrls = new Set<string>();
  const downloadedHashes = new Set<string>();
  let imageCount = 0;

  console.log(`Created download directory: ${downloadDir}`);

  // Intercept network responses
  page.on('response', async (response) => {
    const url = response.url();
    const headers = response.headers();
    const contentType = headers['content-type'];

    const isInstagramContent = url.includes('fbcdn.net') || url.includes('instagram.com');
    const isAdOrTracker = url.includes('google.com') || url.includes('doubleclick.net') || url.includes('facebook.com/tr/');

    if (typeof contentType === 'string' && contentType.startsWith('image/') && isInstagramContent && !isAdOrTracker) {
      if (!downloadedUrls.has(url)) {
        downloadedUrls.add(url);
        try {
          const buffer = await response.body();

          // Filter out small images (thumbnails, icons)
          const dimensions = imageSize(buffer);
          if (dimensions.width < 400 || dimensions.height < 400) {
            // console.log(`Skipping small image: ${dimensions.width}x${dimensions.height} (${url})`);
            return;
          }

          // Check for duplicates using MD5 hash
          const hash = crypto.createHash('md5').update(buffer).digest('hex');
          if (downloadedHashes.has(hash)) {
            return;
          }
          downloadedHashes.add(hash);

          const parts = contentType.split('/');
          let extension = 'jpg';
          if (parts.length > 1 && parts[1]) {
            extension = parts[1].split(';')[0];
          }
          const fileName = `${Date.now()}-${imageCount}.${extension}`;
          const filePath = path.join(downloadDir, fileName);

          fs.writeFileSync(filePath, buffer);
          imageCount++;
          console.log(`Downloaded: ${fileName} (${url})`);
        } catch (err) {
          // Some images might fail to download due to CORS or other reasons when intercepting
          // console.error(`Failed to download ${url}:`, err);
        }
      }
    }
  });

  try {
    // Use a more lenient wait condition to avoid timeouts on high-activity pages
    await page.goto(profileUrl, { waitUntil: 'domcontentloaded', timeout: 60000 });
    
    // Wait for the main content (article or profile header) to appear to ensure we are on the right page
    try {
      await page.waitForSelector('header, article, [role="main"]', { timeout: 15000 });
      console.log('Profile page loaded.');
    } catch (e) {
      console.warn('Could not detect specific profile element, continuing anyway...');
    }

    console.log('Starting scroll...');

    // Robust scrolling loop
    let previousHeight = 0;
    let currentHeight = await page.evaluate(() => document.body.scrollHeight);
    let lastImageCount = imageCount; // Track images for detection
    let scrollAttempts = 0;
    const maxScrollAttempts = 200; 
    let consecutiveNoChangeCount = 0;
    const maxConsecutiveNoChange = 8;

    console.log('Starting robust scrolling loop...');

    while (scrollAttempts < maxScrollAttempts) {
      previousHeight = currentHeight;
      
      // Scroll down by a randomized amount to trigger loading better and look more human
      await page.evaluate(() => window.scrollBy(0, window.innerHeight * (1.2 + Math.random() * 0.6)));
      
      // Wait for content to load - Instagram can be slow
      await page.waitForTimeout(3000); 
      
      currentHeight = await page.evaluate(() => document.body.scrollHeight);
      scrollAttempts++;

      if (currentHeight > previousHeight || imageCount > lastImageCount) {
        consecutiveNoChangeCount = 0; // Reset if we found new content or images
        lastImageCount = imageCount;
        console.log(`Scrolling... (${scrollAttempts}/${maxScrollAttempts}) - New content/images found!`);
      } else {
        consecutiveNoChangeCount++;
        console.log(`Scrolling... (${scrollAttempts}/${maxScrollAttempts}) - No change detected (${consecutiveNoChangeCount}/${maxConsecutiveNoChange})`);
      }

      if (consecutiveNoChangeCount >= maxConsecutiveNoChange) {
        // Before giving up, try one more long wait and a bigger scroll to see if it's just slow
        console.log('No change detected for several attempts. Trying a larger jump and longer wait...');
        await page.evaluate(() => window.scrollBy(0, window.innerHeight * 3));
        await page.waitForTimeout(5000);
        currentHeight = await page.evaluate(() => document.body.scrollHeight);

        if (currentHeight > previousHeight) {
          consecutiveNoChangeCount = 0;
          console.log('New content found after larger jump!');
        } else {
          console.log('Reached end of page or content is not loading.');
          break;
        }
      }
    }

    console.log(`Finished scrolling. Total images downloaded: ${imageCount}`);

  } catch (error) {
    console.error('An error occurred during the download process:', error);
  } finally {
    await browser.close();
    console.log('Browser closed.');
  }
}

// For testing directly
if (process.argv[2]) {
    downloadProfileImages(process.argv[2]).catch(err => console.error(err));
}
