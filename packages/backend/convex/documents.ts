import { v } from "convex/values";
import { internal } from "./_generated/api";
import { mutation, query } from "./_generated/server";

/**
 * Document management functions for LexiVault
 */

// Generate a signed URL for uploading PDF files
export const generateUploadUrl = mutation({
	args: {},
	handler: async (ctx) => {
		return await ctx.storage.generateUploadUrl();
	},
});

// Create a new document record after file upload
export const createDocument = mutation({
	args: {
		title: v.string(),
		description: v.optional(v.string()),
		category: v.string(),
		year: v.number(),
		storageId: v.id("_storage"),
		totalPageCount: v.number(),
		isPremium: v.boolean(),
		price: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		const documentId = await ctx.db.insert("documents", {
			title: args.title,
			description: args.description,
			category: args.category,
			year: args.year,
			storageId: args.storageId,
			totalPageCount: args.totalPageCount,
			isPremium: args.isPremium,
			price: args.price,
			status: "processing",
			processingProgress: 0,
		});

		// Trigger distributed OCR processing
		await ctx.scheduler.runAfter(0, internal.ocr.processDocumentMaster, {
			documentId,
		});

		return documentId;
	},
});

// List all documents with optional status filter
export const listDocuments = query({
	args: {
		status: v.optional(
			v.union(
				v.literal("processing"),
				v.literal("published"),
				v.literal("error"),
				v.literal("archived")
			)
		),
	},
	handler: async (ctx, args) => {
		if (args.status !== undefined) {
			return await ctx.db
				.query("documents")
				.withIndex("by_status", (q) =>
					q.eq(
						"status",
						args.status as "processing" | "published" | "error" | "archived"
					)
				)
				.collect();
		}
		return await ctx.db.query("documents").collect();
	},
});

// Get a single document by ID
export const getDocument = query({
	args: { id: v.id("documents") },
	handler: async (ctx, args) => {
		return await ctx.db.get(args.id);
	},
});

// Get the file URL for a document's PDF
export const getDocumentFileUrl = query({
	args: { storageId: v.id("_storage") },
	handler: async (ctx, args) => {
		return await ctx.storage.getUrl(args.storageId);
	},
});

// Get document content (markdown) for reader
// Supports single-page or all-pages fetching
export const getDocumentContent = query({
	args: {
		documentId: v.id("documents"),
		pageNumber: v.optional(v.number()),
	},
	handler: async (ctx, args) => {
		let query = ctx.db
			.query("documentContent")
			.withIndex("by_document_page", (q) =>
				q.eq("documentId", args.documentId)
			);

		// If specific page requested
		if (args.pageNumber !== undefined) {
			query = query.filter((q) => q.eq(q.field("pageNumber"), args.pageNumber));
		}

		const content = await query.order("asc").collect();
		return content;
	},
});

// Get all document content for sidebar navigation
export const getAllDocumentContent = query({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args) => {
		const content = await ctx.db
			.query("documentContent")
			.withIndex("by_document_page", (q) => q.eq("documentId", args.documentId))
			.order("asc")
			.collect();

		// Return lightweight data for sidebar (just title and page number)
		return content.map((page) => ({
			pageNumber: page.pageNumber,
			title: page.title,
			markdown: page.markdown?.substring(0, 200), // First 200 chars for search
		}));
	},
});

// Get page image URL for split-view verification
export const getPageImage = query({
	args: { storageId: v.id("_storage") },
	handler: async (ctx, args) => {
		return await ctx.storage.getUrl(args.storageId);
	},
});

// Get first page thumbnail for a document
export const getDocumentThumbnail = query({
	args: { documentId: v.id("documents") },
	handler: async (ctx, args) => {
		// Get the first page of the document
		const firstPage = await ctx.db
			.query("documentContent")
			.withIndex("by_document_page", (q) =>
				q.eq("documentId", args.documentId).eq("pageNumber", 1)
			)
			.first();

		if (!firstPage?.originalPageImageId) {
			return null;
		}

		return await ctx.storage.getUrl(firstPage.originalPageImageId);
	},
});

export const getDocumentIndex = query({
	args: { documentId: v.id("documents") },
	handler: async (ctx, args) => {
		return await ctx.db
			.query("documentIndex")
			.withIndex("by_document", (q) => q.eq("documentId", args.documentId))
			.collect();
	},
});
