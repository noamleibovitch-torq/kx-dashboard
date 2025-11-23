// Hot Update System - Updates content files without replacing the app bundle
const fs = require('fs');
const path = require('path');
const https = require('https');

class HotUpdater {
  constructor() {
    this.currentVersion = require('./package.json').version;
    this.githubToken = process.env.GH_TOKEN;
    this.owner = 'noamleibovitch-torq';
    this.repo = 'kx-dashboard';
    this.branch = 'feature/remote-updates';
    
    // Files to update
    this.updateableFiles = [
      'index.html',
      'styles.css',
      'renderer.js',
      'api.js',
      'queries.js',
      'sql/documentation_dashboard.sql',
      'sql/enrollments_dashboard.sql',
      'sql/enrollments_raw.sql',
      'jq/dashboard_merge.jq',
      'jq/labs_transform.jq'
    ];
  }

  async checkForUpdates() {
    try {
      console.log('🔍 Checking for content updates...');
      
      // Get latest package.json from GitHub
      const packageJson = await this.fetchFile('package.json');
      const latestVersion = JSON.parse(packageJson).version;
      
      console.log(`   Current: ${this.currentVersion} | Latest: ${latestVersion}`);
      
      if (this.isNewerVersion(latestVersion, this.currentVersion)) {
        console.log('✨ New version available:', latestVersion);
        return {
          available: true,
          currentVersion: this.currentVersion,
          latestVersion: latestVersion
        };
      } else {
        console.log('✅ Already up to date');
        return { available: false };
      }
    } catch (error) {
      console.error('❌ Error checking for updates:', error.message);
      return { available: false, error: error.message };
    }
  }

  async downloadUpdates() {
    try {
      console.log('📥 Downloading updates...');
      const results = [];
      
      for (const file of this.updateableFiles) {
        try {
          console.log(`   Downloading ${file}...`);
          const content = await this.fetchFile(`electron-app/${file}`);
          
          // Save to temp location first
          const tempPath = path.join(__dirname, `.${file}.tmp`);
          const targetPath = path.join(__dirname, file);
          
          // Ensure directory exists
          const dir = path.dirname(tempPath);
          if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
          }
          
          fs.writeFileSync(tempPath, content, 'utf8');
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
      
      // Move temp files to actual locations
      for (const result of downloadResults) {
        if (result.success) {
          const tempPath = path.join(__dirname, `.${result.file}.tmp`);
          const targetPath = path.join(__dirname, result.file);
          
          if (fs.existsSync(tempPath)) {
            fs.renameSync(tempPath, targetPath);
            console.log(`   ✓ Applied ${result.file}`);
          }
        }
      }
      
      // Update version in local package.json
      const packagePath = path.join(__dirname, 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf8'));
      const latestPackage = JSON.parse(await this.fetchFile('electron-app/package.json'));
      packageJson.version = latestPackage.version;
      fs.writeFileSync(packagePath, JSON.stringify(packageJson, null, 2));
      
      console.log('✅ Updates applied successfully');
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
    // Remove any leftover temp files
    this.updateableFiles.forEach(file => {
      const tempPath = path.join(__dirname, `.${file}.tmp`);
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    });
  }
}

module.exports = HotUpdater;

