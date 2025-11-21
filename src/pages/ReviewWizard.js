import React, { useState, useEffect } from 'react';
import { Button } from '../components/ui/button';

// Minimal, self-contained wizard UI for review meetings.
// This is intentionally simple so we can wire the backend first,
// then refine the UX once the flow is proven.

const DEFAULT_FIELDS = [
  {
    key: 'client_name',
    label: 'Client name',
  },
  {
    key: 'meeting_date',
    label: 'Meeting date',
  },
  {
    key: 'retirement_age',
    label: 'Retirement age',
  },
  {
    key: 'cashflow_modelling_notes',
    label: 'Cashflow modelling notes',
  },
];

export default function ReviewWizard({
  meeting,
  transcript,
  isOpen,
  onClose,
  onComplete,
}) {
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState({});
  const [detectedFields, setDetectedFields] = useState(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!isOpen) return;
    // Reset state when opened
    setStepIndex(0);
    setAnswers({});
    setDetectedFields(null);
    setError(null);
    if (!transcript) return;

    // Fire-and-forget detection; parent is responsible for auth + API URL
    const runDetection = async () => {
      try {
        setLoading(true);
        setError(null);
        const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';
        const token = window.localStorage.getItem('supabaseToken');
        const res = await fetch(`${apiBase}/api/calendar/meetings/${meeting.id}/detect-review-fields`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ transcript }),
        });
        if (!res.ok) {
          throw new Error('Failed to detect review fields');
        }
        const data = await res.json();
        if (data && Array.isArray(data.fields) && data.fields.length > 0) {
          setDetectedFields(data.fields);
        } else {
          setDetectedFields(null);
        }
      } catch (e) {
        console.error('Error detecting review fields:', e);
        setError('Unable to pre-fill fields from transcript. You can still proceed manually.');
      } finally {
        setLoading(false);
      }
    };

    runDetection();
  }, [isOpen, meeting?.id, transcript]);

  if (!isOpen) return null;

  const fields = detectedFields && detectedFields.length > 0
    ? detectedFields
    : DEFAULT_FIELDS.map((f) => ({ key: f.key, label: f.label, question_text: f.label }));

  const currentField = fields[stepIndex];

  const handleChange = (value) => {
    setAnswers((prev) => ({ ...prev, [currentField.key]: value }));
  };

  const handleSkip = () => {
    handleNext();
  };

  const handleNext = () => {
    if (stepIndex < fields.length - 1) {
      setStepIndex(stepIndex + 1);
    } else {
      handleFinish();
    }
  };

  const handleBack = () => {
    if (stepIndex > 0) {
      setStepIndex(stepIndex - 1);
    }
  };

  const handleFinish = async () => {
    try {
      setSubmitting(true);
      setError(null);

      const apiBase = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';
      const token = window.localStorage.getItem('supabaseToken');

      const reviewData = {};
      // Apply detected values first, then user answers override
      fields.forEach((field) => {
        if (field.detected_value != null && field.detected_value !== '') {
          reviewData[field.key] = field.detected_value;
        }
      });
      Object.assign(reviewData, answers);

      const res = await fetch(`${apiBase}/api/calendar/meetings/${meeting.id}/generate-review-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ transcript, reviewData }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || 'Failed to generate review email');
      }

      const data = await res.json();
      if (onComplete) {
        onComplete({ emailBody: data.summary, reviewData });
      }
    } catch (e) {
      console.error('Error generating review email:', e);
      setError(e.message || 'Failed to generate review email');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background rounded-xl shadow-2xl max-w-xl w-full border border-border/50">
        <div className="p-5 border-b border-border/50 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-foreground">Review letter check</h2>
            <p className="text-xs text-muted-foreground mt-1">
              We&apos;ll quickly confirm a few key details, then generate a finished review email.
            </p>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} className="h-8 w-8 p-0">
            ×
          </Button>
        </div>

        <div className="p-5 space-y-4">
          {loading && (
            <div className="text-xs text-muted-foreground">
              Reading your transcript to pre-fill details...
            </div>
          )}

          {error && (
            <div className="text-xs text-destructive bg-destructive/10 border border-destructive/30 rounded px-3 py-2">
              {error}
            </div>
          )}

          {currentField && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-foreground">
                {currentField.question_text || currentField.label}
              </div>
              {currentField.detected_value && (
                <div className="text-[11px] text-muted-foreground">
                  Suggested from transcript: <span className="font-medium">{String(currentField.detected_value)}</span>
                </div>
              )}
              <textarea
                rows={3}
                className="w-full text-sm border border-border/60 rounded-md px-2 py-1 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
                placeholder="Type your answer or leave blank to skip"
                value={answers[currentField.key] || ''}
                onChange={(e) => handleChange(e.target.value)}
              />
            </div>
          )}
        </div>

        <div className="p-4 border-t border-border/50 flex items-center justify-between text-xs">
          <div className="text-muted-foreground">
            Step {stepIndex + 1} of {fields.length}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleBack} disabled={stepIndex === 0 || submitting}>
              Back
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              disabled={submitting}
            >
              Skip
            </Button>
            <Button
              size="sm"
              onClick={handleNext}
              disabled={submitting}
            >
              {stepIndex === fields.length - 1 ? (submitting ? 'Generating…' : 'Generate letter') : 'Next'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

