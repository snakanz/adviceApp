import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X, Calendar, User, Plus, Trash2 } from 'lucide-react';

const PipelineEntryForm = ({ client, onClose, onSubmit, isSubmitting }) => {
  // Helper function to create empty business type entry
  const createEmptyBusinessType = () => ({
    business_type: '',
    business_amount: '',
    iaf_expected: '',
    notes: ''
  });

  const [formData, setFormData] = useState({
    likely_close_month: '',
    pipeline_notes: '',
    // Array of business types - start with one empty entry
    business_types: [createEmptyBusinessType()],
    // Optional meeting fields
    create_meeting: false,
    meeting_title: '',
    meeting_date: '',
    meeting_time: '',
    meeting_type: 'video',
    meeting_location: ''
  });

  const [errors, setErrors] = useState({});

  const businessTypes = [
    'Investment',
    'Mortgage',
    'Protection',
    'Other'
  ];

  const meetingTypes = [
    { value: 'video', label: 'Video Call' },
    { value: 'phone', label: 'Phone Call' },
    { value: 'in-person', label: 'In Person' },
    { value: 'other', label: 'Other' }
  ];

  const validateForm = () => {
    const newErrors = {};

    // Validate business types - at least one must be filled
    const hasValidBusinessType = formData.business_types.some((bt) => bt.business_type);
    if (!hasValidBusinessType) {
      newErrors.business_types = 'At least one business type is required';
    }

    // Validate each business type entry
    formData.business_types.forEach((bt, index) => {
      if (!bt.business_type) return;

      const { business_type, iaf_expected, business_amount } = bt;

      // For Investment entries, an expected fee is required
      if (business_type === 'Investment') {
        if (
          iaf_expected === undefined ||
          iaf_expected === null ||
          `${iaf_expected}`.trim() === ''
        ) {
          newErrors[`business_type_${index}_iaf`] = 'Expected fee is required for Investment business.';
        }
      }

      // If a fee is provided (for any type) it must be a valid number
      if (
        iaf_expected !== undefined &&
        iaf_expected !== null &&
        `${iaf_expected}`.trim() !== '' &&
        isNaN(parseFloat(iaf_expected))
      ) {
        newErrors[`business_type_${index}_iaf`] = 'Expected fee must be a valid number';
      }

      // Amount is always optional but must be numeric when provided
      if (
        business_amount !== undefined &&
        business_amount !== null &&
        `${business_amount}`.trim() !== '' &&
        isNaN(parseFloat(business_amount))
      ) {
        newErrors[`business_type_${index}_amount`] = 'Amount must be a valid number';
      }
    });

    // Meeting validation if creating meeting
    if (formData.create_meeting) {
      if (!formData.meeting_title) newErrors.meeting_title = 'Meeting title is required';
      if (!formData.meeting_date) newErrors.meeting_date = 'Meeting date is required';
      if (!formData.meeting_time) newErrors.meeting_time = 'Meeting time is required';

      // Validate meeting is in the future
      if (formData.meeting_date && formData.meeting_time) {
        const meetingDateTime = new Date(`${formData.meeting_date}T${formData.meeting_time}`);
        if (meetingDateTime <= new Date()) {
          newErrors.meeting_date = 'Meeting must be scheduled in the future';
        }
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (validateForm()) {
      onSubmit(formData);
    }
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleBusinessTypeChange = (index, field, value) => {
    const newBusinessTypes = [...formData.business_types];
    newBusinessTypes[index] = { ...newBusinessTypes[index], [field]: value };
    setFormData(prev => ({ ...prev, business_types: newBusinessTypes }));

    // Clear related errors
    const errorKey = `business_type_${index}_${field}`;
    if (errors[errorKey]) {
      setErrors(prev => ({ ...prev, [errorKey]: '' }));
    }
    if (errors.business_types) {
      setErrors(prev => ({ ...prev, business_types: '' }));
    }
  };

  const addBusinessType = () => {
    setFormData(prev => ({
      ...prev,
      business_types: [...prev.business_types, createEmptyBusinessType()]
    }));
  };

  const removeBusinessType = (index) => {
    if (formData.business_types.length > 1) {
      const newBusinessTypes = formData.business_types.filter((_, i) => i !== index);
      setFormData(prev => ({ ...prev, business_types: newBusinessTypes }));
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-border rounded-lg shadow-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <div>
            <h2 className="text-xl font-semibold text-foreground">Create Pipeline Entry</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Add pipeline information for {client.name || client.email}
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Pipeline Information Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-foreground flex items-center gap-2">
              <User className="w-5 h-5 text-primary" />
              Pipeline Information
            </h3>

            {/* Business Types - Repeatable */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <label className="block text-sm font-medium">
                  Business Types <span className="text-red-500">*</span>
                </label>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addBusinessType}
                  className="flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Business Type
                </Button>
              </div>

              {errors.business_types && (
                <p className="text-red-500 text-xs">{errors.business_types}</p>
              )}

              {formData.business_types.map((businessType, index) => (
                <div key={index} className="border border-border rounded-lg p-4 space-y-4 bg-muted/20">
                  <div className="flex items-center justify-between">
                    <h4 className="text-sm font-medium text-foreground">
                      Business Type {index + 1}
                    </h4>
                    {formData.business_types.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeBusinessType(index)}
                        className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    )}
                  </div>

                  {/* Business Type Dropdown */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Type</label>
                    <select
                      value={businessType.business_type}
                      onChange={(e) => handleBusinessTypeChange(index, 'business_type', e.target.value)}
                      className="w-full p-3 border border-border rounded-md bg-background text-foreground"
                    >
                      <option value="">Select business type</option>
                      {businessTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  {/* Amount (optional) */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Amount (£) (optional)</label>
                    <Input
                      type="number"
                      value={businessType.business_amount}
                      onChange={(e) => handleBusinessTypeChange(index, 'business_amount', e.target.value)}
                      placeholder="Enter amount (if applicable)"
                      min="0"
                      step="0.01"
                      className={errors[`business_type_${index}_amount`] ? "border-red-500" : ""}
                    />
                    {errors[`business_type_${index}_amount`] && (
                      <p className="text-red-500 text-xs mt-1">{errors[`business_type_${index}_amount`]}</p>
                    )}
                  </div>

                  {/* Expected Fee (required) */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Expected Fee (£)</label>
                    <Input
                      type="number"
                      value={businessType.iaf_expected}
                      onChange={(e) => handleBusinessTypeChange(index, 'iaf_expected', e.target.value)}
                      placeholder="Enter expected fee in pounds"
                      min="0"
                      step="0.01"
                      className={errors[`business_type_${index}_iaf`] ? "border-red-500" : ""}
                    />
                    {errors[`business_type_${index}_iaf`] && (
                      <p className="text-red-500 text-xs mt-1">{errors[`business_type_${index}_iaf`]}</p>
                    )}
                  </div>

                  {/* Notes */}
                  <div>
                    <label className="block text-sm font-medium mb-2">Notes</label>
                    <textarea
                      value={businessType.notes}
                      onChange={(e) => handleBusinessTypeChange(index, 'notes', e.target.value)}
                      placeholder="Add any notes about this business type..."
                      rows={2}
                      className="w-full p-3 border border-border rounded-md bg-background text-foreground resize-none"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* Expected Close Month */}
            <div>
              <label className="block text-sm font-medium mb-2">Expected Close Month</label>
              <Input
                type="month"
                value={formData.likely_close_month}
                onChange={(e) => handleInputChange('likely_close_month', e.target.value)}
                className="w-full md:w-auto"
              />
            </div>

            {/* Pipeline Notes */}
            <div>
              <label className="block text-sm font-medium mb-2">Pipeline Notes</label>
              <textarea
                value={formData.pipeline_notes}
                onChange={(e) => handleInputChange('pipeline_notes', e.target.value)}
                placeholder="Add any relevant notes about this pipeline opportunity..."
                rows={3}
                className="w-full p-3 border border-border rounded-md bg-background text-foreground resize-none"
              />
            </div>
          </div>

          {/* Optional Meeting Section */}
          <div className="space-y-4 border-t border-border pt-6">
            <div className="flex items-center gap-3">
              <input
                type="checkbox"
                id="create_meeting"
                checked={formData.create_meeting}
                onChange={(e) => handleInputChange('create_meeting', e.target.checked)}
                className="w-4 h-4 text-primary border-border rounded focus:ring-primary"
              />
              <label htmlFor="create_meeting" className="text-lg font-medium text-foreground flex items-center gap-2">
                <Calendar className="w-5 h-5 text-primary" />
                Schedule a Meeting (Optional)
              </label>
            </div>

            {formData.create_meeting && (
              <div className="space-y-4 ml-7 pl-4 border-l-2 border-primary/20">
                {/* Meeting Title */}
                <div>
                  <label className="block text-sm font-medium mb-2">
                    Meeting Title <span className="text-red-500">*</span>
                  </label>
                  <Input
                    type="text"
                    value={formData.meeting_title}
                    onChange={(e) => handleInputChange('meeting_title', e.target.value)}
                    placeholder="e.g., Initial consultation with John Smith"
                    className={errors.meeting_title ? "border-red-500" : ""}
                  />
                  {errors.meeting_title && (
                    <p className="text-red-500 text-xs mt-1">{errors.meeting_title}</p>
                  )}
                </div>

                {/* Date and Time */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Date <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="date"
                      value={formData.meeting_date}
                      onChange={(e) => handleInputChange('meeting_date', e.target.value)}
                      min={new Date().toISOString().split('T')[0]}
                      className={errors.meeting_date ? "border-red-500" : ""}
                    />
                    {errors.meeting_date && (
                      <p className="text-red-500 text-xs mt-1">{errors.meeting_date}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">
                      Time <span className="text-red-500">*</span>
                    </label>
                    <Input
                      type="time"
                      value={formData.meeting_time}
                      onChange={(e) => handleInputChange('meeting_time', e.target.value)}
                      className={errors.meeting_time ? "border-red-500" : ""}
                    />
                    {errors.meeting_time && (
                      <p className="text-red-500 text-xs mt-1">{errors.meeting_time}</p>
                    )}
                  </div>
                </div>

                {/* Meeting Type and Location */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium mb-2">Meeting Type</label>
                    <select
                      value={formData.meeting_type}
                      onChange={(e) => handleInputChange('meeting_type', e.target.value)}
                      className="w-full p-3 border border-border rounded-md bg-background text-foreground"
                    >
                      {meetingTypes.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">Location/Details</label>
                    <Input
                      type="text"
                      value={formData.meeting_location}
                      onChange={(e) => handleInputChange('meeting_location', e.target.value)}
                      placeholder="Meeting link, address, or phone number"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-6 border-t border-border">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="min-w-[120px]"
            >
              {isSubmitting ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Creating...
                </div>
              ) : (
                'Create Pipeline Entry'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PipelineEntryForm;
