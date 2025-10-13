import React, { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Alert, AlertDescription } from './ui/alert';
import { Textarea } from './ui/textarea';
import { 
  Plus, 
  Trash2, 
  User, 
  Mail, 
  Phone, 
  MapPin,
  Building2,
  Calendar,
  AlertCircle,
  CheckCircle2
} from 'lucide-react';

const PIPELINE_STAGES = [
  'Client Signed',
  'Waiting to Sign',
  'Waiting on Paraplanning',
  'Have Not Written Advice',
  'Need to Book Meeting',
  "Can't Contact Client"
];

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

const PRIORITY_LEVELS = [
  { value: 1, label: 'Urgent' },
  { value: 2, label: 'High' },
  { value: 3, label: 'Medium' },
  { value: 4, label: 'Low' },
  { value: 5, label: 'Lowest' }
];

const SOURCES = [
  'Referral',
  'Website',
  'Social Media',
  'Cold Outreach',
  'Networking Event',
  'Existing Client',
  'Other'
];

export default function CreateClientForm({ onClose, onSuccess, isSubmitting = false }) {
  const [formData, setFormData] = useState({
    // Basic client info
    name: '',
    email: '',
    phone: '',
    address: '',
    // Pipeline info
    pipeline_stage: '',
    likely_close_month: '',
    priority_level: 3,
    notes: '',
    source: '',
    // Business types
    business_types: [createEmptyBusinessType()]
  });

  const [errors, setErrors] = useState({});
  const [success, setSuccess] = useState('');

  function createEmptyBusinessType() {
    return {
      business_type: '',
      contribution_method: '',
      business_amount: '',
      regular_contribution_amount: '',
      iaf_expected: '',
      expected_close_date: '',
      notes: ''
    };
  }

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }
  };

  const handleBusinessTypeChange = (index, field, value) => {
    setFormData(prev => ({
      ...prev,
      business_types: prev.business_types.map((bt, i) => 
        i === index ? { ...bt, [field]: value } : bt
      )
    }));
  };

  const addBusinessType = () => {
    setFormData(prev => ({
      ...prev,
      business_types: [...prev.business_types, createEmptyBusinessType()]
    }));
  };

  const removeBusinessType = (index) => {
    if (formData.business_types.length > 1) {
      setFormData(prev => ({
        ...prev,
        business_types: prev.business_types.filter((_, i) => i !== index)
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    // Basic validation
    if (!formData.name.trim()) newErrors.name = 'Name is required';
    if (!formData.email.trim()) newErrors.email = 'Email is required';
    if (!formData.pipeline_stage) newErrors.pipeline_stage = 'Pipeline stage is required';

    // Email format validation
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'Please enter a valid email address';
    }

    // Business types validation
    const validBusinessTypes = formData.business_types.filter(bt => 
      bt.business_type && bt.contribution_method
    );

    if (validBusinessTypes.length === 0) {
      newErrors.business_types = 'At least one complete business type is required';
    }

    // Validate regular contribution amounts
    for (let i = 0; i < formData.business_types.length; i++) {
      const bt = formData.business_types[i];
      if (bt.business_type && bt.contribution_method === 'Regular Monthly Contribution' && !bt.regular_contribution_amount) {
        newErrors[`business_type_${i}_regular_amount`] = 'Regular contribution amount is required';
      }
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }

    // Filter out incomplete business types
    const validBusinessTypes = formData.business_types.filter(bt => 
      bt.business_type && bt.contribution_method
    );

    const submitData = {
      ...formData,
      business_types: validBusinessTypes
    };

    try {
      await onSuccess(submitData);
      setSuccess('Client created successfully!');
    } catch (error) {
      setErrors({ submit: error.message || 'Failed to create client' });
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Create New Client</h2>
            <Button variant="ghost" onClick={onClose} disabled={isSubmitting}>
              ×
            </Button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Alerts */}
          {errors.submit && (
            <Alert className="border-red-200 bg-red-50">
              <AlertCircle className="h-4 w-4 text-red-600" />
              <AlertDescription className="text-red-800">{errors.submit}</AlertDescription>
            </Alert>
          )}

          {success && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle2 className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">{success}</AlertDescription>
            </Alert>
          )}

          {/* Basic Client Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5" />
                Client Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">Full Name *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => handleInputChange('name', e.target.value)}
                    placeholder="Enter client's full name"
                    className={errors.name ? 'border-red-500' : ''}
                  />
                  {errors.name && <p className="text-sm text-red-600 mt-1">{errors.name}</p>}
                </div>

                <div>
                  <Label htmlFor="email">Email Address *</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="email"
                      type="email"
                      value={formData.email}
                      onChange={(e) => handleInputChange('email', e.target.value)}
                      placeholder="client@example.com"
                      className={`pl-10 ${errors.email ? 'border-red-500' : ''}`}
                    />
                  </div>
                  {errors.email && <p className="text-sm text-red-600 mt-1">{errors.email}</p>}
                </div>

                <div>
                  <Label htmlFor="phone">Phone Number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="phone"
                      value={formData.phone}
                      onChange={(e) => handleInputChange('phone', e.target.value)}
                      placeholder="+44 7XXX XXXXXX"
                      className="pl-10"
                    />
                  </div>
                </div>

                <div>
                  <Label htmlFor="source">Source</Label>
                  <Select value={formData.source} onValueChange={(value) => handleInputChange('source', value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="How did you acquire this client?" />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCES.map((source) => (
                        <SelectItem key={source} value={source}>
                          {source}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div>
                <Label htmlFor="address">Address</Label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-3 w-4 h-4 text-gray-400" />
                  <Textarea
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    placeholder="Client's address"
                    className="pl-10"
                    rows={2}
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Pipeline Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="w-5 h-5" />
                Pipeline Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="pipeline_stage">Pipeline Stage *</Label>
                  <Select 
                    value={formData.pipeline_stage} 
                    onValueChange={(value) => handleInputChange('pipeline_stage', value)}
                  >
                    <SelectTrigger className={errors.pipeline_stage ? 'border-red-500' : ''}>
                      <SelectValue placeholder="Select pipeline stage" />
                    </SelectTrigger>
                    <SelectContent>
                      {PIPELINE_STAGES.map((stage) => (
                        <SelectItem key={stage} value={stage.toLowerCase().replace(/[^a-z0-9]/g, '_')}>
                          {stage}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.pipeline_stage && <p className="text-sm text-red-600 mt-1">{errors.pipeline_stage}</p>}
                </div>

                <div>
                  <Label htmlFor="priority_level">Priority Level</Label>
                  <Select 
                    value={formData.priority_level.toString()} 
                    onValueChange={(value) => handleInputChange('priority_level', parseInt(value))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PRIORITY_LEVELS.map((level) => (
                        <SelectItem key={level.value} value={level.value.toString()}>
                          {level.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label htmlFor="likely_close_month">Expected Close Date</Label>
                  <div className="relative">
                    <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <Input
                      id="likely_close_month"
                      type="date"
                      value={formData.likely_close_month}
                      onChange={(e) => handleInputChange('likely_close_month', e.target.value)}
                      className="pl-10"
                    />
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={formData.notes}
                  onChange={(e) => handleInputChange('notes', e.target.value)}
                  placeholder="Additional notes about this client..."
                  rows={3}
                />
              </div>
            </CardContent>
          </Card>

          {/* Business Types Section - This will be continued in the next part */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Building2 className="w-5 h-5" />
                  Business Types *
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addBusinessType}
                  className="flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add Business Type
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {errors.business_types && (
                <p className="text-sm text-red-600">{errors.business_types}</p>
              )}
              
              {formData.business_types.map((businessType, index) => (
                <div key={index} className="border rounded-lg p-4 relative">
                  {formData.business_types.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBusinessType(index)}
                      className="absolute top-2 right-2 text-red-600 hover:text-red-700"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                    <div>
                      <Label>Business Type *</Label>
                      <Select
                        value={businessType.business_type}
                        onValueChange={(value) => handleBusinessTypeChange(index, 'business_type', value)}
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
                      <Label>Contribution Method *</Label>
                      <Select
                        value={businessType.contribution_method}
                        onValueChange={(value) => handleBusinessTypeChange(index, 'contribution_method', value)}
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
                  </div>

                  {businessType.contribution_method === 'Regular Monthly Contribution' && (
                    <div className="mb-4">
                      <Label>Regular Contribution Amount *</Label>
                      <Input
                        value={businessType.regular_contribution_amount}
                        onChange={(e) => handleBusinessTypeChange(index, 'regular_contribution_amount', e.target.value)}
                        placeholder="e.g., £3,000 per month"
                        className={errors[`business_type_${index}_regular_amount`] ? 'border-red-500' : ''}
                      />
                      {errors[`business_type_${index}_regular_amount`] && (
                        <p className="text-sm text-red-600 mt-1">{errors[`business_type_${index}_regular_amount`]}</p>
                      )}
                    </div>
                  )}

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Business Amount (£)</Label>
                      <Input
                        type="number"
                        value={businessType.business_amount}
                        onChange={(e) => handleBusinessTypeChange(index, 'business_amount', e.target.value)}
                        placeholder="Enter amount in pounds"
                      />
                    </div>

                    <div>
                      <Label>IAF Expected (£)</Label>
                      <Input
                        type="number"
                        value={businessType.iaf_expected}
                        onChange={(e) => handleBusinessTypeChange(index, 'iaf_expected', e.target.value)}
                        placeholder="Initial advice fee expected"
                      />
                    </div>
                  </div>

                  <div className="mt-4">
                    <Label>Expected Close Date</Label>
                    <Input
                      type="date"
                      value={businessType.expected_close_date || ''}
                      onChange={(e) => handleBusinessTypeChange(index, 'expected_close_date', e.target.value)}
                      placeholder="Select expected close date"
                    />
                  </div>

                  <div className="mt-4">
                    <Label>Notes</Label>
                    <Textarea
                      value={businessType.notes}
                      onChange={(e) => handleBusinessTypeChange(index, 'notes', e.target.value)}
                      placeholder="Additional notes for this business type..."
                      rows={2}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Form Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
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
              {isSubmitting ? 'Creating...' : 'Create Client'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
