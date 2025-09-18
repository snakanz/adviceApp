import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { X, Calendar, User } from 'lucide-react';
import { cn } from '../lib/utils';

const PipelineEntryForm = ({ client, onClose, onSubmit, isSubmitting }) => {
  const [formData, setFormData] = useState({
    pipeline_stage: '',
    iaf_expected: '',
    business_type: '',
    business_amount: '',
    regular_contribution_type: '',
    regular_contribution_amount: '',
    pipeline_notes: '',
    likely_close_month: '',
    // Optional meeting fields
    create_meeting: false,
    meeting_title: '',
    meeting_date: '',
    meeting_time: '',
    meeting_type: 'video',
    meeting_location: ''
  });

  const [errors, setErrors] = useState({});

  const pipelineStages = [
    'Client Signed',
    'Waiting to Sign',
    'Waiting on Paraplanning',
    'Have Not Written Advice',
    'Need to Book Meeting',
    "Can't Contact Client"
  ];

  const businessTypes = [
    'pension',
    'isa',
    'bond',
    'investment',
    'insurance',
    'mortgage'
  ];

  const meetingTypes = [
    { value: 'video', label: 'Video Call' },
    { value: 'phone', label: 'Phone Call' },
    { value: 'in-person', label: 'In Person' },
    { value: 'other', label: 'Other' }
  ];

  const validateForm = () => {
    const newErrors = {};

    // Required pipeline fields
    if (!formData.pipeline_stage) newErrors.pipeline_stage = 'Pipeline stage is required';
    if (!formData.business_type) newErrors.business_type = 'Business type is required';

    // Optional but recommended fields
    if (formData.iaf_expected && isNaN(parseFloat(formData.iaf_expected))) {
      newErrors.iaf_expected = 'IAF Expected must be a valid number';
    }
    if (formData.business_amount && isNaN(parseFloat(formData.business_amount))) {
      newErrors.business_amount = 'Business amount must be a valid number';
    }

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

  const formatBusinessType = (type) => {
    return type.charAt(0).toUpperCase() + type.slice(1);
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

            {/* Pipeline Stage */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Pipeline Stage <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.pipeline_stage}
                onChange={(e) => handleInputChange('pipeline_stage', e.target.value)}
                className={cn(
                  "w-full p-3 border rounded-md bg-background text-foreground",
                  errors.pipeline_stage ? "border-red-500" : "border-border"
                )}
              >
                <option value="">Select pipeline stage</option>
                {pipelineStages.map(stage => (
                  <option key={stage} value={stage}>{stage}</option>
                ))}
              </select>
              {errors.pipeline_stage && (
                <p className="text-red-500 text-xs mt-1">{errors.pipeline_stage}</p>
              )}
            </div>

            {/* Business Type */}
            <div>
              <label className="block text-sm font-medium mb-2">
                Business Type <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.business_type}
                onChange={(e) => handleInputChange('business_type', e.target.value)}
                className={cn(
                  "w-full p-3 border rounded-md bg-background text-foreground",
                  errors.business_type ? "border-red-500" : "border-border"
                )}
              >
                <option value="">Select business type</option>
                {businessTypes.map(type => (
                  <option key={type} value={type}>{formatBusinessType(type)}</option>
                ))}
              </select>
              {errors.business_type && (
                <p className="text-red-500 text-xs mt-1">{errors.business_type}</p>
              )}
            </div>

            {/* Financial Information */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">IAF Expected (£)</label>
                <Input
                  type="number"
                  value={formData.iaf_expected}
                  onChange={(e) => handleInputChange('iaf_expected', e.target.value)}
                  placeholder="Enter expected IAF"
                  min="0"
                  step="0.01"
                  className={errors.iaf_expected ? "border-red-500" : ""}
                />
                {errors.iaf_expected && (
                  <p className="text-red-500 text-xs mt-1">{errors.iaf_expected}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Business Amount (£)</label>
                <Input
                  type="number"
                  value={formData.business_amount}
                  onChange={(e) => handleInputChange('business_amount', e.target.value)}
                  placeholder="Enter business amount"
                  min="0"
                  step="0.01"
                  className={errors.business_amount ? "border-red-500" : ""}
                />
                {errors.business_amount && (
                  <p className="text-red-500 text-xs mt-1">{errors.business_amount}</p>
                )}
              </div>
            </div>

            {/* Regular Contributions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-2">Regular Contribution Type</label>
                <Input
                  type="text"
                  value={formData.regular_contribution_type}
                  onChange={(e) => handleInputChange('regular_contribution_type', e.target.value)}
                  placeholder="e.g., Pension Regular Monthly"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-2">Regular Contribution Amount</label>
                <Input
                  type="text"
                  value={formData.regular_contribution_amount}
                  onChange={(e) => handleInputChange('regular_contribution_amount', e.target.value)}
                  placeholder="e.g., £3,000 per month"
                />
              </div>
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
