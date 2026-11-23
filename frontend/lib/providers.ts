/** Trackable third-party providers (label shown in UI, value stored on the key). */
export type ProviderOption = { value: string; label: string; group: string };

export const PROVIDER_OPTIONS: ProviderOption[] = [
  // AI & LLM
  { value: "openai", label: "OpenAI", group: "AI & LLM" },
  { value: "anthropic", label: "Anthropic", group: "AI & LLM" },
  { value: "gemini", label: "Google Gemini", group: "AI & LLM" },
  { value: "pinecone", label: "Pinecone", group: "AI & LLM" },
  { value: "soniox", label: "Soniox", group: "AI & LLM" },
  { value: "sarvam", label: "Sarvam", group: "AI & LLM" },

  // Email & messaging
  { value: "sendgrid", label: "SendGrid", group: "Email & messaging" },
  { value: "meta", label: "Meta / WhatsApp", group: "Email & messaging" },
  { value: "periskope", label: "Periskope", group: "Email & messaging" },

  // Telephony & realtime
  { value: "twilio", label: "Twilio", group: "Telephony & realtime" },
  { value: "plivo", label: "Plivo", group: "Telephony & realtime" },
  { value: "telnyx", label: "Telnyx", group: "Telephony & realtime" },
  { value: "livekit", label: "LiveKit", group: "Telephony & realtime" },

  // Payments
  { value: "stripe", label: "Stripe", group: "Payments" },
  { value: "razorpay", label: "Razorpay", group: "Payments" },

  // CRM & calendars
  { value: "gohighlevel", label: "GoHighLevel", group: "CRM & calendars" },
  { value: "salesforce", label: "Salesforce", group: "CRM & calendars" },
  { value: "zoho", label: "Zoho Books", group: "CRM & calendars" },
  { value: "calcom", label: "Cal.com", group: "CRM & calendars" },
  { value: "calendly", label: "Calendly", group: "CRM & calendars" },
  { value: "google", label: "Google (OAuth / Calendar)", group: "CRM & calendars" },
  { value: "microsoft", label: "Microsoft (OAuth / Calendar)", group: "CRM & calendars" },
  { value: "zoom", label: "Zoom", group: "CRM & calendars" },

  // Observability
  { value: "sentry", label: "Sentry", group: "Observability" },
  { value: "newrelic", label: "New Relic", group: "Observability" },
];

export const PROVIDER_VALUES = PROVIDER_OPTIONS.map((p) => p.value);

export function providerGroups(): { group: string; options: ProviderOption[] }[] {
  const map = new Map<string, ProviderOption[]>();
  for (const opt of PROVIDER_OPTIONS) {
    const list = map.get(opt.group) || [];
    list.push(opt);
    map.set(opt.group, list);
  }
  return Array.from(map.entries()).map(([group, options]) => ({ group, options }));
}
