import React, { useState } from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { Calendar, Clock, Users } from 'lucide-react';

const Step3_CalendarChoice = ({ data, onNext, onBack, onSkip }) => {
    const [selectedProvider, setSelectedProvider] = useState(data.calendar_provider || null);

    const handleSelect = (provider) => {
        setSelectedProvider(provider);
    };

    const handleContinue = () => {
        if (selectedProvider) {
            onNext({ calendar_provider: selectedProvider });
        }
    };

    const calendarOptions = [
        {
            id: 'google',
            name: 'Google Calendar',
            description: 'Connect your Google Calendar to automatically sync meetings',
            icon: (
                <svg className="w-12 h-12" viewBox="0 0 48 48">
                    <path fill="#1976D2" d="M24,9.604c-6.4,0-10.4,3.199-12,9.597c2.4-3.199,5.2-4.398,8.4-3.599 c1.826,0.456,3.131,1.781,4.576,3.247C27.328,21.236,30.051,24,36,24c6.4,0,10.4-3.199,12-9.598c-2.4,3.199-5.2,4.399-8.4,3.6 c-1.825-0.456-3.13-1.781-4.575-3.247C32.672,12.367,29.948,9.604,24,9.604L24,9.604z M12,24c-6.4,0-10.4,3.199-12,9.598 c2.4-3.199,5.2-4.399,8.4-3.599c1.825,0.457,3.13,1.781,4.575,3.246c2.353,2.388,5.077,5.152,11.025,5.152 c6.4,0,10.4-3.199,12-9.598c-2.4,3.199-5.2,4.399-8.4,3.6c-1.826-0.456-3.131-1.781-4.576-3.246C20.672,26.764,17.949,24,12,24 L12,24z"/>
                </svg>
            ),
            recommended: true
        },
        {
            id: 'calendly',
            name: 'Calendly',
            description: 'Connect via Calendly if your company blocks direct calendar access',
            icon: <Calendar className="w-12 h-12 text-blue-600" />,
            recommended: false
        }
    ];

    return (
        <div className="max-w-4xl mx-auto">
            <Card className="shadow-large border-border/50">
                <CardHeader className="text-center space-y-2">
                    <CardTitle className="text-3xl font-bold">
                        Connect your calendar
                    </CardTitle>
                    <CardDescription className="text-base">
                        Automatically sync your meetings and never miss a follow-up
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="grid gap-4">
                        {calendarOptions.map((option) => (
                            <button
                                key={option.id}
                                onClick={() => handleSelect(option.id)}
                                className={`relative p-6 rounded-lg border-2 transition-all text-left ${
                                    selectedProvider === option.id
                                        ? 'border-primary bg-primary/5'
                                        : 'border-border hover:border-primary/50 hover:bg-muted/50'
                                }`}
                            >
                                {option.recommended && (
                                    <div className="absolute top-4 right-4">
                                        <span className="px-2 py-1 text-xs font-medium bg-primary text-primary-foreground rounded-full">
                                            Recommended
                                        </span>
                                    </div>
                                )}
                                <div className="flex items-start space-x-4">
                                    <div className="flex-shrink-0">
                                        {option.icon}
                                    </div>
                                    <div className="flex-1">
                                        <h3 className="text-lg font-semibold mb-1">
                                            {option.name}
                                        </h3>
                                        <p className="text-sm text-muted-foreground">
                                            {option.description}
                                        </p>
                                    </div>
                                    <div className="flex-shrink-0">
                                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                                            selectedProvider === option.id
                                                ? 'border-primary bg-primary'
                                                : 'border-muted-foreground'
                                        }`}>
                                            {selectedProvider === option.id && (
                                                <div className="w-2 h-2 bg-white rounded-full" />
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </button>
                        ))}
                    </div>

                    {/* Benefits Section */}
                    <div className="bg-muted/50 rounded-lg p-6 space-y-4">
                        <h4 className="font-semibold text-sm uppercase text-muted-foreground">
                            Why connect your calendar?
                        </h4>
                        <div className="grid gap-3">
                            <div className="flex items-start space-x-3">
                                <Clock className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium">Automatic meeting sync</p>
                                    <p className="text-xs text-muted-foreground">
                                        Your meetings appear automatically in Advicly
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3">
                                <Users className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium">Client tracking</p>
                                    <p className="text-xs text-muted-foreground">
                                        Automatically link meetings to client records
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-start space-x-3">
                                <Calendar className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                                <div>
                                    <p className="text-sm font-medium">Real-time updates</p>
                                    <p className="text-xs text-muted-foreground">
                                        Changes in your calendar sync instantly
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex justify-between items-center pt-4">
                        <div className="flex space-x-3">
                            <Button
                                variant="outline"
                                onClick={onBack}
                            >
                                Back
                            </Button>
                            <Button
                                variant="ghost"
                                onClick={onSkip}
                                className="text-muted-foreground"
                            >
                                Skip for now
                            </Button>
                        </div>
                        <Button
                            onClick={handleContinue}
                            disabled={!selectedProvider}
                            size="lg"
                            className="min-w-[150px]"
                        >
                            Continue
                        </Button>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
};

export default Step3_CalendarChoice;

