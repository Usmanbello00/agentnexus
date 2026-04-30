import { z } from "zod";
import { ToolDefinition } from "../registry.js";

export const weatherTool: ToolDefinition = {
  name: "get_weather",
  description: "Get current weather for a location using Open-Meteo API.",
  parameters: z.object({
    location: z.string().describe("The city name (e.g., 'London', 'New York')."),
  }),
  platform: "shared",
  execute: async ({ location }) => {
    // In a real app, we'd geocode the location first.
    // For this demo, we'll use a mock geocoding or just call the API with a default lat/long if it's a known city.
    const mockCoords: Record<string, { lat: number, lon: number }> = {
      "london": { lat: 51.5074, lon: -0.1278 },
      "new york": { lat: 40.7128, lon: -74.0060 },
      "tokyo": { lat: 35.6895, lon: 139.6917 },
      "berlin": { lat: 52.5200, lon: 13.4050 },
      "paris": { lat: 48.8566, lon: 2.3522 },
    };

    const coords = mockCoords[location.toLowerCase()] || { lat: 0, lon: 0 };
    
    try {
      const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true`);
      const data = await response.json();
      
      if (data.current_weather) {
        return {
          location,
          temperature: data.current_weather.temperature,
          windspeed: data.current_weather.windspeed,
          condition: "Clear", // Open-Meteo gives codes, we'll simplify
          unit: "celsius"
        };
      }
      return `Could not find weather for ${location}.`;
    } catch (error: any) {
      return `Error fetching weather: ${error.message}`;
    }
  },
};
