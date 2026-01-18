import { internalMutation } from "./_generated/server";

/**
 * Migration: Add status field to existing documentContent records
 * Run this once to migrate existing data to the new schema
 */
export const migrateDocumentContentStatus = internalMutation({
	args: {},
	handler: async (ctx) => {
		console.log("[Migration] Starting documentContent status migration...");

		const allContent = await ctx.db.query("documentContent").collect();

		let migratedCount = 0;
		for (const content of allContent) {
			if (!content.status) {
				await ctx.db.patch(content._id, {
					status: "completed" as const,
				});
				migratedCount++;
			}
		}

		console.log(
			`[Migration] Migrated ${migratedCount} documentContent records`
		);
		return { migratedCount, totalRecords: allContent.length };
	},
});

/**
 * Migration: Initialize processedPages for existing documents
 */
export const migrateDocumentsProcessedPages = internalMutation({
	args: {},
	handler: async (ctx) => {
		console.log("[Migration] Starting documents processedPages migration...");

		const allDocs = await ctx.db.query("documents").collect();

		let migratedCount = 0;
		for (const doc of allDocs) {
			if (doc.processedPages === undefined) {
				// Count completed pages for this document
				const completedPages = await ctx.db
					.query("documentContent")
					.withIndex("by_document_page", (q) => q.eq("documentId", doc._id))
					.collect();

				await ctx.db.patch(doc._id, {
					processedPages: completedPages.length,
				});
				migratedCount++;
			}
		}

		console.log(`[Migration] Migrated ${migratedCount} documents records`);
		return { migratedCount, totalRecords: allDocs.length };
	},
});
