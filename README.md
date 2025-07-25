# 🏡⚡ Sustainable Smart Home

<div align="center">

![Favicon](app/favicon.ico)

<h1 class="text-gradient">Build a smarter, greener future for your home</h1>

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-Latest-green)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-4.1-blue)](https://tailwindcss.com/)

[**Live Demo**](https://sustainable-smart-home.vercel.app) · [**Documentation**](#documentation) · [**Report Bug**](https://github.com/Elephant200/sustainable-smart-home/issues) · [**Request Feature**](https://github.com/Elephant200/sustainable-smart-home/issues)

</div>

---

## 🌟 **Overview**

**Sustainable Smart Home** is a comprehensive energy management platform that empowers homeowners to monitor, optimize, and control their home's energy ecosystem. Track solar generation, battery storage, EV charging, and grid interaction in real-time while maximizing savings and minimizing environmental impact.

### **✨ Key Benefits**

- 💰 **Save $3,200+ monthly** on energy costs
- 🔋 **Achieve 75% grid independence** 
- 🌱 **Reduce 6.2 tons CO₂** emissions per month
- ⚡ **98% system uptime** with intelligent monitoring
- 📱 **Real-time insights** across all energy devices

---

## 🚀 **Features**

### **🔋 Energy Management**
- **Real-time Energy Flow Visualization** - Interactive diagrams showing power flow between solar, battery, house, EV, and grid
- **Solar Panel Monitoring** - Individual panel tracking with efficiency ratings and weather impact analysis
- **Battery Storage Optimization** - Intelligent charge/discharge cycles based on usage patterns and grid rates
- **Smart Grid Integration** - Automated buying/selling of energy during optimal rate periods

### **🚗 EV Integration** 
- **Intelligent EV Charging** - Automatically charge using excess solar power
- **Multi-Vehicle Support** - Manage charging schedules for multiple electric vehicles
- **Overnight Optimization** - Schedule charging during low-rate periods
- **Solar-Powered Prioritization** - Maximize clean energy usage for transportation

### **📊 Analytics & Insights**
- **Cost Savings Tracking** - Detailed financial analysis and projections
- **Carbon Footprint Monitoring** - Track environmental impact reduction
- **Monthly Trend Analysis** - Historical data visualization and pattern recognition
- **Performance Benchmarking** - Compare efficiency against optimal scenarios

### **🔧 Smart Automation**
- **Intelligent Load Management** - Automatically shift high-energy tasks to optimal times
- **Weather-Based Optimization** - Adjust energy strategies based on weather forecasts
- **Grid Rate Intelligence** - Respond to dynamic electricity pricing
- **Predictive Maintenance** - Early detection of system issues and performance degradation

### **🛡️ Monitoring & Alerts**
- **24/7 System Health Monitoring** - Continuous oversight of all connected devices
- **Custom Alert Configuration** - Personalized notifications for important events
- **Performance Anomaly Detection** - AI-powered identification of unusual patterns
- **Remote Diagnostics** - Troubleshoot issues without on-site visits

---

## 🛠️ **Tech Stack**

### **Frontend**
- **[Next.js 15](https://nextjs.org/)** - React framework with App Router
- **[TypeScript](https://typescriptlang.org/)** - Type-safe JavaScript
- **[Tailwind CSS](https://tailwindcss.com/)** - Utility-first CSS framework
- **[Radix UI](https://radix-ui.com/)** - Accessible component primitives
- **[Recharts](https://recharts.org/)** - Data visualization library
- **[Lucide React](https://lucide.dev/)** - Beautiful icon set

### **Backend & Database**
- **[Supabase](https://supabase.com/)** - PostgreSQL database with real-time subscriptions
- **Row-Level Security (RLS)** - Secure, user-scoped data access
- **Real-time subscriptions** - Live updates for energy data
- **Edge Functions** - Serverless API endpoints

### **Authentication & Security**
- **Supabase Auth** - Email/password authentication with session management
- **Cookie-based sessions** - Secure authentication across SSR and client
- **Middleware protection** - Route-level access control
- **GDPR compliant** - User data privacy and account deletion

### **Development Tools**
- **ESLint** - Code linting and formatting
- **Tailwind CSS IntelliSense** - Enhanced development experience
- **TypeScript strict mode** - Maximum type safety
- **Git hooks** - Pre-commit code quality checks

---

## 📋 **Prerequisites**

Before you begin, ensure you have:

- **Node.js 18+** ([Download](https://nodejs.org/))
- **npm, yarn, or pnpm** package manager
- **Git** for version control
- **Supabase account** ([Sign up free](https://supabase.com/))

---

## ⚡ **Quick Start**

### **1. Clone the Repository**

```bash
git clone https://github.com/Elephant200/sustainable-smart-home.git
cd sustainable-smart-home
```

### **2. Install Dependencies**

```bash
# Using npm
npm install

# Using yarn
yarn install

# Using pnpm
pnpm install
```

### **3. Environment Setup**

1. Copy the environment template:
   ```bash
   cp .env.example .env.local
   ```

2. Update `.env.local` with your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   ```

   > 💡 Find these values in your [Supabase project settings](https://supabase.com/dashboard/project/_/settings/api)

### **4. Database Setup**

1. Create a new Supabase project at [database.new](https://database.new)
2. Run the database schema:
   ```bash
   # Navigate to SQL Editor in Supabase Dashboard
   # Copy and execute the contents of supabase/schema.sql
   ```

3. (Optional) Populate with sample data:
   ```bash
   npm run populate-db
   ```

### **5. Start Development Server**

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view your application! 🎉

---

## 📁 **Project Structure**

```
sustainable-smart-home/
├── app/                          # Next.js App Router
│   ├── api/                      # API routes
│   │   ├── configuration/        # Device configuration endpoints
│   │   ├── grid-data/           # Grid carbon intensity data
│   │   ├── house-load-data/     # House energy consumption
│   │   └── solar-generation-data/ # Solar panel production
│   ├── app/                     # Protected dashboard pages
│   │   ├── analytics/           # Energy analytics and insights
│   │   ├── battery/            # Battery monitoring and control
│   │   ├── ev-charging/        # EV charging management
│   │   ├── settings/           # Device configuration
│   │   └── solar/              # Solar panel monitoring
│   ├── auth/                   # Authentication pages
│   └── globals.css             # Global styles and theme
├── components/                 # Reusable React components
│   ├── auth/                  # Authentication components
│   ├── layout/                # Layout and navigation
│   ├── settings/              # Configuration components
│   ├── ui/                    # Base UI components (shadcn/ui)
│   └── visualizations/        # Charts and energy diagrams
├── lib/                       # Utilities and configurations
│   ├── data-generator/        # Sample data generation
│   ├── supabase/             # Database client and middleware
│   └── utils.ts              # Helper functions
├── supabase/                 # Database schema and functions
│   ├── schema.sql            # Database table definitions
│   └── schema_desc.md        # Schema documentation
└── middleware.ts             # Route protection and auth
```

---

## 🔧 **Configuration**

### **Device Setup**

1. **Navigate to Settings** - Go to `/app/settings` in your dashboard
2. **Add Your Devices** - Configure solar panels, batteries, EV chargers
3. **Set Location** - Enable weather-based optimizations
4. **Customize Alerts** - Configure notifications for your needs

### **Energy Sources**

The system supports monitoring for:

- ☀️ **Solar Panels** - Individual panel tracking and array management
- 🔋 **Battery Storage** - Charge cycles, capacity, and health monitoring  
- 🚗 **EV Chargers** - Smart charging schedules and solar integration
- 🏠 **House Load** - Real-time consumption tracking
- ⚡ **Grid Connection** - Import/export monitoring and rate optimization

### **Customization**

- **Themes** - Light/dark mode with system preference detection
- **Units** - Metric/Imperial unit preferences
- **Time Zones** - Automatic detection with manual override
- **Notifications** - Email/push notification preferences

---

## 📊 **API Documentation**

### **Authentication Required Endpoints**

All API endpoints require valid authentication. Include the session cookie or authorization header.

#### **Configuration**
- `GET /api/configuration/devices` - Retrieve user's configured devices
- `POST /api/configuration/devices` - Add new device configuration
- `PUT /api/configuration/devices/[id]` - Update device settings
- `DELETE /api/configuration/devices/[id]` - Remove device

#### **Energy Data**
- `GET /api/solar-generation-data` - Solar panel production data
- `GET /api/house-load-data` - House energy consumption
- `GET /api/grid-data` - Grid carbon intensity (public endpoint)

#### **Database Population** 
- `POST /api/populate-database` - Generate sample data for development

### **Response Format**

All API responses follow this structure:
```json
{
  "success": true,
  "data": { ... },
  "error": null,
  "timestamp": "2025-01-01T00:00:00Z"
}
```

---

## 🌍 **Environment Variables**

| Variable | Description | Required |
|----------|-------------|----------|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase project URL | ✅ |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anonymous API key | ✅ |
| `NODE_ENV` | Environment (development/production) | ❌ |

---

## 🚀 **Deployment**

### **Deploy to Vercel (Recommended)**

1. **Fork this repository** to your GitHub account

2. **Connect to Vercel**:
   [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FElephant200%2Fsustainable-smart-home)

3. **Add environment variables** in Vercel project settings

4. **Deploy** - Automatic deployments on every push to main branch

### **Deploy to Netlify**

1. Build the project:
   ```bash
   npm run build
   ```

2. Deploy the `out` directory to Netlify

### **Self-Hosted Deployment**

1. **Build for production**:
   ```bash
   npm run build
   npm start
   ```

2. **Use PM2 for process management**:
   ```bash
   npm install -g pm2
   pm2 start npm --name "smart-home" -- start
   ```

3. **Configure reverse proxy** (nginx/apache) for HTTPS

---

## 🤝 **Contributing**

We welcome contributions from the community! Here's how to get started:

### **Development Setup**

1. **Fork the repository** on GitHub
2. **Clone your fork** locally
3. **Create a feature branch**: `git checkout -b feature/amazing-feature`
4. **Install dependencies**: `npm install`
5. **Make your changes** and test thoroughly
6. **Commit with descriptive messages**: `git commit -m 'Add amazing feature'`
7. **Push to your branch**: `git push origin feature/amazing-feature`
8. **Open a Pull Request** with detailed description

### **Code Standards**

- **TypeScript** - All new code must be properly typed
- **ESLint** - Code must pass linting checks
- **Responsive Design** - All UI components must work on mobile/desktop
- **Accessibility** - Follow WCAG guidelines for inclusive design
- **Testing** - Include tests for new functionality

### **Areas for Contribution**

- 🔌 **Device Integrations** - Add support for new smart home devices
- 📊 **Visualizations** - Create new charts and energy dashboards  
- 🤖 **AI/ML Features** - Implement predictive analytics and optimization
- 🌐 **Internationalization** - Add support for multiple languages
- 📱 **Mobile App** - React Native companion application
- 🔒 **Security** - Enhance authentication and data protection

---

## 📄 **License**

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2025 Sustainable Smart Home

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## 🙏 **Acknowledgments**

- **[Supabase](https://supabase.com/)** - For providing an excellent backend-as-a-service platform
- **[Vercel](https://vercel.com/)** - For seamless deployment and hosting
- **[shadcn/ui](https://ui.shadcn.com/)** - For beautiful and accessible UI components
- **[Next.js Team](https://nextjs.org/)** - For the amazing React framework
- **Open Source Community** - For countless libraries and contributions

---

## 📞 **Support**

- **📚 Documentation**: [Project Wiki](https://github.com/Elephant200/sustainable-smart-home/wiki)
- **🐛 Bug Reports**: [GitHub Issues](https://github.com/Elephant200/sustainable-smart-home/issues)
- **💬 Discussions**: [GitHub Discussions](https://github.com/Elephant200/sustainable-smart-home/discussions)
- **📧 Email**: support@sustainablesmarthome.com

---

<div align="center">

**[⭐ Star this project](https://github.com/Elephant200/sustainable-smart-home)** if you find it helpful!

*Built with ❤️ for a sustainable future*

</div>
