import { v } from "convex/values";
import { api } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { action, query } from "./_generated/server";

interface SearchResult {
	documentId: Id<"documents">;
	documentTitle: string;
	category: string;
	year: number;
	pageNumber: number;
	snippet: string;
	score: number;
}

/**
 * Hybrid Search for LexiVault
 * Combines semantic vector search with full-text search
 */

// Helper query to get content by ID
export const getContentById = query({
	args: {
		contentId: v.id("documentContent"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.contentId);
	},
});

// Semantic search using vector embeddings
export const semanticSearch = action({
	args: {
		query: v.string(),
		limit: v.optional(v.number()),
		caseSensitive: v.optional(v.boolean()),
		wholeWord: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		const limit = args.limit || 10;

		// Generate embedding for the search query
		const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
		if (!apiKey) {
			throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not set");
		}

		const embeddingResponse = await fetch(
			"https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent",
			{
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					"x-goog-api-key": apiKey,
				},
				body: JSON.stringify({
					content: {
						parts: [{ text: args.query }],
					},
				}),
			}
		);

		if (!embeddingResponse.ok) {
			throw new Error(`Embedding API error: ${embeddingResponse.statusText}`);
		}

		const embeddingData = (await embeddingResponse.json()) as any;
		const queryEmbedding = embeddingData.embedding.values;

		// Search using vector index
		const results = await ctx.vectorSearch("documentContent", "by_embedding", {
			vector: queryEmbedding,
			limit,
		});

		// Fetch document metadata for each result
		const enrichedResults = await Promise.all(
			results.map(async (result): Promise<SearchResult | null> => {
				const content = await ctx.runQuery(api.search.getContentById, {
					contentId: result._id,
				});

				if (!content) {
					return null;
				}

				const document = await ctx.runQuery(api.documents.getDocument, {
					id: content.documentId,
				});

				if (!document) {
					return null;
				}

				// Create snippet from markdown (first 200 chars)
				const snippet = `${content.markdown.substring(0, 200).trim()}...`;

				// Apply filters if needed
				const queryText = args.query;
				const markdown = content.markdown;

				// Check case sensitivity
				if (args.caseSensitive) {
					if (!markdown.includes(queryText)) {
						return null;
					}
				} else if (!markdown.toLowerCase().includes(queryText.toLowerCase())) {
					return null;
				}

				// Check whole word match
				if (args.wholeWord) {
					const regex = new RegExp(
						`\\b${queryText}\\b`,
						args.caseSensitive ? "" : "i"
					);
					if (!regex.test(markdown)) {
						return null;
					}
				}

				return {
					documentId: content.documentId,
					documentTitle: document.title,
					category: document.category,
					year: document.year,
					pageNumber: content.pageNumber,
					snippet,
					score: result._score,
				};
			})
		);

		return enrichedResults.filter((r) => r !== null);
	},
});

// Full-text search on document titles
export const fullTextSearch = query({
	args: {
		query: v.string(),
	},
	handler: async (ctx, args) => {
		const results = await ctx.db
			.query("documents")
			.withSearchIndex("search_title", (q) => q.search("title", args.query))
			.take(10);

		return results.map((doc) => ({
			documentId: doc._id,
			documentTitle: doc.title,
			category: doc.category,
			year: doc.year,
			pageNumber: 1, // Default to first page for title matches
			snippet: doc.description || "",
			score: 1.0, // Full-text matches get high score
		}));
	},
});

// Hybrid search combining both approaches
export const hybridSearch = action({
	args: {
		query: v.string(),
		caseSensitive: v.optional(v.boolean()),
		wholeWord: v.optional(v.boolean()),
	},
	handler: async (ctx, args) => {
		if (!args.query.trim()) {
			return [];
		}

		// Run both searches in parallel
		const [semanticResults, fullTextResults] = await Promise.all([
			ctx.runAction(api.search.semanticSearch, {
				query: args.query,
				limit: 5,
				caseSensitive: args.caseSensitive,
				wholeWord: args.wholeWord,
			}),
			ctx.runQuery(api.search.fullTextSearch, { query: args.query }),
		]);

		// Merge and deduplicate results
		const resultMap = new Map();

		// Add semantic results (higher weight)
		for (const result of semanticResults) {
			const key = `${result.documentId}-${result.pageNumber}`;
			resultMap.set(key, {
				...result,
				score: result.score * 1.5, // Boost semantic matches
			});
		}

		// Add full-text results
		for (const result of fullTextResults) {
			const key = `${result.documentId}-${result.pageNumber}`;
			if (resultMap.has(key)) {
				// Boost score if found in both
				const existing = resultMap.get(key);
				if (existing) {
					existing.score += result.score;
				}
			} else {
				resultMap.set(key, result);
			}
		}

		// Sort by score and return
		return Array.from(resultMap.values())
			.sort((a, b) => b.score - a.score)
			.slice(0, 10);
	},
});
