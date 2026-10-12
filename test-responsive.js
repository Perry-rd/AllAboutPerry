const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const viewports = [
  { name: 'small-mobile', width: 320, height: 568 },
  { name: 'standard-mobile', width: 375, height: 667 },
  { name: 'large-mobile', width: 430, height: 932 },
  { name: 'small-tablet', width: 600, height: 960 },
  { name: 'tablet', width: 768, height: 1024 },
  { name: 'large-tablet', width: 1024, height: 768 },
  { name: 'laptop', width: 1280, height: 720 },
  { name: 'desktop', width: 1440, height: 900 },
  { name: 'large-desktop', width: 1920, height: 1080 },
];

const outputDir = path.join(__dirname, 'responsive-screenshots');
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir, { recursive: true });
}

async function testResponsive() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  
  const results = [];
  
  for (const vp of viewports) {
    console.log(`Testing ${vp.name} (${vp.width}x${vp.height})...`);
    
    await page.setViewportSize({ width: vp.width, height: vp.height });
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle', timeout: 30000 });
    
    // Wait for animations
    await page.waitForTimeout(1000);
    
    // Check for horizontal overflow
    const overflow = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });
    
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    const clientWidth = await page.evaluate(() => document.documentElement.clientWidth);
    
    // Check console errors
    const errors = [];
    page.on('console', msg => {
      if (msg.type() === 'error') {
        errors.push(msg.text());
      }
    });
    
    // Take screenshot
    const screenshotPath = path.join(outputDir, `${vp.name}.png`);
    await page.screenshot({ path: screenshotPath, fullPage: true });
    
    // Get section positions
    const sections = await page.evaluate(() => {
      const sectionIds = ['home', 'about', 'skills', 'projects', 'journey', 'contact'];
      return sectionIds.map(id => {
        const el = document.getElementById(id);
        if (!el) return null;
        const rect = el.getBoundingClientRect();
        return {
          id,
          top: rect.top,
          left: rect.left,
          width: rect.width,
          height: rect.height,
          bottom: rect.bottom
        };
      }).filter(Boolean);
    });
    
    results.push({
      viewport: vp.name,
      width: vp.width,
      height: vp.height,
      hasHorizontalOverflow: overflow,
      scrollWidth,
      clientWidth,
      consoleErrors: errors,
      sections
    });
    
    console.log(`  Horizontal overflow: ${overflow ? 'YES' : 'NO'} (scroll: ${scrollWidth}, client: ${clientWidth})`);
    if (errors.length) console.log(`  Console errors: ${errors.join(', ')}`);
  }
  
  await browser.close();
  
  // Save results
  fs.writeFileSync(
    path.join(outputDir, 'results.json'),
    JSON.stringify(results, null, 2)
  );
  
  console.log('\n=== SUMMARY ===');
  results.forEach(r => {
    console.log(`${r.viewport.padEnd(16)} ${r.width}x${r.height}: Overflow=${r.hasHorizontalOverflow ? 'YES' : 'NO'}  Errors=${r.consoleErrors.length}`);
  });
}

testResponsive().catch(console.error);