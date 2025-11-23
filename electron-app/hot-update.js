// Hot Update System - Updates content files without replacing the app bundle
const fs = require('fs');
const path = require('path');
const https = require('https');
const { app } = require('electron');

class HotUpdater {
  constructor() {
    this.currentVersion = require('./package.json').version;
    this.githubToken = process.env.GH_TOKEN;
    this.owner = 'noamleibovitch-torq';
    this.repo = 'kx-dashboard';
    this.branch = 'main'; // Changed from 'feature/remote-updates' to 'main'
    
    // Use Application Support directory (writable) instead of app bundle (read-only)
    this.contentDir = path.join(app.getPath('userData'), 'content');
    
    // Ensure content directory exists
    if (!fs.existsSync(this.contentDir)) {
      fs.mkdirSync(this.contentDir, { recursive: true });
      console.log('📁 Created content directory:', this.contentDir);
    }
    
    // Files to update (exclude index.html to preserve asset paths)
    this.updateableFiles = [
      'styles.css',
      'renderer.js',
      'api.js',
      'queries.js',
      'hot-update.js',
      'sql/documentation_dashboard.sql',
      'sql/enrollments_dashboard.sql',
      'sql/enrollments_raw.sql',
      'jq/dashboard_merge.jq',
      'jq/labs_transform.jq'
    ];
  }
  
  // Get the path for a content file (writable location or app bundle fallback)
  getContentPath(file) {
    const writablePath = path.join(this.contentDir, file);
    const bundlePath = path.join(__dirname, file);
    
    // If writable version exists, use it; otherwise use bundle version
    return fs.existsSync(writablePath) ? writablePath : bundlePath;
  }
  
  // Copy initial files from bundle to writable location if they don't exist
  initializeContent() {
    for (const file of this.updateableFiles) {
      const writablePath = path.join(this.contentDir, file);
      const bundlePath = path.join(__dirname, file);
      
      // Skip if already exists in writable location
      if (fs.existsSync(writablePath)) continue;
      
      // Copy from bundle to writable location
      if (fs.existsSync(bundlePath)) {
        const dir = path.dirname(writablePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.copyFileSync(bundlePath, writablePath);
        console.log(`📋 Initialized ${file} to writable location`);
      }
    }
  }

  async checkForUpdates() {
    try {
      console.log('🔍 Checking for content updates...');
      console.log(`   Repository: ${this.owner}/${this.repo} (${this.branch})`);
      
      // Check if we have a version file in writable location
      const versionPath = path.join(this.contentDir, 'version.json');
      let currentVersion = this.currentVersion;
      
      if (fs.existsSync(versionPath)) {
        const versionData = JSON.parse(fs.readFileSync(versionPath, 'utf8'));
        currentVersion = versionData.version;
        this.currentVersion = currentVersion;
        console.log(`   Using version from cache: ${currentVersion}`);
      } else {
        console.log(`   Using version from bundle: ${currentVersion}`);
      }
      
      // Get latest package.json from GitHub
      console.log(`   Fetching: electron-app/package.json from ${this.branch}`);
      const packageJson = await this.fetchFile('electron-app/package.json');
      const latestVersion = JSON.parse(packageJson).version;
      
      console.log(`   Current: ${currentVersion} | Latest: ${latestVersion}`);
      
      if (this.isNewerVersion(latestVersion, currentVersion)) {
        console.log('✨ New version available:', latestVersion);
        return {
          available: true,
          currentVersion: currentVersion,
          latestVersion: latestVersion
        };
      } else {
        console.log('✅ Already up to date');
        return { available: false };
      }
    } catch (error) {
      console.error('❌ Error checking for updates:', error.message);
      console.error('   Stack:', error.stack);
      return { available: false, error: error.message };
    }
  }

  async downloadUpdates() {
    try {
      console.log('📥 Downloading updates to writable location...');
      const results = [];
      
      for (const file of this.updateableFiles) {
        try {
          console.log(`   Downloading ${file}...`);
          const content = await this.fetchFile(`electron-app/${file}`);
          
          // Save directly to writable location
          const targetPath = path.join(this.contentDir, file);
          const tempPath = targetPath + '.tmp';
          
          // Ensure directory exists
          const dir = path.dirname(targetPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          // Write to temp file first, then rename (atomic operation)
          fs.writeFileSync(tempPath, content, 'utf8');
          fs.renameSync(tempPath, targetPath);
          
          results.push({ file, success: true });
          console.log(`   ✓ ${file}`);
        } catch (error) {
          console.error(`   ✗ ${file}:`, error.message);
          results.push({ file, success: false, error: error.message });
        }
      }
      
      return results;
    } catch (error) {
      console.error('❌ Error downloading updates:', error.message);
      throw error;
    }
  }

  async applyUpdates(downloadResults) {
    try {
      console.log('🔄 Applying updates...');
      
      // Update version in writable location
      const versionPath = path.join(this.contentDir, 'version.json');
      const latestPackage = JSON.parse(await this.fetchFile('electron-app/package.json'));
      fs.writeFileSync(versionPath, JSON.stringify({ version: latestPackage.version }, null, 2));
      
      // Update current version tracker
      this.currentVersion = latestPackage.version;
      
      console.log('✅ Updates applied successfully - files are now in writable location');
      console.log('   Content directory:', this.contentDir);
      return true;
    } catch (error) {
      console.error('❌ Error applying updates:', error.message);
      throw error;
    }
  }

  async fetchFile(filePath) {
    return new Promise((resolve, reject) => {
      const url = `https://api.github.com/repos/${this.owner}/${this.repo}/contents/${filePath}?ref=${this.branch}`;
      
      const options = {
        headers: {
          'User-Agent': 'KX-Dashboard',
          'Accept': 'application/vnd.github.v3.raw',
          'Authorization': `token ${this.githubToken}`
        }
      };
      
      https.get(url, options, (res) => {
        if (res.statusCode !== 200) {
          reject(new Error(`GitHub API returned ${res.statusCode} for ${filePath}`));
          return;
        }
        
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => resolve(data));
      }).on('error', reject);
    });
  }

  isNewerVersion(latest, current) {
    const latestParts = latest.split('.').map(Number);
    const currentParts = current.split('.').map(Number);
    
    for (let i = 0; i < 3; i++) {
      if (latestParts[i] > currentParts[i]) return true;
      if (latestParts[i] < currentParts[i]) return false;
    }
    return false;
  }

  cleanup() {
    // Remove any leftover temp files from writable location
    this.updateableFiles.forEach(file => {
      const tempPath = path.join(this.contentDir, file + '.tmp');
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    });
  }
}

module.exports = HotUpdater;

