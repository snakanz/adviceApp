import React from 'react';
import { Alert, AlertDescription } from './ui/alert';
import { Info, Zap, RefreshCw, ExternalLink } from 'lucide-react';

/**
 * CalendlyPlanInfo - Information banner about Calendly plan requirements
 * 
 * Props:
 * - variant: 'onboarding' | 'settings' | 'compact'
 * - hasWebhook: boolean - whether webhook is active (auto-sync enabled)
 * - showSyncButton: boolean - whether to show manual sync option
 */
const CalendlyPlanInfo = ({ 
  variant = 'settings', 
  hasWebhook = false,
  showSyncButton = false 
}) => {
  
  if (variant === 'compact') {
    return (
      <div className="flex items-start gap-2 p-3 bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg">
        <Info className="w-4 h-4 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="flex-1 text-xs text-blue-900 dark:text-blue-100">
          {hasWebhook ? (
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-green-600" />
              <span className="font-medium">Live sync active</span>
              <span className="text-blue-700 dark:text-blue-300">- Meetings sync instantly</span>
            </div>
          ) : (
            <div className="flex items-center gap-1">
              <RefreshCw className="w-3 h-3" />
              <span className="font-medium">Polling sync active</span>
              <span className="text-blue-700 dark:text-blue-300">- Syncs every 15 min</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (variant === 'onboarding') {
    return (
      <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
        <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
        <AlertDescription className="text-sm text-blue-900 dark:text-blue-100">
          <div className="space-y-3">
            <div>
              <p className="font-semibold mb-2">📅 Calendly Integration Options:</p>
              
              <div className="space-y-2 ml-4">
                <div className="flex items-start gap-2">
                  <Zap className="w-4 h-4 text-green-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      Automatic Real-Time Sync
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Requires Calendly <strong>Standard, Professional, Teams, or Enterprise</strong> plan
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      ✓ Meetings appear instantly when booked
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-2">
                  <RefreshCw className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-blue-900 dark:text-blue-100">
                      Manual Sync
                    </p>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Works with <strong>Free Calendly plan</strong>
                    </p>
                    <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                      ✓ Click "Sync Now" to fetch latest meetings (takes 5-10 seconds)
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                💡 <strong>Tip:</strong> You can connect now and upgrade your Calendly plan later to enable automatic sync.
              </p>
            </div>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Default 'settings' variant
  return (
    <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
      <Info className="h-4 w-4 text-blue-600 dark:text-blue-400" />
      <AlertDescription className="text-sm">
        <div className="space-y-2">
          {hasWebhook ? (
            <>
              <div className="flex items-center gap-2">
                <Zap className="w-4 h-4 text-green-600" />
                <p className="font-semibold text-green-900 dark:text-green-100">
                  ✅ Automatic Real-Time Sync Enabled
                </p>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300">
                Your Calendly meetings sync automatically when booked or cancelled. 
                No manual action needed!
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-600" />
                <p className="font-semibold text-blue-900 dark:text-blue-100">
                  Polling Sync Active
                </p>
              </div>
              <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                Your Calendly account is on the <strong>Free plan</strong>. Meetings sync automatically every 15 minutes.
              </p>

              {showSyncButton && (
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-2">
                  👇 Need immediate sync? Click <strong>"Sync Now"</strong> below (takes 5-10 seconds).
                </p>
              )}

              <div className="pt-2 border-t border-blue-200 dark:border-blue-800">
                <p className="text-xs text-blue-700 dark:text-blue-300 mb-1">
                  <strong>Want instant sync?</strong> Upgrade to Calendly Standard or higher for real-time webhooks:
                </p>
                <a
                  href="https://calendly.com/pricing"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  View Calendly Pricing
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </>
          )}
        </div>
      </AlertDescription>
    </Alert>
  );
};

export default CalendlyPlanInfo;

