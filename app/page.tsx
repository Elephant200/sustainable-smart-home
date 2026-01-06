import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  Sun, 
  Battery, 
  TrendingUp, 
  Shield, 
  Smartphone,
  BarChart3,
  Leaf,
  Clock,
  ArrowRight,
  CheckCircle,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { Metadata } from "next";
import { TopNav } from "@/components/layout/top-nav";

export const metadata: Metadata = {
  title: "Sustainable Smart Home | Smart Energy Management",
  description: "Monitor, optimize, and control your home&apos;s energy usage with solar panels, battery storage, and EV charging. Save money while reducing your carbon footprint.",
};

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-blue-50">
      {/* Navigation */}
      <TopNav showScrollLinks={true} />

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-8">
              <div className="space-y-4">
                <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                  Smart Energy Management
                </Badge>
                <h1 className="text-4xl lg:text-6xl font-bold text-gray-900 leading-tight">
                  Take Control of Your 
                  <span className="text-gradient"> Energy Future</span>
                </h1>
                <p className="text-xl text-gray-600 leading-relaxed">
                  Monitor, optimize, and control your home&apos;s energy with solar panels, battery storage, 
                  and EV charging. Save thousands while reducing your carbon footprint.
                </p>
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4">
                <Link href="/auth/sign-up">
                  <Button size="lg" className="bg-green-600 hover:bg-green-700">
                    Start Your Journey
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Button size="lg" variant="outline">
                  Watch Demo
                </Button>
              </div>
              
              <div className="flex items-center gap-8 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Real-time monitoring</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Smart automation</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <span>Cost optimization</span>
                </div>
              </div>
            </div>
            
            <div className="relative">
              <div className="bg-white rounded-2xl shadow-2xl p-8 border">
                <div className="space-y-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600">$3,216</div>
                    <div className="text-sm text-gray-600">Saved this month</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center p-4 bg-yellow-50 rounded-lg">
                      <Sun className="h-8 w-8 text-yellow-600 mx-auto mb-2" />
                      <div className="font-semibold">4.86 kW</div>
                      <div className="text-xs text-gray-600">Solar generating</div>
                    </div>
                    <div className="text-center p-4 bg-blue-50 rounded-lg">
                      <Battery className="h-8 w-8 text-blue-600 mx-auto mb-2" />
                      <div className="font-semibold">87%</div>
                      <div className="text-xs text-gray-600">Battery charged</div>
                    </div>
                  </div>
                  
                  <div className="text-center text-sm text-gray-600">
                    <span className="inline-flex items-center gap-1">
                      <Leaf className="h-4 w-4 text-green-600" />
                      5.7 tons CO₂ reduced this month
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
              Everything You Need to Manage Your Energy
            </h2>
            <p className="text-xl text-gray-600 max-w-3xl mx-auto">
              Get complete visibility and control over your home&apos;s energy ecosystem
            </p>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <div className="space-y-6">
              <div className="space-y-4">
                <Badge variant="outline" className="bg-blue-100 text-blue-800">Real-Time Dashboard</Badge>
                <h3 className="text-2xl font-bold text-gray-900">
                  Monitor Your Energy Flow in Real-Time
                </h3>
                <p className="text-gray-600">
                  See exactly how energy moves through your home with our interactive 
                  energy flow diagram. Track solar generation, battery charging, EV usage, 
                  and grid interaction in real-time.
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Live energy flow visualization</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Real-time power generation and consumption</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Instant system health monitoring</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-xl border">
              <Image
                src="/about/flow-chart.png"
                alt="Real-time energy flow diagram showing power connections between solar, battery, house, EV and grid"
                width={600}
                height={400}
                className="w-full h-auto rounded-lg"
              />
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <div className="bg-white rounded-2xl p-4 shadow-xl border order-2 lg:order-1">
              <Image
                src="/about/solar-generation.png"
                alt="Solar panel monitoring dashboard with individual panel production and generation charts"
                width={600}
                height={400}
                className="w-full h-auto rounded-lg"
              />
            </div>
            <div className="space-y-6 order-1 lg:order-2">
              <div className="space-y-4">
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Solar Monitoring</Badge>
                <h3 className="text-2xl font-bold text-gray-900">
                  Track Every Solar Panel&apos;s Performance
                </h3>
                <p className="text-gray-600">
                  Monitor each solar panel individually with detailed production metrics, 
                  efficiency ratings, and performance trends. Identify issues before they 
                  impact your savings.
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Individual panel production tracking</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Daily and monthly generation reports</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Weather impact analysis</span>
                </div>
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <div className="space-y-6">
              <div className="space-y-4">
                <Badge variant="outline" className="bg-purple-100 text-purple-800">EV Integration</Badge>
                <h3 className="text-2xl font-bold text-gray-900">
                  Smart EV Charging Optimization
                </h3>
                <p className="text-gray-600">
                  Automatically charge your electric vehicle using excess solar power 
                  and optimize charging schedules to minimize costs while maximizing 
                  clean energy usage.
                </p>
              </div>
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Overnight charging schedule optimization</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Solar-powered charging prioritization</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span>Multiple vehicle support</span>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-4 shadow-xl border">
              <Image
                src="/about/ev-charging.png"
                alt="EV charging dashboard with vehicle status cards and overnight charging schedules"
                width={600}
                height={400}
                className="w-full h-auto rounded-lg"
              />
            </div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section id="how-it-works" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">How It Works</h2>
            <p className="text-xl text-gray-600">Get started in minutes, not hours</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <Card className="text-center p-8">
              <CardHeader>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Smartphone className="h-8 w-8 text-green-600" />
                </div>
                <CardTitle>1. Connect Your Devices</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Connect your solar panels, battery storage, EV chargers, and smart meters 
                  to our platform in minutes.
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center p-8">
              <CardHeader>
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <BarChart3 className="h-8 w-8 text-blue-600" />
                </div>
                <CardTitle>2. Monitor & Analyze</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Watch real-time energy flows, track savings, and get insights into 
                  your energy usage patterns.
                </p>
              </CardContent>
            </Card>
            
            <Card className="text-center p-8">
              <CardHeader>
                <div className="w-16 h-16 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <TrendingUp className="h-8 w-8 text-purple-600" />
                </div>
                <CardTitle>3. Optimize & Save</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-gray-600">
                  Let our AI optimize your energy usage automatically while you 
                  enjoy lower bills and reduced carbon footprint.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section id="benefits" className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
              Save Money While Saving the Planet
            </h2>
            <p className="text-xl text-gray-600">
              Join thousands of homeowners reducing costs and carbon emissions
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-16">
            <div className="text-center">
              <div className="text-4xl font-bold text-green-600 mb-2">$3,200</div>
              <div className="text-gray-600">Average monthly savings</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-blue-600 mb-2">75%</div>
              <div className="text-gray-600">Grid independence</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-purple-600 mb-2">6.2</div>
              <div className="text-gray-600">Tons CO₂ reduced/month</div>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-orange-600 mb-2">98%</div>
              <div className="text-gray-600">System uptime</div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-4 shadow-xl border">
            <Image
              src="/about/analytics.png"
              alt="Analytics dashboard showing cost savings charts and environmental impact metrics"
              width={800}
              height={500}
              className="w-full h-auto rounded-lg"
            />
          </div>
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="py-20 bg-gray-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            <div className="space-y-6">
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
                Built for the Future of Energy
              </h2>
              <p className="text-lg text-gray-600">
                Our platform was designed by energy experts and smart home enthusiasts 
                who believe that managing your home&apos;s energy should be simple, 
                intelligent, and rewarding.
              </p>
              <p className="text-gray-600">
                We&apos;re on a mission to accelerate the transition to sustainable energy 
                by making it easier for homeowners to monitor, control, and optimize 
                their energy systems. Every kilowatt saved and every solar panel 
                optimized brings us closer to a cleaner future.
              </p>
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-green-600" />
                  <span>Enterprise-grade security</span>
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-5 w-5 text-green-600" />
                  <span>24/7 system monitoring</span>
                </div>
                <div className="flex items-center gap-3">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span>Continuous optimization</span>
                </div>
              </div>
            </div>
            <div className="bg-gradient-to-br from-green-100 to-blue-100 rounded-2xl p-12 text-center">
              <div className="w-20 h-20 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <TrendingUp className="h-10 w-10 text-white" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-4">Continuous Innovation</h3>
              <p className="text-gray-700">
                Our platform evolves with your needs, adding new features and optimizations 
                to keep your energy system running at peak efficiency.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Open Source Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center space-y-4 mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">
              Open Source & Transparent
            </h2>
            <p className="text-xl text-gray-600">
              Built in the open, powered by community
            </p>
          </div>
          
          <div className="max-w-4xl mx-auto">
            <div className="bg-gradient-to-br from-gray-50 to-green-50 rounded-2xl p-8 border border-gray-200">
              <div className="text-center space-y-6">
                <div className="w-16 h-16 bg-gray-900 rounded-full flex items-center justify-center mx-auto">
                  <svg className="h-8 w-8 text-white" fill="currentColor" viewBox="0 0 24 24">
                    <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="space-y-4">
                  <h3 className="text-2xl font-bold text-gray-900">
                    Fully Open Source
                  </h3>
                  <p className="text-gray-600 text-lg">
                    This entire platform is open source and available on GitHub. 
                    Explore the code, contribute features, report issues, or fork it 
                    to create your own smart home energy management solution.
                  </p>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
                  <div className="text-center">
                    <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
                    <div className="font-semibold text-gray-900">Transparent Code</div>
                    <div className="text-sm text-gray-600">See exactly how it works</div>
                  </div>
                  <div className="text-center">
                    <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
                    <div className="font-semibold text-gray-900">Community Driven</div>
                    <div className="text-sm text-gray-600">Contributions welcome</div>
                  </div>
                  <div className="text-center">
                    <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
                    <div className="font-semibold text-gray-900">Self Hostable</div>
                    <div className="text-sm text-gray-600">Deploy on your own infrastructure</div>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <a 
                    href="https://github.com/Elephant200/sustainable-smart-home" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-6 py-3 border border-gray-300 text-base font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 transition-colors"
                  >
                    <svg className="h-5 w-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                      <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                    </svg>
                    View on GitHub
                  </a>
                  <a 
                    href="https://github.com/Elephant200/sustainable-smart-home/blob/main/README.md" 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center px-6 py-3 border border-green-600 text-base font-medium rounded-md text-green-600 bg-white hover:bg-green-50 transition-colors"
                  >
                    Documentation
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-green-600 to-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            <h2 className="text-3xl lg:text-4xl font-bold text-white">
              Ready to Transform Your Home&apos;s Energy?
            </h2>
            <p className="text-xl text-green-100">
              Join thousands of smart homeowners saving money and reducing their carbon footprint
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <Link href="/auth/sign-up">
                <Button size="lg" className="bg-white text-green-600 hover:bg-gray-100">
                  Start Free Trial
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button size="lg" variant="outline" className="border-green-700 bg-green-600 text-white hover:bg-green-700 hover:text-gray-100">
                Schedule Demo
              </Button>
            </div>
            <p className="text-sm text-green-100">
              No credit card required • 30-day free trial • Cancel anytime
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Zap className="h-6 w-6 text-green-400" />
                <span className="text-xl font-bold">Sustainable Smart Home</span>
              </div>
              <p className="text-gray-400">
                Smart energy management for sustainable living.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Product</h3>
              <div className="space-y-2 text-gray-400">
                <div>Features</div>
                <div>Pricing</div>
                <div>Demo</div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Company</h3>
              <div className="space-y-2 text-gray-400">
                <div>About</div>
                <div>Blog</div>
                <div>Careers</div>
              </div>
            </div>
            <div>
              <h3 className="font-semibold mb-4">Support</h3>
              <div className="space-y-2 text-gray-400">
                <div>Help Center</div>
                <div>Contact</div>
                <div>Status</div>
              </div>
            </div>
          </div>
          <div className="border-t border-gray-800 mt-8 pt-8 text-center text-gray-400">
            <p>&copy; 2025 Sustainable Smart Home. All rights reserved.</p>
          </div>
        </div>
      </footer>
    </div>
  );
} 