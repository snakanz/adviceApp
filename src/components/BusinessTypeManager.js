import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Textarea } from './ui/textarea';
import { Plus, Trash2, AlertCircle, XCircle, CheckCircle } from 'lucide-react';
import { api } from '../services/api';


const BUSINESS_TYPES = [
  'Pension',
  'ISA',
  'Bond',
  'Investment',
  'Insurance',
  'Mortgage'
];

const CONTRIBUTION_METHODS = [
  'Transfer',
  'Regular Monthly Contribution',
  'Lump Sum'
];

export default function BusinessTypeManager({
  clientId,
  initialBusinessTypes = [],
  onSave,
  onCancel,
  saving = false
}) {
  const [businessTypes, setBusinessTypes] = useState([]);
  const [error, setError] = useState('');
  const [markingNotProceeding, setMarkingNotProceeding] = useState(null); // ID of business type being marked
  const [notProceedingReason, setNotProceedingReason] = useState('');
  const [showNotProceedingDialog, setShowNotProceedingDialog] = useState(false);
  const [selectedBusinessTypeId, setSelectedBusinessTypeId] = useState(null);

  useEffect(() => {
    if (initialBusinessTypes.length > 0) {
      setBusinessTypes(initialBusinessTypes);
    } else {
      // Start with one empty business type
      setBusinessTypes([createEmptyBusinessType()]);
    }
  }, [initialBusinessTypes]);

  function createEmptyBusinessType() {
    return {
      id: null, // null for new entries
      business_type: '',
      business_amount: '',
      contribution_method: '',
      regular_contribution_amount: '',
      iaf_expected: '',
      expected_close_date: '',
      notes: ''
    };
  }

  const addBusinessType = () => {
    setBusinessTypes([...businessTypes, createEmptyBusinessType()]);
  };

  const removeBusinessType = (index) => {
    if (businessTypes.length > 1) {
      setBusinessTypes(businessTypes.filter((_, i) => i !== index));
    }
  };

  const updateBusinessType = (index, field, value) => {
    const updated = businessTypes.map((bt, i) => 
      i === index ? { ...bt, [field]: value } : bt
    );
    setBusinessTypes(updated);
  };

  const handleMarkAsNotProceeding = (businessTypeId) => {
    setSelectedBusinessTypeId(businessTypeId);
    setNotProceedingReason('');
    setShowNotProceedingDialog(true);
  };

  const handleConfirmNotProceeding = async () => {
    if (!selectedBusinessTypeId) return;

    setMarkingNotProceeding(selectedBusinessTypeId);
    try {
      await api.request(`/clients/business-types/${selectedBusinessTypeId}/not-proceeding`, {
        method: 'PATCH',
        body: JSON.stringify({
          not_proceeding: true,
          not_proceeding_reason: notProceedingReason
        })
      });

      // Remove the business type from the list (it will be filtered out on refresh)
      setBusinessTypes(businessTypes.filter(bt => bt.id !== selectedBusinessTypeId));
      setShowNotProceedingDialog(false);
      setSelectedBusinessTypeId(null);
      setNotProceedingReason('');
    } catch (error) {
      console.error('Error marking business type as not proceeding:', error);
      setError('Failed to mark business type as not proceeding. Please try again.');
    } finally {
      setMarkingNotProceeding(null);
    }
  };

  const handleSave = () => {
    setError('');

    // Validate that at least one business type is properly filled
    const validBusinessTypes = businessTypes.filter(bt =>
      bt.business_type && bt.business_type.trim() !== ''
    );

    if (validBusinessTypes.length === 0) {
      setError('Please select at least one business type.');
      return;
    }

    // Validate contribution methods for regular contributions
    for (const bt of validBusinessTypes) {
      if (bt.contribution_method === 'Regular Monthly Contribution' &&
          (!bt.regular_contribution_amount || bt.regular_contribution_amount.trim() === '')) {
        setError('Please specify the regular contribution amount for all Regular Monthly Contribution entries.');
        return;
      }
    }

    onSave(validBusinessTypes);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Business Types</h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={addBusinessType}
          className="flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Business Type
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="space-y-4">
        {businessTypes.map((businessType, index) => (
          <Card key={index} className="relative">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-base">
                  Business Type {index + 1}
                </CardTitle>
                <div className="flex items-center gap-2">
                  {/* Mark as Not Proceeding button - only show for existing business types */}
                  {businessType.id && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleMarkAsNotProceeding(businessType.id)}
                      className="text-orange-600 hover:text-orange-700 hover:bg-orange-50 border-orange-300"
                      title="Mark this business opportunity as not proceeding"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Not Proceeding
                    </Button>
                  )}
                  {businessTypes.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBusinessType(index)}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Business Type Selection */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`business_type_${index}`}>Business Type *</Label>
                  <Select
                    value={businessType.business_type}
                    onValueChange={(value) => updateBusinessType(index, 'business_type', value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select business type" />
                    </SelectTrigger>
                    <SelectContent>
                      {BUSINESS_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor={`business_amount_${index}`}>Business Amount (£)</Label>
                  <Input
                    id={`business_amount_${index}`}
                    type="number"
                    value={businessType.business_amount}
                    onChange={(e) => updateBusinessType(index, 'business_amount', e.target.value)}
                    placeholder="Enter business amount"
                  />
                </div>
              </div>

              {/* Contribution Method */}
              <div>
                <Label htmlFor={`contribution_method_${index}`}>Contribution Method</Label>
                <Select
                  value={businessType.contribution_method}
                  onValueChange={(value) => updateBusinessType(index, 'contribution_method', value)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select contribution method" />
                  </SelectTrigger>
                  <SelectContent>
                    {CONTRIBUTION_METHODS.map((method) => (
                      <SelectItem key={method} value={method}>
                        {method}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Regular Contribution Amount - only show if Regular Monthly is selected */}
              {businessType.contribution_method === 'Regular Monthly Contribution' && (
                <div>
                  <Label htmlFor={`regular_contribution_amount_${index}`}>
                    Regular Contribution Amount *
                  </Label>
                  <Input
                    id={`regular_contribution_amount_${index}`}
                    value={businessType.regular_contribution_amount}
                    onChange={(e) => updateBusinessType(index, 'regular_contribution_amount', e.target.value)}
                    placeholder="e.g., £3,000 per month"
                  />
                </div>
              )}

              {/* IAF Expected and Expected Close Date */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor={`iaf_expected_${index}`}>IAF Expected (£)</Label>
                  <Input
                    id={`iaf_expected_${index}`}
                    type="number"
                    value={businessType.iaf_expected}
                    onChange={(e) => updateBusinessType(index, 'iaf_expected', e.target.value)}
                    placeholder="Enter IAF expected in pounds"
                  />
                </div>

                <div>
                  <Label htmlFor={`expected_close_date_${index}`}>Expected Close Date</Label>
                  <Input
                    id={`expected_close_date_${index}`}
                    type="date"
                    value={businessType.expected_close_date || ''}
                    onChange={(e) => updateBusinessType(index, 'expected_close_date', e.target.value)}
                    placeholder="Select expected close date"
                  />
                </div>
              </div>

              {/* Notes */}
              <div>
                <Label htmlFor={`notes_${index}`}>Notes</Label>
                <Input
                  id={`notes_${index}`}
                  value={businessType.notes}
                  onChange={(e) => updateBusinessType(index, 'notes', e.target.value)}
                  placeholder="Additional notes for this business type"
                />
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="flex gap-2 justify-end pt-4 border-t">
        <Button variant="outline" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving...' : 'Save Business Types'}
        </Button>
      </div>

      {/* Not Proceeding Confirmation Dialog */}
      {showNotProceedingDialog && (
        <div className="fixed inset-0 bg-black/50 z-[200] flex items-center justify-center p-4">
          <div className="bg-background rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-3 mb-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-foreground mb-1">
                  Mark as Not Proceeding
                </h3>
                <p className="text-sm text-muted-foreground">
                  This business opportunity will be removed from the pipeline view. You can optionally provide a reason.
                </p>
              </div>
            </div>

            <div className="mb-4">
              <Label htmlFor="not_proceeding_reason">Reason (Optional)</Label>
              <Textarea
                id="not_proceeding_reason"
                value={notProceedingReason}
                onChange={(e) => setNotProceedingReason(e.target.value)}
                placeholder="e.g., Client decided not to proceed, went with another advisor, deal fell through..."
                rows={3}
                className="mt-1"
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                variant="outline"
                onClick={() => {
                  setShowNotProceedingDialog(false);
                  setSelectedBusinessTypeId(null);
                  setNotProceedingReason('');
                }}
                disabled={markingNotProceeding}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmNotProceeding}
                disabled={markingNotProceeding}
                className="bg-orange-600 hover:bg-orange-700 text-white"
              >
                {markingNotProceeding ? 'Marking...' : 'Mark as Not Proceeding'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
