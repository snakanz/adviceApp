const express = require('express');
const router = express.Router();

// Serve the webhook deletion tool
router.get('/delete-calendly-webhook', (req, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Delete Calendly Webhook</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, sans-serif;
            max-width: 800px;
            margin: 50px auto;
            padding: 20px;
            background: #f5f5f5;
        }
        .container {
            background: white;
            padding: 30px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #333;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
        }
        button {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 12px 24px;
            font-size: 16px;
            border-radius: 4px;
            cursor: pointer;
            margin-right: 10px;
            margin-bottom: 10px;
        }
        button:hover {
            background: #45a049;
        }
        button.delete {
            background: #f44336;
        }
        button.delete:hover {
            background: #da190b;
        }
        button:disabled {
            background: #ccc;
            cursor: not-allowed;
        }
        .output {
            margin-top: 20px;
            padding: 15px;
            background: #f9f9f9;
            border-left: 4px solid #4CAF50;
            border-radius: 4px;
            white-space: pre-wrap;
            font-family: monospace;
            font-size: 14px;
            display: none;
        }
        .output.error {
            border-left-color: #f44336;
            background: #ffebee;
        }
        .output.success {
            border-left-color: #4CAF50;
            background: #e8f5e9;
        }
        .output.info {
            border-left-color: #2196F3;
            background: #e3f2fd;
        }
        .loading {
            display: none;
            margin-top: 20px;
            text-align: center;
        }
        .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #4CAF50;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto;
        }
        @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
        }
        .step {
            margin: 20px 0;
            padding: 15px;
            background: #f0f0f0;
            border-radius: 4px;
        }
        .step h3 {
            margin-top: 0;
            color: #333;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>🗑️ Delete Calendly Webhook</h1>
        <p class="subtitle">This tool will delete the old Calendly webhook that's causing the 409 error</p>

        <div class="step">
            <h3>Step 1: List Existing Webhooks</h3>
            <p>First, let's see what webhooks exist in your Calendly account.</p>
            <button onclick="listWebhooks()">📋 List Webhooks</button>
        </div>

        <div class="step">
            <h3>Step 2: Delete Old Webhook</h3>
            <p>This will delete all webhooks pointing to your app URL.</p>
            <button class="delete" onclick="deleteWebhook()">🗑️ Delete Webhook</button>
        </div>

        <div class="step">
            <h3>Step 3: Reconnect Calendly</h3>
            <p>After deleting the webhook, reconnect Calendly in your app.</p>
            <button onclick="openSettings()">⚙️ Open Settings</button>
        </div>

        <div class="loading">
            <div class="spinner"></div>
            <p>Processing...</p>
        </div>

        <div class="output" id="output"></div>
    </div>

    <script>
        function getAuthToken() {
            // Try different possible token keys
            const possibleKeys = [
                'sb-xjqjzievgepqpgtggcjx-auth-token',
                'supabase.auth.token',
                'sb-auth-token'
            ];
            
            for (const key of possibleKeys) {
                const token = localStorage.getItem(key);
                if (token) {
                    try {
                        const parsed = JSON.parse(token);
                        if (parsed.access_token) {
                            return parsed.access_token;
                        }
                    } catch (e) {
                        // Not JSON, might be the token itself
                        if (token && token.startsWith('eyJ')) {
                            return token;
                        }
                    }
                }
            }
            
            showOutput('❌ Error: Not logged in. Please log in to your app first.', 'error');
            return null;
        }

        function showOutput(message, type = 'info') {
            const output = document.getElementById('output');
            output.textContent = message;
            output.className = 'output ' + type;
            output.style.display = 'block';
        }

        function showLoading(show) {
            document.querySelector('.loading').style.display = show ? 'block' : 'none';
        }

        async function listWebhooks() {
            const token = getAuthToken();
            if (!token) return;

            showLoading(true);
            showOutput('Fetching webhooks...', 'info');

            try {
                const response = await fetch('/api/calendly/webhook/list', {
                    headers: {
                        'Authorization': \`Bearer \${token}\`
                    }
                });

                const data = await response.json();
                showLoading(false);

                if (!response.ok) {
                    showOutput(\`❌ Error: \${data.error || 'Failed to fetch webhooks'}\\n\\n\${JSON.stringify(data, null, 2)}\`, 'error');
                    return;
                }

                if (data.webhooks && data.webhooks.length > 0) {
                    let message = \`✅ Found \${data.webhooks.length} webhook(s):\\n\\n\`;
                    data.webhooks.forEach((wh, i) => {
                        message += \`Webhook \${i + 1}:\\n\`;
                        message += \`  URI: \${wh.uri}\\n\`;
                        message += \`  URL: \${wh.callback_url}\\n\`;
                        message += \`  State: \${wh.state}\\n\`;
                        message += \`  Created: \${wh.created_at}\\n\\n\`;
                    });
                    showOutput(message, 'success');
                } else {
                    showOutput('✅ No webhooks found. You can reconnect Calendly now!', 'success');
                }
            } catch (error) {
                showLoading(false);
                showOutput(\`❌ Error: \${error.message}\`, 'error');
            }
        }

        async function deleteWebhook() {
            const token = getAuthToken();
            if (!token) return;

            if (!confirm('Are you sure you want to delete the Calendly webhook? This will remove all webhooks pointing to your app.')) {
                return;
            }

            showLoading(true);
            showOutput('Deleting webhook...', 'info');

            try {
                const response = await fetch('/api/calendly/webhook/subscription', {
                    method: 'DELETE',
                    headers: {
                        'Authorization': \`Bearer \${token}\`
                    }
                });

                const data = await response.json();
                showLoading(false);

                if (!response.ok) {
                    showOutput(\`❌ Error: \${data.error || 'Failed to delete webhook'}\\n\\n\${JSON.stringify(data, null, 2)}\`, 'error');
                    return;
                }

                let message = \`✅ SUCCESS!\\n\\n\`;
                message += \`Deleted \${data.webhooks_deleted} webhook(s)\\n\\n\`;
                message += \`Next steps:\\n\`;
                message += \`1. Click "Open Settings" below\\n\`;
                message += \`2. Disconnect Calendly\\n\`;
                message += \`3. Reconnect Calendly\\n\`;
                message += \`4. New webhook will be created automatically\\n\`;
                
                showOutput(message, 'success');
            } catch (error) {
                showLoading(false);
                showOutput(\`❌ Error: \${error.message}\`, 'error');
            }
        }

        function openSettings() {
            window.open('/settings/calendar', '_blank');
        }

        // Show ready message
        showOutput('✅ Ready! You are logged in. Click "List Webhooks" to start.', 'info');
    </script>
</body>
</html>`);
});

module.exports = router;

