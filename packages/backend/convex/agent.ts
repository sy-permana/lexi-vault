import { google } from "@ai-sdk/google";
import { Agent } from "@convex-dev/agent";

import { components } from "./_generated/api";

export const chatAgent = new Agent(components.agent, {
	name: "Chat Agent",
	languageModel: google("gemini-3-flash-preview"),
	instructions:
		"You are a helpful AI assistant. Be concise and friendly in your responses.",
});
