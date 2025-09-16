import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import DataImport from '../components/DataImport';
import NotificationSettings from '../components/NotificationSettings';
import {
  Settings as SettingsIcon,
  User,
  Shield,
  Palette,
  Database,
  Upload,
  ArrowLeft
} from 'lucide-react';

export default function Settings() {
  const [activeSection, setActiveSection] = useState('main'); // 'main' or 'data-import'

  if (activeSection === 'data-import') {
    return (
      <div className="h-full flex flex-col bg-background">
        {/* Header */}
        <div className="border-b border-border/50 p-6 bg-card/50">
          <div className="flex items-center gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setActiveSection('main')}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Settings
            </Button>
            <div className="p-2 bg-primary/10 rounded-lg">
              <Upload className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Data Import</h1>
              <p className="text-muted-foreground">Import clients and meetings from spreadsheets</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          <DataImport />
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="border-b border-border/50 p-6 bg-card/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-primary/10 rounded-lg">
            <SettingsIcon className="w-6 h-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Settings</h1>
            <p className="text-muted-foreground">Manage your Advicly settings</p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Profile Settings */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-5 h-5 text-primary" />
                Profile Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Manage your personal information and account details.
              </p>
              <Button variant="outline" className="w-full">
                Edit Profile
              </Button>
            </CardContent>
          </Card>

          {/* Notifications */}
          <NotificationSettings />

          {/* Security */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Shield className="w-5 h-5 text-primary" />
                Security
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Manage your account security and privacy settings.
              </p>
              <Button variant="outline" className="w-full">
                Security Settings
              </Button>
            </CardContent>
          </Card>

          {/* Appearance */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Palette className="w-5 h-5 text-primary" />
                Appearance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Customize the look and feel of your Advicly experience.
              </p>
              <Button variant="outline" className="w-full">
                Customize Theme
              </Button>
            </CardContent>
          </Card>

          {/* Data & Storage */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="w-5 h-5 text-primary" />
                Data & Storage
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Import clients and meetings from Excel/CSV files, manage data exports, and configure storage preferences.
              </p>
              <div className="space-y-2">
                <Button
                  variant="outline"
                  className="w-full flex items-center gap-2"
                  onClick={() => setActiveSection('data-import')}
                >
                  <Upload className="w-4 h-4" />
                  Import Data
                </Button>
                <Button variant="outline" className="w-full" disabled>
                  Export Data (Coming Soon)
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Coming Soon */}
          <Card className="border-border/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <SettingsIcon className="w-5 h-5 text-primary" />
                Advanced Settings
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Advanced configuration options for power users.
              </p>
              <Button variant="outline" className="w-full" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
} 