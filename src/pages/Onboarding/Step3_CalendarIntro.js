import React from 'react';
import { Button } from '../../components/ui/button';
import { Calendar, Clock, Users, Zap, CheckCircle2 } from 'lucide-react';

const Step3_CalendarIntro = ({ onNext, onBack }) => {
    const benefits = [
        {
            icon: <Calendar className="w-6 h-6 text-primary" />,
            title: 'Automatic Meeting Sync',
            description: 'All your meetings automatically sync from your calendar in real-time'
        },
        {
            icon: <Users className="w-6 h-6 text-primary" />,
            title: 'Smart Client Extraction',
            description: 'Automatically identify and organize clients from meeting attendees'
        },
        {
            icon: <Clock className="w-6 h-6 text-primary" />,
            title: 'Save Hours Weekly',
            description: 'No more manual data entry. Focus on what matters - your clients'
        },
        {
            icon: <Zap className="w-6 h-6 text-primary" />,
            title: 'AI-Powered Insights',
            description: 'Get automatic meeting summaries and action items powered by AI'
        }
    ];

    return (
        <div className="max-w-6xl mx-auto px-6 py-16">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
                {/* LEFT COLUMN - Content */}
                <div className="space-y-8">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground font-semibold">
                        Question 2 of 4
                    </p>

                    <div className="space-y-3">
                        <h1 className="text-4xl font-bold text-foreground">
                            Connect your calendar
                        </h1>
                        <p className="text-lg text-muted-foreground">
                            Sync your meetings and let Advicly handle the rest
                        </p>
                    </div>

                    {/* Benefits */}
                    <div className="space-y-4">
                        {benefits.map((benefit, index) => (
                            <div key={index} className="space-y-2">
                                <div className="flex items-start space-x-3">
                                    <div className="flex-shrink-0 mt-1">
                                        {benefit.icon}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold text-foreground">
                                            {benefit.title}
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            {benefit.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Trust Badge */}
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4 flex items-start space-x-3">
                        <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-medium text-green-900">
                                Your data is secure
                            </p>
                            <p className="text-xs text-green-700 mt-1">
                                We only read your calendar events. We never modify or delete anything.
                            </p>
                        </div>
                    </div>

                    {/* Buttons */}
                    <div className="flex gap-3 pt-8">
                        <Button
                            variant="outline"
                            onClick={onBack}
                        >
                            Back
                        </Button>
                        <Button
                            onClick={onNext}
                            className="ml-auto"
                        >
                            Continue
                        </Button>
                    </div>
                </div>

                {/* RIGHT COLUMN - Illustration */}
                <div className="hidden lg:flex items-center justify-center">
                    <div className="w-full h-96 bg-gradient-to-br from-blue-100 to-blue-50 rounded-lg flex items-center justify-center border border-border">
                        <span className="text-muted-foreground text-sm">Calendar Integration Illustration</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Step3_CalendarIntro;

