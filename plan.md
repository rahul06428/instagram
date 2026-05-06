# Instagram Image Downloader Bot Plan

## Overview
A Playwright-based automation tool to download images from specific Instagram profiles by intercepting network traffic during scrolling.

## Phase 1: Authentication & Session Management
- [ ] **Setup**: Initialize a Node.js project with Playwright and TypeScript.
- [ ] **Headed Browser Launch**: Open a visible browser window for manual interaction.
- [ ] **Manual Login Flow**:
    - Launch browser and navigate to `https://www.instagram.com/`.
    - Wait for the user to perform login operations manually.
    - Detect successful landing on the Home page (e.g., by checking for the existence of the navigation sidebar or feed elements).
- [ ] **Session Persistence**: Save authentication state (cookies and local storage) to a file to allow subsequent runs without re-login.

## Phase 2: Image Interception & Downloading
- [ ] **Profile Navigation**: Navigate to the target user's profile URL.
- [ ] **Network Interception**:
    - Use Playwright's `page.on('response')` listener.
    - Filter for image assets (e.g., URLs ending in `.jpg`, `.webp`, or containing Instagram's CDN domain).
- [ ] **Storage Logic**: 
    - Create a local directory named after the target profile.
    - Implement a mechanism to avoid duplicate downloads using a Set of processed URLs.
    - Save files with unique names.

## Phase 3: Automated Scrolling & Continuous Extraction
- [ ] **Infinite Scroll Implementation**: 
    - Periodically scroll down the page using `window.scrollBy`.
    - Wait for new content to load and network responses to trigger.
- [ ] **Continuous Loop**: Continue scrolling and intercepting until no more new images are detected or a limit is reached.

## Phase 4: Optimization & Anti-Detection
- [ ] **Randomized Delays**: Add human-like delays between scrolls and actions.
- [ ] **Error Handling**: Gracefully handle network failures, unexpected popups (e.g., "Save Login Info"), and session expiration.
