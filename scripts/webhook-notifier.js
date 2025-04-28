const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

// Get environment variables
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
const TEAMS_WEBHOOK_URL = process.env.TEAMS_WEBHOOK_URL;
const BITBUCKET_COMMIT = process.env.BITBUCKET_COMMIT || 'local';
const VERCEL_DEPLOYMENT_URL = process.env.VERCEL_DEPLOYMENT_URL || 'https://gridlabs.vercel.app';
const PROJECT_NAME = process.env.PROJECT_NAME || 'GridLabs';

// Path to the diff summary file
const diffSummaryPath = path.join(process.cwd(), 'gridshots', `diff_summary_${BITBUCKET_COMMIT}.json`);

/**
 * Format the Slack message with build info and component changes
 */
function formatSlackMessage(diffSummary) {
  // Get components with changes
  const changedComponents = diffSummary.components.filter(c => c.hasDiff);
  
  // Format the message blocks
  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `🚀 ${PROJECT_NAME} Build Update`,
        emoji: true
      }
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*<${VERCEL_DEPLOYMENT_URL}/__grid?sha=${BITBUCKET_COMMIT}|View this build in GridLabs>*`
      }
    }
  ];
  
  // Add component changes section if there are any
  if (changedComponents.length > 0) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*🔄 Visual Changes (${changedComponents.length} components)*`
      }
    });
    
    // Add each component as a separate section
    changedComponents.forEach(component => {
      blocks.push({
        type: 'section',
        text: {
          type: 'mrkdwn',
          text: `• *\`${component.name}\`*: ${component.summary} (${component.diffPercentage.toFixed(2)}% different)`
        }
      });
    });
  } else {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: '*✅ No visual changes detected*'
      }
    });
  }
  
  return {
    blocks
  };
}

/**
 * Format the Teams message with build info and component changes
 */
function formatTeamsMessage(diffSummary) {
  // Get components with changes
  const changedComponents = diffSummary.components.filter(c => c.hasDiff);
  
  // Format the message
  const message = {
    '@type': 'MessageCard',
    '@context': 'http://schema.org/extensions',
    themeColor: '0076D7',
    summary: `${PROJECT_NAME} Build Update`,
    sections: [
      {
        activityTitle: `🚀 ${PROJECT_NAME} Build Update`,
        activitySubtitle: `Commit: ${BITBUCKET_COMMIT.substring(0, 7)}`,
        facts: [
          {
            name: 'Build URL',
            value: `[View in GridLabs](${VERCEL_DEPLOYMENT_URL}/__grid?sha=${BITBUCKET_COMMIT})`
          },
          {
            name: 'Changes',
            value: changedComponents.length > 0 ? `${changedComponents.length} components updated` : 'No visual changes'
          }
        ]
      }
    ]
  };
  
  // Add component changes section if there are any
  if (changedComponents.length > 0) {
    const changeSection = {
      title: '🔄 Visual Changes',
      text: ''
    };
    
    changedComponents.forEach(component => {
      changeSection.text += `- **${component.name}**: ${component.summary} (${component.diffPercentage.toFixed(2)}%)\n\n`;
    });
    
    message.sections.push(changeSection);
  }
  
  return message;
}

/**
 * Send a notification to Slack
 */
async function sendSlackNotification(diffSummary) {
  if (!SLACK_WEBHOOK_URL) {
    console.log('SLACK_WEBHOOK_URL not set. Skipping Slack notification.');
    return false;
  }
  
  console.log('Sending notification to Slack webhook...');
  
  try {
    const message = formatSlackMessage(diffSummary);
    
    const response = await fetch(SLACK_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send Slack notification: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    console.log('✅ Successfully sent notification to Slack');
    console.log(`Sent to webhook: ${SLACK_WEBHOOK_URL.substring(0, 30)}...`);
    return true;
  } catch (error) {
    console.error('Error sending Slack notification:', error);
    return false;
  }
}

/**
 * Send a notification to Microsoft Teams
 */
async function sendTeamsNotification(diffSummary) {
  if (!TEAMS_WEBHOOK_URL) {
    console.log('TEAMS_WEBHOOK_URL not set. Skipping Teams notification.');
    return false;
  }
  
  try {
    const message = formatTeamsMessage(diffSummary);
    
    const response = await fetch(TEAMS_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(message)
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to send Teams notification: ${response.status} ${response.statusText}\n${errorText}`);
    }
    
    console.log('Successfully sent notification to Microsoft Teams');
    return true;
  } catch (error) {
    console.error('Error sending Teams notification:', error);
    return false;
  }
}

/**
 * Main function
 */
async function main() {
  try {
    // Check if diff summary exists
    if (!fs.existsSync(diffSummaryPath)) {
      console.error(`Diff summary file not found at ${diffSummaryPath}`);
      return;
    }
    
    // Read the diff summary
    const diffSummary = JSON.parse(fs.readFileSync(diffSummaryPath, 'utf8'));
    
    // Send notifications
    const slackResult = await sendSlackNotification(diffSummary);
    const teamsResult = await sendTeamsNotification(diffSummary);
    
    if (!slackResult && !teamsResult) {
      console.log('No notifications were sent. Check webhook URLs in environment variables.');
    }
  } catch (error) {
    console.error('Error in webhook notifier:', error);
    process.exit(1);
  }
}

// Run the main function
main().catch(error => {
  console.error('Unhandled error:', error);
  process.exit(1);
});
