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
    
    // Skip certain directories and files
    if (file === 'node_modules' || file === '.git' || file === 'dist' || 
        file === '.replit' || file === 'replit.nix' || file === '.cache' ||
        file === 'scripts') {
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
  console.log('🚀 Pushing code to GitHub using Contents API...\n');

  try {
    const token = await getAccessToken();
    const octokit = new Octokit({ auth: token });
    
    const owner = 'DaleTiley';
    const repo = 'timber-pricing-calculator';

    // Collect all files
    console.log('📂 Collecting files...');
    const allFiles = getAllFiles('.');
    console.log(`✓ Found ${allFiles.length} files\n`);

    console.log('📤 Uploading files to GitHub...');
    let uploaded = 0;
    const batchSize = 5; // Upload in small batches to avoid rate limiting
    
    for (let i = 0; i < allFiles.length; i += batchSize) {
      const batch = allFiles.slice(i, i + batchSize);
      
      await Promise.all(
        batch.map(async ({ path: filePath, fullPath }) => {
          const content = fs.readFileSync(fullPath, 'utf-8');
          try {
            await octokit.repos.createOrUpdateFileContents({
              owner,
              repo,
              path: filePath.replace(/\\/g, '/'),
              message: `Add ${filePath}`,
              content: Buffer.from(content).toString('base64'),
              branch: 'main',
            });
            uploaded++;
            if (uploaded % 10 === 0 || uploaded === allFiles.length) {
              process.stdout.write(`\r✓ Uploaded ${uploaded}/${allFiles.length} files...`);
            }
          } catch (error: any) {
            console.error(`\n⚠️  Error uploading ${filePath}:`, error.message);
          }
        })
      );
      
      // Small delay between batches
      if (i + batchSize < allFiles.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    console.log('\n\n✅ Success! Your code has been pushed to GitHub!\n');
    console.log(`🌐 Repository: https://github.com/${owner}/${repo}`);
    console.log(`📁 Files uploaded: ${uploaded}/${allFiles.length}`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', JSON.stringify(error.response.data, null, 2));
    }
    process.exit(1);
  }
}

main();
