import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Card, CardContent } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import CalendarSettings from '../components/CalendarSettings';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import {
  User,
  Building2,
  Users,
  Calendar,
  CreditCard,
  Gift,
  ChevronRight,
  Loader2,
  Check,
  X,
  Sparkles
} from 'lucide-react';
import { Badge } from '../components/ui/badge';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_BASE_URL || 'http://localhost:3001';

// Menu items for sidebar
const menuItems = [
  { id: 'personal', label: 'Personal', icon: User, description: 'Account settings' },
  { id: 'company', label: 'Company', icon: Building2, description: 'Company settings' },
  { id: 'team', label: 'Team', icon: Users, description: 'Coming soon', comingSoon: true },
  { id: 'meetings', label: 'Meetings', icon: Calendar, description: 'Recording settings' },
  { id: 'billing', label: 'Billing', icon: CreditCard, description: 'Subscription & plans' },
  { id: 'referral', label: 'Referral Program', icon: Gift, description: 'Coming soon', comingSoon: true },
];

// Plan features for billing section
const freePlanFeatures = [
  { text: '5 AI-transcribed meetings', included: true },
  { text: 'Meeting summaries', included: true },
  { text: 'Client management', included: true },
  { text: 'Basic pipeline tracking', included: true },
  { text: 'Unlimited AI meetings', included: false },
  { text: 'Advanced AI assistant', included: false },
  { text: 'Document uploads', included: false },
  { text: 'Email templates', included: false }
];

const proPlanFeatures = [
  'Unlimited AI-transcribed meetings',
  'Advanced AI meeting summaries',
  'Full client pipeline management',
  'Action items & follow-ups',
  'Ask Advicly AI assistant',
  'Document uploads',
  'Email templates',
  'Priority support'
];

