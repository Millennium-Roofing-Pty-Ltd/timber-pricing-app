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
  console.log('🚀 Pushing code to GitHub via API...\n');

  try {
    const token = await getAccessToken();
    const octokit = new Octokit({ auth: token });
    
    const owner = 'DaleTiley';
    const repo = 'timber-pricing-calculator';

    console.log('📂 Collecting files...');
    const allFiles = getAllFiles('.');
    console.log(`✓ Found ${allFiles.length} files\n`);

    console.log('📝 Creating README first to initialize repository...');
    const readmeContent = Buffer.from(`# Timber Pricing Calculator

Professional timber pricing calculator managing 37 timber items with supplier tracking, historical pricing, and comprehensive reporting.

## Features

- 37 timber sizes with Excel row sequencing
- 14 suppliers with market calculation controls
- System Pricing management with historical data
- Reports page with period selection and % Difference column
- Export functionality (Excel/CSV/PDF)
- Supplier filter with Apply button UX

## Tech Stack

- React 18 + TypeScript
- Express.js backend
- PostgreSQL database
- Drizzle ORM
- shadcn/ui components
- TanStack Query

Built with Replit.
`).toString('base64');

    const readmeBlob = await octokit.git.createBlob({
      owner,
      repo,
      content: readmeContent,
      encoding: 'base64',
    });

    const readmeTree = await octokit.git.createTree({
      owner,
      repo,
      tree: [{
        path: 'README.md',
        mode: '100644' as const,
        type: 'blob' as const,
        sha: readmeBlob.data.sha,
      }],
    });

    const readmeCommit = await octokit.git.createCommit({
      owner,
      repo,
      message: 'Initial commit',
      tree: readmeTree.data.sha,
      parents: [],
    });

    await octokit.git.createRef({
      owner,
      repo,
      ref: 'refs/heads/main',
      sha: readmeCommit.data.sha,
    });
    console.log('✓ Repository initialized\n');

    console.log('📤 Creating blobs for all files...');
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
    console.log(`✓ Created ${blobs.length} blobs\n`);

    console.log('🌳 Creating tree...');
    const tree = await octokit.git.createTree({
      owner,
      repo,
      tree: blobs,
    });
    console.log('✓ Tree created\n');

    console.log('💾 Creating final commit with all files...');
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
      parents: [readmeCommit.data.sha],
    });
    console.log('✓ Commit created\n');

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
