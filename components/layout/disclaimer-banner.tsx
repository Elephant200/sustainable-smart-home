"use client";

import { useState } from "react";
import { AlertTriangle, ChevronDown } from "lucide-react";

export function DisclaimerBanner() {
  const [showDetails, setShowDetails] = useState(false);

  return (
    <div className="bg-red-600 text-white py-3 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-center gap-2 text-base font-medium">
          <AlertTriangle className="h-4 w-4" />
          <span>
            This website is still a work in progress and for demonstration purposes only.
          </span>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="ml-2 p-1 hover:bg-red-700 rounded transition-all duration-200 ease-in-out transform hover:scale-105"
            aria-label="Toggle details"
          >
            <div className={`transition-transform duration-300 ease-in-out ${showDetails ? 'rotate-180' : 'rotate-0'}`}>
              <ChevronDown className="h-4 w-4" />
            </div>
          </button>
        </div>
        
        <div className={`overflow-hidden transition-all duration-500 ease-in-out ${
          showDetails 
            ? 'max-h-96 opacity-100 transform translate-y-0' 
            : 'max-h-0 opacity-0 transform -translate-y-2'
        }`}>
          <div className="mt-3 pt-3 border-t border-red-500">
            <div className="text-sm text-red-100 max-w-4xl mx-auto">
              <div className="space-y-2">
                <ul className="list-disc pl-5">
                  <li>
                    This website was built while at the Columbia SHAPE program - in 3 weeks - so I ran out of time to implement the full functionality.
                  </li>
                  <li>
                    Due to a lack of physical hardware, the dashboard and features are mockups with simulated data.
                  </li>
                  <li>
                    However, the interface and user experience are functional and demonstrate the future features.
                  </li>
                  <li>
                    I will be updating this website with the full functionality as I continue to work on the project.
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