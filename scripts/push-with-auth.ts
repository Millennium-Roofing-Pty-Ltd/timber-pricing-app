import { Octokit } from '@octokit/rest';
import { execSync } from 'child_process';

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
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
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

async function main() {
  console.log('🔐 Getting GitHub authentication...\n');

  try {
    const token = await getAccessToken();
    const octokit = new Octokit({ auth: token });
    const { data: user } = await octokit.users.getAuthenticated();
    
    console.log(`✓ Authenticated as: ${user.login}\n`);

    const repoUrl = `https://${token}@github.com/DaleTiley/timber-pricing-calculator.git`;

    console.log('🔗 Updating git remote with authenticated URL...');
    try {
      execSync('git remote remove origin', { stdio: 'pipe' });
    } catch {
      // Ignore if remote doesn't exist
    }
    
    execSync(`git remote add origin ${repoUrl}`, { stdio: 'pipe' });
    console.log('✓ Remote updated\n');

    console.log('📝 Adding files...');
    execSync('git add .', { stdio: 'inherit' });
    console.log('✓ Files added\n');

    console.log('💾 Committing changes...');
    const commitMessage = 'Initial commit: Timber pricing calculator\n\n' +
      '- 37 timber sizes with Excel row sequencing\n' +
      '- 14 suppliers with market calculation controls\n' +
      '- System Pricing management\n' +
      '- Reports with period selection & exports (Excel/CSV/PDF)\n' +
      '- Supplier filters and % Difference calculations';
    
    try {
      execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
      console.log('✓ Changes committed\n');
    } catch (error) {
      console.log('ℹ️  No new changes to commit\n');
    }

    console.log('⬆️  Pushing to GitHub...');
    execSync('git push -u origin main', { stdio: 'inherit' });

    console.log('\n✅ Success! Your code has been pushed to GitHub!');
    console.log(`\n🌐 Repository: https://github.com/DaleTiley/timber-pricing-calculator`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    process.exit(1);
  }
}

main();
