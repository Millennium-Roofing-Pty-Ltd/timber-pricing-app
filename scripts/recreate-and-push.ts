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

function getAllFiles(dirPath: string, arrayOfFiles: string[] = []): string[] {
  const files = fs.readdirSync(dirPath);

  files.forEach((file) => {
    const filePath = path.join(dirPath, file);
    
    // Skip certain directories and files
    if (file === 'node_modules' || file === '.git' || file === 'dist' || 
        file === '.replit' || file === 'replit.nix' || file === '.cache' ||
        file === 'scripts') {
      return;
    }

    if (fs.statSync(filePath).isDirectory()) {
      arrayOfFiles = getAllFiles(filePath, arrayOfFiles);
    } else {
      arrayOfFiles.push(filePath);
    }
  });

  return arrayOfFiles;
}

async function main() {
  console.log('🚀 Recreating repository and pushing code...\n');

  try {
    const token = await getAccessToken();
    const octokit = new Octokit({ auth: token });
    
    const owner = 'DaleTiley';
    const repo = 'timber-pricing-calculator';

    // Delete existing repository
    console.log('🗑️  Deleting existing repository...');
    try {
      await octokit.repos.delete({ owner, repo });
      console.log('✓ Existing repository deleted\n');
      // Wait a bit for GitHub to process
      await new Promise(resolve => setTimeout(resolve, 2000));
    } catch (error: any) {
      if (error.status !== 404) {
        console.log('Note: Could not delete (might not exist)\n');
      }
    }

    // Create new repository with auto_init
    console.log('📦 Creating new repository with README...');
    const { data: newRepo } = await octokit.repos.createForAuthenticatedUser({
      name: repo,
      description: 'Professional timber pricing calculator managing 37 timber items with supplier tracking, historical pricing, and comprehensive reporting (Excel/CSV/PDF exports)',
      private: false,
      auto_init: true, // This creates an initial commit with README
    });
    console.log(`✓ Repository created: ${newRepo.html_url}\n`);

    // Wait for initialization
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Get the latest commit
    console.log('📥 Getting repository state...');
    const { data: ref } = await octokit.git.getRef({
      owner,
      repo,
      ref: 'heads/main',
    });
    const latestCommitSha = ref.object.sha;
    console.log('✓ Got latest commit\n');

    // Collect all files
    console.log('📂 Collecting files...');
    const allFiles = getAllFiles('.');
    console.log(`✓ Found ${allFiles.length} files\n`);

    // Create blobs
    console.log('📤 Uploading files...');
    const blobs = await Promise.all(
      allFiles.map(async (filePath) => {
        const content = fs.readFileSync(filePath, 'base64');
        const blob = await octokit.git.createBlob({
          owner,
          repo,
          content,
          encoding: 'base64',
        });
        return {
          path: filePath.replace(/\\/g, '/'),
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.data.sha,
        };
      })
    );
    console.log(`✓ Uploaded ${blobs.length} files\n`);

    // Create tree
    console.log('🌳 Creating tree...');
    const tree = await octokit.git.createTree({
      owner,
      repo,
      tree: blobs,
      base_tree: latestCommitSha,
    });
    console.log('✓ Tree created\n');

    // Create commit
    console.log('💾 Creating commit...');
    const commit = await octokit.git.createCommit({
      owner,
      repo,
      message: 'Add complete timber pricing calculator application\n\n' +
        '- 37 timber sizes with Excel row sequencing\n' +
        '- 14 suppliers with market calculation controls\n' +
        '- System Pricing management with historical data\n' +
        '- Reports page with period selection and % Difference column\n' +
        '- Export functionality (Excel/CSV/PDF)\n' +
        '- Supplier filter with Apply button UX',
      tree: tree.data.sha,
      parents: [latestCommitSha],
    });
    console.log('✓ Commit created\n');

    // Update reference
    console.log('🔄 Updating main branch...');
    await octokit.git.updateRef({
      owner,
      repo,
      ref: 'heads/main',
      sha: commit.data.sha,
    });
    console.log('✓ Branch updated\n');

    console.log('✅ Success! Your code has been pushed to GitHub!\n');
    console.log(`🌐 Repository: https://github.com/${owner}/${repo}`);
    console.log(`📁 Files pushed: ${allFiles.length}`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
