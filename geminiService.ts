
import { GoogleGenAI, Type, GenerateContentResponse } from "@google/genai";
import { SYSTEM_INSTRUCTIONS } from "../constants";

// Always use process.env.API_KEY directly for initialization
const getAI = () => new GoogleGenAI({ apiKey: process.env.API_KEY });

export const analyzeMaintenance = async (description: string, imageBase64?: string): Promise<string> => {
  const ai = getAI();
  const prompt = `Analyze this maintenance request for a rental property.
Description: ${description}

Please provide:
1. A summary of the likely technical issue.
2. Estimated repair cost range in THB.
3. Urgency priority (Low, Medium, High, Critical).
4. Recommendation for immediate action.`;

  const parts: any[] = [{ text: prompt }];
  
  if (imageBase64) {
    const mimeTypeMatch = imageBase64.match(/^data:(.*);base64,/);
    const mimeType = mimeTypeMatch ? mimeTypeMatch[1] : 'image/jpeg';
    
    parts.push({
      inlineData: {
        data: imageBase64.split(',')[1],
        mimeType: mimeType
      }
    });
  }

  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: { parts },
    config: {
      systemInstruction: SYSTEM_INSTRUCTIONS,
      temperature: 0.4
    },
  });
  
  return response.text || "Unable to analyze request.";
};

export const suggestTaskDetails = async (description: string): Promise<{ assignee: string, priority: string, reasoning: string }> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Analyze this property management task: "${description}". 
    Suggest:
    1. An assignee category (Maintenance, Admin, Legal, or Security).
    2. A priority level (Low, Medium, High, or Critical).
    3. A brief 1-sentence reasoning.`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTIONS,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          assignee: { type: Type.STRING },
          priority: { type: Type.STRING },
          reasoning: { type: Type.STRING }
        },
        required: ["assignee", "priority", "reasoning"]
      }
    },
  });

  try {
    return JSON.parse(response.text || "{}");
  } catch (e) {
    return { assignee: "Admin", priority: "Medium", reasoning: "Analysis failed, defaulted to standard parameters." };
  }
};

export const generateLeaseAgreement = async (data: any): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-pro-preview',
    contents: `Draft a professional short-form rental agreement based on these details: ${JSON.stringify(data)}`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTIONS,
    },
  });
  return response.text || "Error generating agreement.";
};

export const generatePaymentReminder = async (invoice: any): Promise<string> => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Draft a polite but firm payment reminder for an overdue invoice. 
    Room: ${invoice.roomNumber}, Month: ${invoice.month}, Amount: ${invoice.amount} THB. 
    Ensure it reflects the SW.BERNHARDT brand.`,
    config: {
      systemInstruction: SYSTEM_INSTRUCTIONS,
      temperature: 0.7
    },
  });
  return response.text || "Failed to generate reminder.";
};

export const propertySearch = async (query: string) => {
  const ai = getAI();
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Find real estate trends or laws relevant to: ${query}`,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  return {
    text: response.text,
    sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks || []
  };
};
