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

async function getGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

async function main() {
  console.log('🚀 Starting GitHub repository creation and code push...\n');

  try {
    // Get GitHub client
    const octokit = await getGitHubClient();

    // Get authenticated user info
    const { data: user } = await octokit.users.getAuthenticated();
    console.log(`✓ Authenticated as: ${user.login}`);

    // Repository details
    const repoName = 'timber-pricing-calculator';
    const repoDescription = 'Professional timber pricing calculator managing 37 timber items with supplier tracking, historical pricing, and comprehensive reporting (Excel/CSV/PDF exports)';

    // Create new repository
    console.log(`\n📦 Creating repository: ${repoName}...`);
    const { data: repo } = await octokit.repos.createForAuthenticatedUser({
      name: repoName,
      description: repoDescription,
      private: false,
      auto_init: false,
    });
    console.log(`✓ Repository created: ${repo.html_url}`);

    // Initialize git if not already done
    console.log('\n🔧 Initializing git...');
    try {
      execSync('git rev-parse --git-dir', { stdio: 'ignore' });
      console.log('✓ Git already initialized');
    } catch {
      execSync('git init', { stdio: 'inherit' });
      console.log('✓ Git initialized');
    }

    // Configure git user if not set
    try {
      execSync('git config user.name', { stdio: 'ignore' });
    } catch {
      execSync(`git config user.name "${user.login}"`, { stdio: 'inherit' });
    }

    try {
      execSync('git config user.email', { stdio: 'ignore' });
    } catch {
      execSync(`git config user.email "${user.email || user.login + '@users.noreply.github.com'}"`, { stdio: 'inherit' });
    }

    // Add all files
    console.log('\n📝 Adding files...');
    execSync('git add .', { stdio: 'inherit' });
    console.log('✓ Files added');

    // Commit
    console.log('\n💾 Committing changes...');
    const commitMessage = 'Initial commit: Timber pricing calculator with comprehensive features\n\n' +
      '- 37 timber sizes with Excel row sequencing\n' +
      '- 14 suppliers with market calculation controls\n' +
      '- System Pricing management with historical data\n' +
      '- Reports page with period selection\n' +
      '- Export functionality (Excel/CSV/PDF)\n' +
      '- Supplier filter with Apply button UX\n' +
      '- % Difference vs Market High calculation';
    
    try {
      execSync(`git commit -m "${commitMessage}"`, { stdio: 'inherit' });
      console.log('✓ Changes committed');
    } catch (error) {
      console.log('Note: No changes to commit (might already be committed)');
    }

    // Add remote
    console.log('\n🔗 Adding remote...');
    try {
      execSync('git remote remove origin', { stdio: 'ignore' });
    } catch {
      // Remote doesn't exist, that's fine
    }
    execSync(`git remote add origin ${repo.clone_url}`, { stdio: 'inherit' });
    console.log('✓ Remote added');

    // Get the default branch name
    let branchName = 'main';
    try {
      branchName = execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf-8' }).trim();
    } catch {
      // Use 'main' as default
    }

    // Rename branch to main if needed
    if (branchName !== 'main') {
      console.log('\n🔄 Renaming branch to main...');
      execSync('git branch -M main', { stdio: 'inherit' });
      console.log('✓ Branch renamed to main');
    }

    // Push to GitHub
    console.log('\n⬆️  Pushing to GitHub...');
    execSync('git push -u origin main', { stdio: 'inherit' });

    console.log('\n✅ Success! Your code has been pushed to GitHub!');
    console.log(`\n🌐 Repository URL: ${repo.html_url}`);
    console.log(`📦 Clone URL: ${repo.clone_url}`);

  } catch (error: any) {
    console.error('\n❌ Error:', error.message);
    if (error.response?.data) {
      console.error('Details:', error.response.data);
    }
    process.exit(1);
  }
}

main();
