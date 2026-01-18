import { v } from "convex/values";
import { internal } from "./_generated/api";
import { internalAction, internalMutation } from "./_generated/server";

export const generateDocumentIndex = internalAction({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args) => {
		console.log("[Indexer] Generating index for:", args.documentId);

		// 1. Fetch all text content
		const content = await ctx.runQuery(
			internal.documents.getAllDocumentContent,
			{
				documentId: args.documentId,
			}
		);

		if (!content || content.length === 0) {
			console.log("[Indexer] No content found, skipping index generation");
			return;
		}

		// 2. Prepare context for AI
		// We'll take the first 500 chars of each page to capture headers/structure
		// without overwhelming context (though 1.5 Flash handles huge context easily)
		const documentContext = content
			.map(
				(page: { pageNumber: number; markdown?: string }) =>
					`<page number="${page.pageNumber}">\n${page.markdown}\n</page>`
			)
			.join("\n\n");

		// 3. Prompt Gemini
		const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
		if (!apiKey) {
			throw new Error("API Key missing");
		}

		const prompt = `You are an expert legal document indexer.
Analyze the following document content (provided page-by-page) and generate a hierarchical Table of Contents (TOC).

Instructions:
1. Identify the main structure (BAB, BAGIAN, PARAGRAF, PASAL).
2. Ignore minor text or content paragraphs. Focus on structural headers.
3. If it's a regulation, "Pasal" (Articles) are very important.
4. Output a JSON array. Each item should have:
   - label: string (e.g., "BAB I: KETENTUAN UMUM" or "Pasal 1")
   - level: number (1 for BAB, 2 for Bagian/Pasal, 3 for Ayat/Subsections)
   - targetPage: number (the page number where this header appears)

Structure the JSON strictly like this:
[
  { "label": "BAB I: PENDAHULUAN", "level": 1, "targetPage": 1 },
  { "label": "Pasal 1", "level": 2, "targetPage": 1 }
]

Return ONLY valid JSON. No markdown code blocks.`;

		try {
			const response = await fetch(
				"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent",
				{
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						"x-goog-api-key": apiKey,
					},
					body: JSON.stringify({
						contents: [
							{
								parts: [
									{ text: prompt },
									{ text: documentContext.substring(0, 500_000) }, // Safety cap
								],
							},
						],
						generationConfig: {
							responseMimeType: "application/json",
						},
					}),
				}
			);

			if (!response.ok) {
				throw new Error(`Gemini API Error: ${response.statusText}`);
			}

			const data = await response.json();
			const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

			if (!text) {
				throw new Error("No text generated");
			}

			const items = JSON.parse(text);

			console.log(`[Indexer] Generated ${items.length} index items`);

			// 4. Save to DB
			await ctx.runMutation(internal.indexer.saveDocumentIndex, {
				documentId: args.documentId,
				items,
			});
		} catch (error) {
			console.error("[Indexer] Failed to generate index:", error);
		}
	},
});

export const saveDocumentIndex = internalMutation({
	args: {
		documentId: v.id("documents"),
		items: v.array(
			v.object({
				label: v.string(),
				level: v.number(),
				targetPage: v.number(),
			})
		),
	},
	handler: async (ctx, args) => {
		// Clear existing index
		const existing = await ctx.db
			.query("documentIndex")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();

		for (const item of existing) {
			await ctx.db.delete(item._id);
		}

		// Insert new items
		for (const item of args.items) {
			await ctx.db.insert("documentIndex", {
				documentId: args.documentId,
				label: item.label,
				level: item.level,
				targetPage: item.targetPage,
			});
		}
	},
});
