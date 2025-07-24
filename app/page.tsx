import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Zap, 
  Sun, 
  Battery, 
  Car, 
  Home, 
  TrendingUp, 
  Shield, 
  Smartphone,
  BarChart3,
  Leaf,
  DollarSign,
  Clock,
  ArrowRight,
  CheckCircle
} from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import { TopNav } from "@/components/layout/top-nav";

export const metadata: Metadata = {
  title: "Sustainable Smart Home | Smart Energy Management",
  description: "Monitor, optimize, and control your home's energy usage with solar panels, battery storage, and EV charging. Save money while reducing your carbon footprint.",
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
                  Monitor, optimize, and control your home's energy with solar panels, battery storage, 
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
              Get complete visibility and control over your home's energy ecosystem
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
            <div className="bg-gray-100 rounded-2xl p-8 text-center">
              <div className="text-gray-500 text-lg mb-4">📸 Screenshot Needed:</div>
              <div className="text-gray-700 font-medium mb-2">Dashboard Energy Flow Diagram</div>
              <div className="text-sm text-gray-600">
                Show the real-time energy flow diagram with arrows connecting 
                solar → battery → house → EV and grid, displaying live power values
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center mb-20">
            <div className="bg-gray-100 rounded-2xl p-8 text-center order-2 lg:order-1">
              <div className="text-gray-500 text-lg mb-4">📸 Screenshot Needed:</div>
              <div className="text-gray-700 font-medium mb-2">Solar Panel Monitoring</div>
              <div className="text-sm text-gray-600">
                Display the solar page showing individual panel icons with production numbers, 
                daily statistics, and the solar generation chart
              </div>
            </div>
            <div className="space-y-6 order-1 lg:order-2">
              <div className="space-y-4">
                <Badge variant="outline" className="bg-yellow-100 text-yellow-800">Solar Monitoring</Badge>
                <h3 className="text-2xl font-bold text-gray-900">
                  Track Every Solar Panel's Performance
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
            <div className="bg-gray-100 rounded-2xl p-8 text-center">
              <div className="text-gray-500 text-lg mb-4">📸 Screenshot Needed:</div>
              <div className="text-gray-700 font-medium mb-2">EV Charging Dashboard</div>
              <div className="text-sm text-gray-600">
                Show the EV charging page with vehicle status cards, overnight charging 
                graph, and smart scheduling interface
              </div>
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
          
          <div className="bg-gray-100 rounded-2xl p-8 text-center">
            <div className="text-gray-500 text-lg mb-4">📸 Screenshot Needed:</div>
            <div className="text-gray-700 font-medium mb-2">Analytics & Savings Dashboard</div>
            <div className="text-sm text-gray-600">
              Display the analytics page showing cost savings charts, environmental impact 
              metrics, and detailed financial breakdowns
            </div>
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
                who believe that managing your home's energy should be simple, 
                intelligent, and rewarding.
              </p>
              <p className="text-gray-600">
                We're on a mission to accelerate the transition to sustainable energy 
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

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-green-600 to-blue-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <div className="space-y-8">
            <h2 className="text-3xl lg:text-4xl font-bold text-white">
              Ready to Transform Your Home's Energy?
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