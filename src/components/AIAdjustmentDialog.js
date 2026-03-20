import React, { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const AIAdjustmentDialog = ({
  open,
  onClose,
  title,
  originalContent,
  onAdjust,
  loading = false,
}) => {
  const [adjustment, setAdjustment] = useState('');
  const maxChars = 150;

  const handleSubmit = () => {
    onAdjust(adjustment);
    setAdjustment('');
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <Card className="w-full max-w-md bg-gray-800 border-gray-700 shadow-xl">
        <CardHeader className="pb-4">
          <CardTitle className="flex items-center gap-2 text-gray-100">
            <Sparkles className="h-5 w-5 text-green-400" />
            {title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p className="text-gray-400 text-sm">
            Enter your adjustment request (max {maxChars} characters):
          </p>
          <div className="space-y-2">
            <textarea
              className="w-full min-h-[80px] px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-green-400 focus:border-transparent resize-none"
              value={adjustment}
              onChange={(e) => {
                if (e.target.value.length <= maxChars) {
                  setAdjustment(e.target.value);
                }
              }}
              placeholder="What would you like to adjust?"
              disabled={loading}
            />
            <p className="text-xs text-gray-500 text-right">
              {adjustment.length}/{maxChars} characters
            </p>
          </div>
        </CardContent>
        <div className="flex justify-end gap-3 p-6 pt-0">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={loading}
            className="border-gray-600 text-gray-300 hover:bg-gray-700 hover:text-gray-100"
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!adjustment.trim() || loading}
            className="bg-green-500 hover:bg-green-600 text-white"
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Adjusting...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Adjust with AI
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
};

export default AIAdjustmentDialog; 