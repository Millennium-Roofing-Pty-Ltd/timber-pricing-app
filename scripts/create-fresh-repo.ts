import { Octokit } from '@octokit/rest';
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME;
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

function getAllFiles(dirPath: string, arrayOfFiles: { path: string, fullPath: string }[] = []): { path: string, fullPath: string }[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const fullPath = path.join(dirPath, file);
    const relativePath = fullPath.startsWith('./') ? fullPath.slice(2) : fullPath;
    
    // Skip directories and files that shouldn't be in repo
    if (file === 'node_modules' || file === '.git' || file === 'dist' || 
        file === '.replit' || file === 'replit.nix' || file === '.cache' ||
        file === 'scripts' || file === '.local' || file.startsWith('.agent')) {
      return;
    }

    if (fs.statSync(fullPath).isDirectory()) {
      arrayOfFiles = getAllFiles(fullPath, arrayOfFiles);
    } else {
      arrayOfFiles.push({ path: relativePath, fullPath });
    }
  });

  return arrayOfFiles;
}

async function main() {
  console.log('🚀 Creating fresh GitHub repository...\n');

  try {
    const token = await getAccessToken();
    const octokit = new Octokit({ auth: token });
    
    const { data: user } = await octokit.users.getAuthenticated();
    console.log(`✓ Authenticated as: ${user.login}\n`);

    // Create new repository with auto_init
    const repoName = 'timber-pricing-app';
    console.log(`📦 Creating repository: ${repoName}...`);
    const { data: repo } = await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      description: 'Professional timber pricing calculator managing 37 timber items with supplier tracking, historical pricing, and comprehensive reporting (Excel/CSV/PDF exports)',
      private: false,
      auto_init: true,
    });
    console.log(`✓ Repository created: ${repo.html_url}\n`);

    // Wait for initialization
    console.log('⏳ Waiting for repository initialization...');
    await new Promise(resolve => setTimeout(resolve, 5000));

    // Get the latest commit
    const { data: ref } = await octokit.git.getRef({
      owner: user.login,
      repo: repoName,
      ref: 'heads/main',
    });
    const latestCommitSha = ref.object.sha;
    console.log('✓ Repository ready\n');

    // Collect all files
    console.log('📂 Collecting files...');
    const allFiles = getAllFiles('.').filter(f => 
      !f.path.includes('.local/') && 
      !f.path.includes('.agent') &&
      !f.path.includes('scripts/')
    );
    console.log(`✓ Found ${allFiles.length} files to upload\n`);

    // Create blobs
    console.log('📤 Creating blobs (this may take a minute)...');
    const blobs = [];
    for (let i = 0; i < allFiles.length; i++) {
      const { path: filePath, fullPath } = allFiles[i];
      try {
        const content = fs.readFileSync(fullPath, 'base64');
        const blob = await octokit.git.createBlob({
          owner: user.login,
          repo: repoName,
          content,
          encoding: 'base64',
        });
        blobs.push({
          path: filePath.replace(/\\/g, '/'),
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.data.sha,
        });
        
        if ((i + 1) % 10 === 0 || i === allFiles.length - 1) {
          process.stdout.write(`\r✓ Uploaded ${i + 1}/${allFiles.length} files...`);
        }
      } catch (error: any) {
        console.error(`\n⚠️  Error uploading ${filePath}:`, error.message);
      }
    }
    console.log('\n');

    // Create tree
    console.log('🌳 Creating tree...');
    const tree = await octokit.git.createTree({
      owner: user.login,
      repo: repoName,
      tree: blobs,
      base_tree: latestCommitSha,
    });
    console.log('✓ Tree created\n');

    // Create commit
    console.log('💾 Creating commit...');
    const commit = await octokit.git.createCommit({
      owner: user.login,
      repo: repoName,
      message: 'Add complete timber pricing calculator\n\n' +
        'Features:\n' +
        '- 37 timber sizes with Excel row sequencing\n' +
        '- 14 suppliers with market calculation controls\n' +
        '- System Pricing management with historical data\n' +
        '- Reports page with period selection and % Difference column\n' +
        '- Export functionality (Excel/CSV/PDF)\n' +
        '- Supplier filters with Apply button UX\n' +
        '- React 18 + TypeScript + Express + PostgreSQL',
      tree: tree.data.sha,
      parents: [latestCommitSha],
    });
    console.log('✓ Commit created\n');

    // Update reference
    console.log('🔄 Updating main branch...');
    await octokit.git.updateRef({
      owner: user.login,
      repo: repoName,
      ref: 'heads/main',
      sha: commit.data.sha,
    });
    console.log('✓ Branch updated\n');

    console.log('✅ SUCCESS! Your code is now on GitHub!\n');
    console.log(`🌐 Repository: ${repo.html_url}`);
    console.log(`📁 Files uploaded: ${blobs.length}`);
    console.log(`\n🔗 Clone URL: ${repo.clone_url}`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
