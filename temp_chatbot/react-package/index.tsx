import React, { useEffect } from "react";

// Declaring global window config interfaces for TypeScript
declare global {
  interface Window {
    ChatbotConfig?: {
      apiKey: string;
      apiHost?: string;
      overrideSettings?: {
        brandColor?: string;
        welcomeMessage?: string;
        position?: string;
        emailCaptureRequired?: boolean;
        avatarUrl?: string | null;
      };
    };
  }
}

export interface ChatWidgetProps {
  apiKey: string;
  apiHost?: string;
  brandColor?: string;
  welcomeMessage?: string;
  position?: "bottom-right" | "bottom-left" | string;
  emailCaptureRequired?: boolean;
  avatarUrl?: string | null;
}

export const ChatWidget: React.FC<ChatWidgetProps> = ({
  apiKey,
  apiHost = "http://localhost:8000",
  brandColor,
  welcomeMessage,
  position,
  emailCaptureRequired,
  avatarUrl
}) => {
  useEffect(() => {
    // 1. Setup Chatbot Config on the global window object
    window.ChatbotConfig = {
      apiKey,
      apiHost,
      overrideSettings: {
        ...(brandColor && { brandColor }),
        ...(welcomeMessage && { welcomeMessage }),
        ...(position && { position }),
        ...(emailCaptureRequired !== undefined && { emailCaptureRequired }),
        ...(avatarUrl !== undefined && { avatarUrl }),
      }
    };

    // 2. Inject the universal script if not already present on page
    const scriptId = "ai-chatbot-universal-script";
    let script = document.getElementById(scriptId) as HTMLScriptElement;

    if (!script) {
      script = document.createElement("script");
      script.id = scriptId;
      // Dynamically load from either the provided apiHost or default local resource
      // For standard usage, let's load the universal widget.js
      script.src = `${apiHost}/widget.js`; 
      script.async = true;
      document.body.appendChild(script);
    } else {
      // If script exists but settings updated, trigger re-evaluation of settings
      const widget = document.querySelector("ai-chatbot-widget");
      if (widget && (widget as any).loadSettings) {
        (widget as any).loadSettings().then(() => {
          if ((widget as any).applySettings) {
            (widget as any).applySettings();
          }
          if ((widget as any).loadConversation) {
            (widget as any).loadConversation();
          }
        });
      }
    }

    return () => {
      // Optional cleanup - we keep script running, but we can clean overrides if unmounted
      if (window.ChatbotConfig) {
        delete window.ChatbotConfig.overrideSettings;
      }
    };
  }, [apiKey, apiHost, brandColor, welcomeMessage, position, emailCaptureRequired, avatarUrl]);

  return (
    // Render the custom Web Component directly in React's DOM tree
    // JSX needs to be aware of the custom tag name
    React.createElement("ai-chatbot-widget", {
      "api-key": apiKey,
      "api-host": apiHost
    } as any)
  );
};