export default function Settings() {
  const { user, getAccessToken } = useAuth();
  const [searchParams] = useSearchParams();
  const sectionParam = searchParams.get('section');
  const [activeSection, setActiveSection] = useState(sectionParam || 'personal');
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Billing states
  const [billingLoading, setBillingLoading] = useState(false);
  const [billingError, setBillingError] = useState('');

  // Form states
  const [personalData, setPersonalData] = useState({
    firstName: '',
    lastName: '',
    email: ''
  });

  const [companyData, setCompanyData] = useState({
    companyName: ''
  });

  // Load user data on mount
  useEffect(() => {
    const loadCompanyData = async () => {
      try {
        const { data: userData, error } = await supabase
          .from('users')
          .select('business_name')
          .eq('id', user.id)
          .single();

        if (!error && userData) {
          setCompanyData({
            companyName: userData.business_name || ''
          });
        }
      } catch (err) {
        console.error('Error loading company data:', err);
      }
    };

    if (user) {
      // Split name into first and last
      const nameParts = (user.name || '').split(' ');
      const firstName = nameParts[0] || '';
      const lastName = nameParts.slice(1).join(' ') || '';

      setPersonalData({
        firstName,
        lastName,
        email: user.email || ''
      });

      // Load company data
      loadCompanyData();
    }
  }, [user]);

  const handleSavePersonal = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const fullName = `${personalData.firstName} ${personalData.lastName}`.trim();

      const { error } = await supabase
        .from('users')
        .update({
          name: fullName,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving personal data:', err);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveCompany = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const { error } = await supabase
        .from('users')
        .update({
          business_name: companyData.companyName,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id);

      if (error) throw error;

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error('Error saving company data:', err);
      alert('Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const handleUpgrade = async () => {
    setBillingLoading(true);
    setBillingError('');

    try {
      const token = await getAccessToken();
      const priceId = process.env.REACT_APP_STRIPE_PRICE_ID;

      if (!priceId) {
        setBillingError('Payment system is not configured. Please contact support.');
        setBillingLoading(false);
        return;
      }

      const response = await axios.post(
        `${API_BASE_URL}/api/billing/checkout`,
        { priceId, successUrl: '/settings?section=billing' },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.url) {
        window.location.href = response.data.url;
      } else {
        throw new Error('No checkout URL received');
      }
    } catch (err) {
      console.error('Error creating checkout session:', err);
      setBillingError(err.response?.data?.error || 'Failed to start checkout. Please try again.');
    } finally {
      setBillingLoading(false);
    }
  };

  // Render content based on active section
  const renderContent = () => {
    switch (activeSection) {
      case 'personal':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">Personal</h2>
              <p className="text-sm text-muted-foreground">Manage your account settings</p>
            </div>

            <Card className="border-border/50">
              <CardContent className="p-6 space-y-6">
                <h3 className="font-medium text-foreground">Account</h3>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="firstName">First name</Label>
                    <Input
                      id="firstName"
                      value={personalData.firstName}
                      onChange={(e) => setPersonalData(prev => ({ ...prev, firstName: e.target.value }))}
                      placeholder="Enter your first name"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName">Last name</Label>
                    <Input
                      id="lastName"
                      value={personalData.lastName}
                      onChange={(e) => setPersonalData(prev => ({ ...prev, lastName: e.target.value }))}
                      placeholder="Enter your last name"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    value={personalData.email}
                    disabled
                    className="bg-muted/50"
                  />
                  <p className="text-xs text-muted-foreground">Email cannot be changed</p>
                </div>

                <Button
                  onClick={handleSavePersonal}
                  disabled={saving}
                  className="flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="w-4 h-4" />
                  ) : null}
                  {saveSuccess ? 'Saved!' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      case 'company':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">Company</h2>
              <p className="text-sm text-muted-foreground">Manage your company settings</p>
            </div>

            <Card className="border-border/50">
              <CardContent className="p-6 space-y-6">
                <h3 className="font-medium text-foreground">Company Details</h3>

                <div className="space-y-2">
                  <Label htmlFor="companyName">Company name</Label>
                  <Input
                    id="companyName"
                    value={companyData.companyName}
                    onChange={(e) => setCompanyData(prev => ({ ...prev, companyName: e.target.value }))}
                    placeholder="Enter your company name"
                  />
                </div>

                <Button
                  onClick={handleSaveCompany}
                  disabled={saving}
                  className="flex items-center gap-2"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : saveSuccess ? (
                    <Check className="w-4 h-4" />
                  ) : null}
                  {saveSuccess ? 'Saved!' : 'Save Changes'}
                </Button>
              </CardContent>
            </Card>
          </div>
        );

      case 'billing':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">Billing</h2>
              <p className="text-sm text-muted-foreground">Manage your subscription and billing</p>
            </div>

            {/* Plan Comparison */}
            <div className="grid md:grid-cols-2 gap-6">
              {/* Free Plan */}
              <Card className="border-border/50">
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Free Plan</h3>
                    <p className="text-sm text-muted-foreground">Your current plan</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">£0</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      5 free AI-transcribed meetings
                    </p>
                  </div>
                  <div className="space-y-2">
                    {freePlanFeatures.map((feature, index) => (
                      <div key={index} className="flex items-start gap-2">
                        {feature.included ? (
                          <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        ) : (
                          <X className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                        )}
                        <span className={`text-sm ${!feature.included ? 'text-muted-foreground line-through' : ''}`}>
                          {feature.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Pro Plan */}
              <Card className="border-2 border-primary bg-primary/5 relative">
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <Badge className="bg-yellow-400 text-black border-0 px-3 py-1 text-xs font-bold">
                    RECOMMENDED
                  </Badge>
                </div>
                <CardContent className="p-6 space-y-4">
                  <div>
                    <h3 className="text-xl font-bold mb-1">Professional</h3>
                    <p className="text-sm text-muted-foreground">Unlimited everything</p>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-baseline gap-2">
                      <span className="text-4xl font-bold">£70</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <p className="text-sm text-green-600 font-medium">
                      Billed monthly
                    </p>
                  </div>
                  <div className="space-y-2">
                    {proPlanFeatures.map((feature, index) => (
                      <div key={index} className="flex items-start gap-2">
                        <Check className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                        <span className="text-sm font-medium">{feature}</span>
                      </div>
                    ))}
                  </div>
                  <Button
                    onClick={handleUpgrade}
                    disabled={billingLoading}
                    className="w-full mt-4 bg-primary hover:bg-primary/90"
                  >
                    {billingLoading ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-4 h-4 mr-2" />
                        Upgrade to Professional
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Error Message */}
            {billingError && (
              <div className="p-3 text-sm text-red-600 bg-red-50 border border-red-200 rounded-md">
                {billingError}
              </div>
            )}
          </div>
        );

      case 'team':
      case 'referral':
        const item = menuItems.find(m => m.id === activeSection);
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">{item?.label}</h2>
              <p className="text-sm text-muted-foreground">{item?.description}</p>
            </div>

            <Card className="border-border/50">
              <CardContent className="p-12 text-center">
                <div className="w-16 h-16 bg-muted rounded-full flex items-center justify-center mx-auto mb-4">
                  {item && <item.icon className="w-8 h-8 text-muted-foreground" />}
                </div>
                <h3 className="text-lg font-medium text-foreground mb-2">Coming Soon</h3>
                <p className="text-sm text-muted-foreground max-w-sm mx-auto">
                  We're working on this feature. Stay tuned for updates!
                </p>
              </CardContent>
            </Card>
          </div>
        );

      case 'meetings':
        return (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold text-foreground mb-1">Meetings</h2>
              <p className="text-sm text-muted-foreground">Configure your calendar connections and recording settings</p>
            </div>

            <CalendarSettings />
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="h-full flex bg-background">
      {/* Sidebar */}
      <div className="w-64 border-r border-border/50 bg-card/50 flex flex-col">
        {/* User Info Header */}
        <div className="p-4 border-b border-border/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center text-primary-foreground font-semibold">
              {(user?.name?.[0] || user?.email?.[0] || 'U').toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-foreground truncate">
                {user?.name || 'User'}
              </p>
              <p className="text-xs text-muted-foreground">Account settings</p>
            </div>
          </div>
        </div>

        {/* Menu Items */}
        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {menuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveSection(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                activeSection === item.id
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
              }`}
            >
              <item.icon className="w-5 h-5 flex-shrink-0" />
              <span className="flex-1 text-sm font-medium">{item.label}</span>
              {item.comingSoon && (
                <span className="text-[10px] px-1.5 py-0.5 bg-muted rounded text-muted-foreground">
                  Soon
                </span>
              )}
              <ChevronRight className="w-4 h-4 opacity-50" />
            </button>
          ))}
        </nav>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-2xl">
          {renderContent()}
        </div>
      </div>
    </div>
  );
}