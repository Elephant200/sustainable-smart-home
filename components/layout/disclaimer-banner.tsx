"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";

export function DisclaimerBanner() {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-gray-200 text-gray-900 py-3 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center gap-2 text-base font-medium">
          <AlertTriangle className="h-4 w-4 text-yellow-600" />
          <span>
            This website is not connected to hardware at this time.
          </span>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="ml-2 p-1 hover:bg-gray-300 rounded transition-all duration-200 ease-in-out transform hover:scale-105"
            aria-label="Toggle details"
          >
            <div className={`transition-transform duration-300 ease-in-out ${showDetails ? 'rotate-180' : 'rotate-0'}`}>
              <ChevronDown className="h-4 w-4 text-gray-700" />
            </div>
          </button>
        </div>
        
        <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
          showDetails 
            ? 'max-h-96 opacity-100 transform translate-y-0' 
            : 'max-h-0 opacity-0 transform -translate-y-2'
        }`}>
          <div className="mt-3 pt-3 border-t border-gray-300">
            <div className="text-base text-gray-700 max-w-4xl mx-auto">
              <div className="space-y-2">
                <ul className="list-disc pl-5">
                  <li>
                    Due to a lack of physical hardware, the dashboard and features are mockups with simulated data.
                  </li>
                  <li>
                    However, the interface and user experience are functional and demonstrate the full features.
                  </li>
                  <li>
                    If you would like to see the full functionality, please email <a href="mailto:alexktev@gmail.com" className="underline text-gray-800 hover:text-gray-900">alexktev@gmail.com</a>.
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 