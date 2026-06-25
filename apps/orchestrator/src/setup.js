const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

console.log('🔧 PROMETHEUS ORCHESTRATOR SETUP');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

const nodeVersion = process.version;
console.log(`Node.js: ${nodeVersion}`);
if (!nodeVersion.startsWith('v20') && !nodeVersion.startsWith('v22')) {
  console.warn('⚠️  Node.js 20+ recommended. Current:', nodeVersion);
}

const envPath = path.join(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.log('📝 Creating .env from template...');
  fs.copyFileSync('.env.example', '.env');
  console.log('✅ .env created. EDIT IT NOW with your actual values.');
  console.log('   Then run: npm install && npm start');
  process.exit(0);
}

const required = ['TELEGRAM_BOT_TOKEN', 'GITHUB_TOKEN', 'CODEX_API_KEY'];
const missing = required.filter(key => !process.env[key]);

if (missing.length > 0) {
  console.error('❌ Missing required environment variables:');
  missing.forEach(v => console.error(`   - ${v}`));
  console.error('   Edit your .env file and add these values.');
  process.exit(1);
}

try {
  const codexVersion = execSync('codex --version', { encoding: 'utf8' }).trim();
  console.log(`✅ Codex CLI: ${codexVersion}`);
} catch {
  console.error('❌ Codex CLI not found. Install with:');
  console.error('   curl -fsSL https://chatgpt.com/codex/install.sh | sh');
  process.exit(1);
}

const repoPath = process.env.REPO_PATH || '/home/ec2-user/prometheus-backend';
if (!fs.existsSync(repoPath)) {
  console.log(`📁 Cloning repository to ${repoPath}...`);
  const owner = process.env.GITHUB_OWNER || 'joshwilsonwill-boop';
  const repo = process.env.GITHUB_REPO || 'PROMETHEUS-CORE-BACKEND-DEXTER';
  
  try {
    execSync(`git clone https://${process.env.GITHUB_TOKEN}@github.com/${owner}/${repo}.git ${repoPath}`, { stdio: 'inherit' });
    console.log('✅ Repository cloned');
  } catch (err) {
    console.error('❌ Failed to clone repository:', err.message);
    process.exit(1);
  }
} else {
  console.log(`✅ Repository exists at ${repoPath}`);
}

const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
  console.log('✅ Data directory created');
}

console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Setup complete! Run: npm start');
