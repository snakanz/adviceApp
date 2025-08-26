import React, { useState } from 'react';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Calendar, Clock, MapPin, Users, FileText, Plus, X, Mic, Square } from 'lucide-react';
import { cn } from '../lib/utils';

const API_URL = process.env.REACT_APP_API_BASE_URL || 'https://adviceapp-9rgw.onrender.com';

export default function CreateMeetingDialog({ onMeetingCreated, trigger }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [recording, setRecording] = useState(false);
  const [mediaRecorder, setMediaRecorder] = useState(null);
  const [recordedBlob, setRecordedBlob] = useState(null);
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

  // Reset form when dialog opens/closes
  const handleOpenChange = (newOpen) => {
    setOpen(newOpen);
    if (!newOpen) {
      // Reset form when closing
      setFormData({
        title: '',
        description: '',
        startTime: '',
        endTime: '',
        locationType: 'video',
        locationDetails: '',
        attendees: '',
        transcript: ''
      });
      setRecordedBlob(null);
      if (mediaRecorder && recording) {
        mediaRecorder.stop();
        setRecording(false);
      }
    }
  };

  // Handle form input changes
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  // Start audio recording
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      const chunks = [];

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunks.push(event.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'audio/wav' });
        setRecordedBlob(blob);
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setMediaRecorder(recorder);
      setRecording(true);
    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Failed to start recording. Please check microphone permissions.');
    }
  };

  // Stop audio recording
  const stopRecording = () => {
    if (mediaRecorder && recording) {
      mediaRecorder.stop();
      setRecording(false);
    }
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.title.trim() || !formData.startTime) {
      alert('Please fill in the title and start time');
      return;
    }

    setLoading(true);

    try {
      const token = localStorage.getItem('jwt');
      
      // Create the meeting
      const response = await fetch(`${API_URL}/api/calendar/meetings/manual`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create meeting');
      }

      const data = await response.json();
      const meetingId = data.meeting.id;

      // If there's a recorded audio file, upload it
      if (recordedBlob) {
        const audioFormData = new FormData();
        audioFormData.append('files', recordedBlob, 'meeting-recording.wav');

        await fetch(`${API_URL}/api/calendar/meetings/${meetingId}/documents`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`
          },
          body: audioFormData
        });
      }

      // Success
      setOpen(false);
      if (onMeetingCreated) {
        onMeetingCreated(data.meeting);
      }

    } catch (error) {
      console.error('Error creating meeting:', error);
      alert(error.message || 'Failed to create meeting');
    } finally {
      setLoading(false);
    }
  };

  // Auto-set end time when start time changes
  const handleStartTimeChange = (value) => {
    handleInputChange('startTime', value);
    
    if (value && !formData.endTime) {
      // Auto-set end time to 1 hour after start time
      const startDate = new Date(value);
      const endDate = new Date(startDate.getTime() + 60 * 60 * 1000); // Add 1 hour
      const endTimeString = endDate.toISOString().slice(0, 16);
      handleInputChange('endTime', endTimeString);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger || (
          <Button className="flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Create Meeting
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Create New Meeting</DialogTitle>
        </DialogHeader>
        
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
                onChange={(e) => handleStartTimeChange(e.target.value)}
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
              />
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="locationType">Location Type</Label>
              <Select value={formData.locationType} onValueChange={(value) => handleInputChange('locationType', value)}>
                <SelectTrigger>
                  <SelectValue />
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
              placeholder="Client name or attendee list"
            />
          </div>

          {/* Audio Recording */}
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Mic className="w-4 h-4" />
                Audio Recording
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-center gap-2">
                {!recording ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={startRecording}
                    className="flex items-center gap-2"
                  >
                    <Mic className="w-4 h-4" />
                    Start Recording
                  </Button>
                ) : (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    onClick={stopRecording}
                    className="flex items-center gap-2"
                  >
                    <Square className="w-4 h-4" />
                    Stop Recording
                  </Button>
                )}
                {recording && (
                  <div className="flex items-center gap-2 text-sm text-red-600">
                    <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse"></div>
                    Recording...
                  </div>
                )}
                {recordedBlob && !recording && (
                  <div className="text-sm text-green-600">
                    ✓ Recording saved
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Transcript */}
          <div className="space-y-2">
            <Label htmlFor="transcript">Transcript (Optional)</Label>
            <Textarea
              id="transcript"
              value={formData.transcript}
              onChange={(e) => handleInputChange('transcript', e.target.value)}
              placeholder="Paste meeting transcript here if available"
              rows={4}
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setOpen(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="flex items-center gap-2"
            >
              {loading ? 'Creating...' : 'Create Meeting'}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
