import React, { useState, useEffect } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from './ui/dialog';
import { Edit, Save, X, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from './ui/alert';

const API_URL = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

export default function EditMeetingDialog({ 
  meeting, 
  open, 
  onOpenChange, 
  onMeetingUpdated 
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    startTime: '',
    endTime: '',
    locationType: 'video',
    locationDetails: '',
    attendees: '',
    transcript: ''
  });

  // Check if meeting is editable (only manual meetings can be fully edited)
  const isManualMeeting = meeting?.is_manual || meeting?.meeting_source === 'manual';
  const isGoogleMeeting = meeting?.meeting_source === 'google' || (!meeting?.is_manual && !meeting?.meeting_source);

  // Initialize form data when meeting changes
  useEffect(() => {
    if (meeting && open) {
      const startTime = meeting.starttime || meeting.startTime || meeting.start?.dateTime;
      const endTime = meeting.endtime || meeting.endTime || meeting.end?.dateTime;
      
      setFormData({
        title: meeting.title || meeting.summary || '',
        description: meeting.summary || meeting.description || '',
        startTime: startTime ? new Date(startTime).toISOString().slice(0, 16) : '',
        endTime: endTime ? new Date(endTime).toISOString().slice(0, 16) : '',
        locationType: meeting.location_type || 'video',
        locationDetails: meeting.location_details || meeting.location || '',
        attendees: meeting.manual_attendees || extractAttendeesString(meeting.attendees) || '',
        transcript: meeting.transcript || ''
      });
      setError('');
    }
  }, [meeting, open]);

  // Extract attendees string from JSON
  const extractAttendeesString = (attendeesJson) => {
    if (!attendeesJson) return '';
    try {
      const attendees = JSON.parse(attendeesJson);
      return attendees
        .filter(a => a.email && a.email !== 'simon@greenwood.co.nz') // Filter out the advisor
        .map(a => a.displayName || a.email)
        .join(', ');
    } catch (e) {
      return '';
    }
  };

  // Handle input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim()) {
      setError('Meeting title is required');
      return;
    }

    if (!isManualMeeting && !formData.transcript.trim() && formData.transcript !== meeting?.transcript) {
      // For Google meetings, only allow transcript updates
      setError('Only transcript can be edited for Google Calendar meetings');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const token = localStorage.getItem('jwt');
      
      if (isManualMeeting) {
        // Update manual meeting
        const response = await fetch(`${API_URL}/api/calendar/meetings/manual/${meeting.googleeventid || meeting.id}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify(formData)
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update meeting');
        }

        const data = await response.json();
        if (onMeetingUpdated) {
          onMeetingUpdated(data.meeting);
        }
      } else {
        // For Google meetings, only update transcript
        const response = await fetch(`${API_URL}/api/calendar/meetings/${meeting.googleeventid || meeting.id}/transcript`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            transcript: formData.transcript
          })
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to update transcript');
        }

        const data = await response.json();
        if (onMeetingUpdated) {
          onMeetingUpdated(data.meeting);
        }
      }

      onOpenChange(false);
    } catch (error) {
      console.error('Error updating meeting:', error);
      setError(error.message || 'Failed to update meeting');
    } finally {
      setLoading(false);
    }
  };

  if (!meeting) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Edit className="w-5 h-5" />
            Edit Meeting
            {isGoogleMeeting && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                Google Calendar
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {isGoogleMeeting && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              This is a Google Calendar meeting. Only the transcript can be edited. 
              To modify other details, please edit the meeting in Google Calendar.
            </AlertDescription>
          </Alert>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="title">Meeting Title *</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => handleInputChange('title', e.target.value)}
                placeholder="Enter meeting title"
                disabled={isGoogleMeeting}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Meeting description or agenda"
                rows={3}
                disabled={isGoogleMeeting}
              />
            </div>
          </div>

          {/* Date and Time */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="startTime">Start Time *</Label>
              <Input
                id="startTime"
                type="datetime-local"
                value={formData.startTime}
                onChange={(e) => handleInputChange('startTime', e.target.value)}
                disabled={isGoogleMeeting}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="endTime">End Time</Label>
              <Input
                id="endTime"
                type="datetime-local"
                value={formData.endTime}
                onChange={(e) => handleInputChange('endTime', e.target.value)}
                disabled={isGoogleMeeting}
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="locationType">Meeting Type</Label>
              <Select
                value={formData.locationType}
                onValueChange={(value) => handleInputChange('locationType', value)}
                disabled={isGoogleMeeting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select meeting type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">Video Call</SelectItem>
                  <SelectItem value="phone">Phone Call</SelectItem>
                  <SelectItem value="in-person">In Person</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="locationDetails">Location Details</Label>
              <Input
                id="locationDetails"
                value={formData.locationDetails}
                onChange={(e) => handleInputChange('locationDetails', e.target.value)}
                placeholder="Meeting link, address, or phone number"
                disabled={isGoogleMeeting}
              />
            </div>
          </div>

          {/* Attendees */}
          <div className="space-y-2">
            <Label htmlFor="attendees">Attendees</Label>
            <Input
              id="attendees"
              value={formData.attendees}
              onChange={(e) => handleInputChange('attendees', e.target.value)}
              placeholder="Enter attendee names or emails, separated by commas"
              disabled={isGoogleMeeting}
            />
          </div>

          {/* Transcript */}
          <div className="space-y-2">
            <Label htmlFor="transcript">Meeting Transcript</Label>
            <Textarea
              id="transcript"
              value={formData.transcript}
              onChange={(e) => handleInputChange('transcript', e.target.value)}
              placeholder="Enter or paste meeting transcript"
              rows={6}
            />
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={loading}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
            >
              <Save className="w-4 h-4 mr-2" />
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
