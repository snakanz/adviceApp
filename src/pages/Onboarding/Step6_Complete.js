import React from 'react';
import { Button } from '../../components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/card';
import { CheckCircle2, Calendar, Users, BarChart3, MessageSquare } from 'lucide-react';

const Step6_Complete = ({ data, onComplete }) => {
    const features = [
        {
            icon: <Calendar className="w-6 h-6 text-primary" />,
            title: 'Meetings Dashboard',
            description: 'View all your meetings in one place with automatic sync'
        },
        {
            icon: <Users className="w-6 h-6 text-primary" />,
            title: 'Client Management',
            description: 'Track client relationships and business opportunities'
        },
        {
            icon: <BarChart3 className="w-6 h-6 text-primary" />,
            title: 'Pipeline Tracking',
            description: 'Monitor your sales pipeline and expected revenue'
        },
        {
            icon: <MessageSquare className="w-6 h-6 text-primary" />,
            title: 'AI Assistant',
            description: 'Get insights and summaries powered by AI'
        }
    ];

    return (
        <div className="max-w-2xl mx-auto">
            <Card className="shadow-large border-border/50">
                <CardHeader className="text-center space-y-4">
                    <div className="flex justify-center">
                        <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center">
                            <CheckCircle2 className="w-12 h-12 text-green-600" />
                        </div>
                    </div>
                    <CardTitle className="text-3xl font-bold">
                        You're all set!
                    </CardTitle>
                    <CardDescription className="text-base">
                        Welcome to Advicly, {data.business_name}! 🎉
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                    {/* Features Grid */}
                    <div className="space-y-4">
                        <h3 className="font-semibold text-sm uppercase text-muted-foreground text-center">
                            What you can do now:
                        </h3>
                        <div className="grid gap-4">
                            {features.map((feature, index) => (
                                <div
                                    key={index}
                                    className="flex items-start space-x-4 p-4 rounded-lg bg-muted/50 hover:bg-muted transition-colors"
                                >
                                    <div className="flex-shrink-0 mt-1">
                                        {feature.icon}
                                    </div>
                                    <div>
                                        <h4 className="font-semibold mb-1">
                                            {feature.title}
                                        </h4>
                                        <p className="text-sm text-muted-foreground">
                                            {feature.description}
                                        </p>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Quick Tips */}
                    <div className="bg-primary/5 border border-primary/20 rounded-lg p-6 space-y-3">
                        <h4 className="font-semibold text-primary">💡 Quick Tips</h4>
                        <ul className="text-sm text-muted-foreground space-y-2">
                            <li>• Upload meeting transcripts to get AI-powered summaries</li>
                            <li>• Use the Pipeline page to track your business opportunities</li>
                            <li>• Ask the AI assistant questions about your clients and meetings</li>
                            <li>• Set up action items to never miss a follow-up</li>
                        </ul>
                    </div>

                    {/* CTA Button */}
                    <Button
                        onClick={onComplete}
                        size="lg"
                        className="w-full text-lg h-14"
                    >
                        Go to Dashboard
                    </Button>

                    <p className="text-xs text-muted-foreground text-center">
                        Need help? Check out our{' '}
                        <button onClick={() => {}} className="underline hover:text-foreground">
                            Getting Started Guide
                        </button>
                        {' '}or{' '}
                        <button onClick={() => {}} className="underline hover:text-foreground">
                            Contact Support
                        </button>
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};

export default Step6_Complete;

