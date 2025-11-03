import React from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
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
        <div className="max-w-2xl mx-auto">
            <Card className="shadow-large border-border/50">
                <CardHeader className="text-center space-y-4">
                    <div className="flex justify-center">
                        <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center">
                            <Calendar className="w-8 h-8 text-blue-600" />
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-bold">
                        Connect your calendar
                    </CardTitle>
                    <CardDescription className="text-base">
                        Sync your meetings and let Advicly handle the rest
                    </CardDescription>
                </CardHeader>

                <CardContent className="space-y-8">
                    {/* Benefits Grid */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm uppercase text-muted-foreground text-center">
                            Why connect your calendar:
                        </h3>
                        <div className="grid gap-4">
                            {benefits.map((benefit, index) => (
                                <div
                                    key={index}
                                    className="flex items-start space-x-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                                >
                                    <div className="flex-shrink-0 mt-1">
                                        {benefit.icon}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-1">
                                            {benefit.title}
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            {benefit.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
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

                    {/* CTA Buttons */}
                    <div className="space-y-3">
                        <Button
                            onClick={onNext}
                            size="lg"
                            className="w-full text-lg h-12"
                        >
                            Connect Your Calendar
                        </Button>
                        <Button
                            onClick={onBack}
                            variant="outline"
                            size="lg"
                            className="w-full text-lg h-12"
                        >
                            Back
                        </Button>
                    </div>

                    <p className="text-xs text-muted-foreground text-center">
                        You can also connect your calendar later from Settings
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};

export default Step3_CalendarIntro;

