"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { fetchJson, FetchJsonError } from "@/lib/client/fetch-json";

interface LocationSelectorProps {
  initialProfile?: {
    city?: string;
    state?: string;
    zone_key?: string;
  };
}

export function LocationSelector({ initialProfile }: LocationSelectorProps) {
  const [formData, setFormData] = useState({
    streetAddress: "",
    city: "",
    state: "",
    zipCode: "",
    country: ""
  });
  const [currentProfile, setCurrentProfile] = useState(initialProfile);
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState<{
    type: 'success' | 'error' | null;
    message: string;
  }>({ type: null, message: '' });

  const handleInputChange = (field: keyof typeof formData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setFeedback({ type: null, message: '' });
  };

  // Auto-clear success messages after 5 seconds
  useEffect(() => {
    if (feedback.type === 'success') {
      const timer = setTimeout(() => {
        setFeedback({ type: null, message: '' });
      }, 2500);

      return () => clearTimeout(timer);
    }
  }, [feedback.type]);

  const isFormValid = () => {
    return formData.city.trim() && 
           formData.state.trim();
  };

  const handleSaveLocation = async () => {
    if (!isFormValid()) {
      setFeedback({
        type: 'error',
        message: 'Please fill in all required fields.',
      });
      return;
    }

    setIsLoading(true);
    setFeedback({ type: null, message: '' });

    try {
      const result = await fetchJson<{ zone_key: string }>('/api/configuration/update-location', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      
      // Update current profile with saved data
      setCurrentProfile({
        city: formData.city,
        state: formData.state,
        zone_key: result.zone_key,
      });
      
      // Clear form after successful save
      setFormData({
        streetAddress: "",
        city: "",
        state: "",
        zipCode: "",
        country: ""
      });
      
      setFeedback({
        type: 'success',
        message: `Location saved successfully! Zone: ${result.zone_key}`,
      });
    } catch (err) {
      const message =
        err instanceof FetchJsonError
          ? err.message
          : 'Failed to save location. Please try again.';
      setFeedback({ type: 'error', message });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Address Form */}
      <div className="space-y-4">
        {/* Street Address */}
        <div>
          <Label htmlFor="streetAddress">Street Address</Label>
          <Input
            id="streetAddress"
            type="text"
            value={formData.streetAddress}
            onChange={(e) => handleInputChange('streetAddress', e.target.value)}
            placeholder="123 AnyStreet"
            className="w-full"
          />
        </div>

        {/* City and State */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="city">City</Label>
            <Input
              id="city"
              type="text"
              value={formData.city}
              onChange={(e) => handleInputChange('city', e.target.value)}
              placeholder="AnyCity"
              className="w-full"
            />
          </div>
          <div>
            <Label htmlFor="state">State/Province</Label>
            <Input
              id="state"
              type="text"
              value={formData.state}
              onChange={(e) => handleInputChange('state', e.target.value)}
              placeholder="AnyState"
              className="w-full"
            />
          </div>
        </div>

        {/* Zip Code and Country */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="zipCode">ZIP/Postal Code</Label>
            <Input
              id="zipCode"
              type="text"
              value={formData.zipCode}
              onChange={(e) => handleInputChange('zipCode', e.target.value)}
              placeholder="12345"
              className="w-full"
            />
          </div>
          <div>
            <Label htmlFor="country">Country</Label>
            <Input
              id="country"
              type="text"
              value={formData.country}
              onChange={(e) => handleInputChange('country', e.target.value)}
              placeholder="United States"
              className="w-full"
            />
          </div>
        </div>
      </div>

      {/* Save Button */}
      <Button
        onClick={handleSaveLocation}
        disabled={!isFormValid() || isLoading}
        className="w-full"
      >
        {isLoading ? 'Saving...' : 'Save Location'}
      </Button>

      {/* Current Location Display */}
      <div className="text-sm text-muted-foreground">
        Current: {currentProfile?.city && currentProfile?.state 
          ? `${currentProfile.city}, ${currentProfile.state}` 
          : '(not set)'} 
        {currentProfile?.zone_key && ` | Zone: ${currentProfile.zone_key}`}
      </div>

      {/* Feedback */}
      {feedback.type && (
        <div className={`text-sm p-2 rounded-md ${
          feedback.type === 'success' 
            ? 'bg-primary/10 text-primary border border-primary/30' 
            : 'bg-destructive/10 text-destructive border border-destructive/30'
        }`}>
          {feedback.message}
        </div>
      )}
    </div>
  );
} 