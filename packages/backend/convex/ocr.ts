import { v } from "convex/values";
import { PDFDocument } from "pdf-lib";
import { internal } from "./_generated/api";
import {
	internalAction,
	internalMutation,
	internalQuery,
} from "./_generated/server";

/**
 * Distributed OCR Pipeline for LexiVault
 * Master/Worker architecture for processing large PDFs (100+ pages)
 */

// ============================================================================
// MASTER ACTION: Orchestrates PDF splitting and worker scheduling
// ============================================================================

export const processDocumentMaster = internalAction({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args) => {
		console.log("[OCR Master] Starting master process for:", args.documentId);

		try {
			// Step 1: Mark as processing
			await ctx.runMutation(internal.ocr.updateDocumentStatus, {
				documentId: args.documentId,
				status: "processing",
				processingProgress: 0,
			});

			// Step 2: Get document metadata
			const document = await ctx.runQuery(
				internal.ocr.getDocumentForProcessing,
				{
					documentId: args.documentId,
				}
			);

			if (!document) {
				throw new Error("Document not found");
			}

			console.log("[OCR Master] Processing:", document.title);

			// Step 3: Download PDF from storage
			const fileUrl = await ctx.storage.getUrl(document.storageId);
			if (!fileUrl) {
				throw new Error("File not found in storage");
			}

			const fileResponse = await fetch(fileUrl);
			if (!fileResponse.ok) {
				throw new Error(`Failed to fetch file: ${fileResponse.statusText}`);
			}

			const pdfBytes = await fileResponse.arrayBuffer();
			console.log("[OCR Master] PDF downloaded, size:", pdfBytes.byteLength);

			// Step 4: Load PDF with pdf-lib
			const pdfDoc = await PDFDocument.load(pdfBytes);
			const pageCount = pdfDoc.getPageCount();

			console.log("[OCR Master] PDF has", pageCount, "pages");

			// Step 5: Update totalPageCount if different
			if (document.totalPageCount !== pageCount) {
				await ctx.runMutation(internal.ocr.updateDocumentPageCount, {
					documentId: args.documentId,
					totalPageCount: pageCount,
				});
			}

			// Initialize processedPages counter
			await ctx.runMutation(internal.ocr.initializeProcessedPages, {
				documentId: args.documentId,
			});

			// Step 6: Split PDF into individual pages and create content records
			for (let pageNum = 1; pageNum <= pageCount; pageNum++) {
				// Extract single page
				const singlePageDoc = await PDFDocument.create();
				const [copiedPage] = await singlePageDoc.copyPages(pdfDoc, [
					pageNum - 1,
				]);
				singlePageDoc.addPage(copiedPage);

				const singlePageBytes = await singlePageDoc.save();

				// Upload single-page PDF to storage
				const arrayBuffer = singlePageBytes.buffer.slice(
					singlePageBytes.byteOffset,
					singlePageBytes.byteOffset + singlePageBytes.byteLength
				) as ArrayBuffer;
				const pageStorageId = await ctx.storage.store(
					new Blob([arrayBuffer], { type: "application/pdf" })
				);

				console.log(`[OCR Master] Uploaded page ${pageNum}/${pageCount}`);

				// Create pending documentContent record
				const contentId = await ctx.runMutation(
					internal.ocr.createPageContentRecord,
					{
						documentId: args.documentId,
						pageNumber: pageNum,
						originalPageImageId: pageStorageId,
					}
				);

				// Schedule worker to process this page
				await ctx.scheduler.runAfter(0, internal.ocr.processPageWorker, {
					documentContentId: contentId,
				});
			}

			console.log(`[OCR Master] Scheduled ${pageCount} worker jobs`);
		} catch (error) {
			console.error("[OCR Master] Failed:", error);
			await ctx.runMutation(internal.ocr.updateDocumentStatus, {
				documentId: args.documentId,
				status: "error",
				processingError:
					error instanceof Error ? error.message : "Unknown error",
			});
		}
	},
});

// ============================================================================
// WORKER ACTION: Processes individual pages
// ============================================================================

export const processPageWorker = internalAction({
	args: {
		documentContentId: v.id("documentContent"),
	},
	handler: async (ctx, args) => {
		try {
			// Get page content record
			const pageContent = await ctx.runQuery(internal.ocr.getPageContent, {
				contentId: args.documentContentId,
			});

			if (!pageContent) {
				throw new Error("Page content not found");
			}

			console.log(
				`[OCR Worker] Processing page ${pageContent.pageNumber} for document ${pageContent.documentId}`
			);

			// Mark as processing
			await ctx.runMutation(internal.ocr.updatePageStatus, {
				contentId: args.documentContentId,
				status: "processing",
			});

			// Download single-page PDF
			if (!pageContent.originalPageImageId) {
				throw new Error("Page image not found");
			}

			const pageUrl = await ctx.storage.getUrl(pageContent.originalPageImageId);
			if (!pageUrl) {
				throw new Error("Page URL not found");
			}

			const pageResponse = await fetch(pageUrl);
			const pageBytes = await pageResponse.arrayBuffer();

			// Convert to base64 for Gemini
			const uint8Array = new Uint8Array(pageBytes);
			let binaryString = "";
			for (const byte of uint8Array) {
				binaryString += String.fromCharCode(byte);
			}
			const pageBase64 = btoa(binaryString);

			// OCR with Gemini 3 Flash
			const prompt = `Extract all text from this page of an Indonesian regulatory document.

IMPORTANT INSTRUCTIONS:
1. Format the output as clean Markdown
2. Preserve the document structure:
   - Main headers (BAB, BAGIAN) as ## H2
   - Articles (Pasal) as ### H3
   - Sub-articles (Ayat) as numbered lists
3. Convert any tables to Markdown table format
4. Remove page numbers, headers, and footers
5. Fix any OCR errors based on Indonesian legal context
6. Maintain the original numbering system (e.g., "Pasal 1", "Ayat (1)")

Extract the text now:`;

			const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
			if (!apiKey) {
				throw new Error("GOOGLE_GENERATIVE_AI_API_KEY not set");
			}

			const ocrResponse = await fetch(
				"https://generativelanguage.googleapis.com/v1beta/models/gemini-3-flash-preview:generateContent",
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
									{
										inlineData: {
											mimeType: "application/pdf",
											data: pageBase64,
										},
									},
								],
							},
						],
					}),
				}
			);

			if (!ocrResponse.ok) {
				const errorText = await ocrResponse.text();
				throw new Error(
					`Gemini API error: ${ocrResponse.statusText} - ${errorText}`
				);
			}

			const ocrData = (await ocrResponse.json()) as any;
			const extractedMarkdown =
				ocrData.candidates?.[0]?.content?.parts?.[0]?.text || "";

			if (!extractedMarkdown) {
				throw new Error("No text extracted from page");
			}

			console.log(
				`[OCR Worker] Extracted ${extractedMarkdown.length} chars from page ${pageContent.pageNumber}`
			);

			// Generate embedding
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
							parts: [{ text: extractedMarkdown }],
						},
					}),
				}
			);

			if (!embeddingResponse.ok) {
				throw new Error(`Embedding API error: ${embeddingResponse.statusText}`);
			}

			const embeddingData = (await embeddingResponse.json()) as any;
			const embedding = embeddingData.embedding.values;

			// Update page content with results
			await ctx.runMutation(internal.ocr.updatePageContent, {
				contentId: args.documentContentId,
				markdown: extractedMarkdown,
				embedding,
				status: "completed",
			});

			// Increment processed pages counter
			await ctx.runMutation(internal.ocr.incrementProcessedPages, {
				documentId: pageContent.documentId,
			});

			// Check if document is complete
			const isComplete = await ctx.runQuery(
				internal.ocr.checkDocumentCompletion,
				{
					documentId: pageContent.documentId,
				}
			);

			if (isComplete) {
				console.log(
					`[OCR Worker] Document ${pageContent.documentId} is complete!`
				);
				await ctx.runMutation(internal.ocr.updateDocumentStatus, {
					documentId: pageContent.documentId,
					status: "published",
					processingProgress: 100,
				});

				// Trigger Index Generation (TOC)
				await ctx.scheduler.runAfter(
					0,
					internal.indexer.generateDocumentIndex,
					{
						documentId: pageContent.documentId,
					}
				);
			}

			console.log(`[OCR Worker] Page ${pageContent.pageNumber} complete`);
		} catch (error) {
			console.error("[OCR Worker] Failed:", error);

			// Mark page as error
			await ctx.runMutation(internal.ocr.updatePageStatus, {
				contentId: args.documentContentId,
				status: "error",
			});
		}
	},
});

// ============================================================================
// HELPER MUTATIONS AND QUERIES
// ============================================================================

export const updateDocumentStatus = internalMutation({
	args: {
		documentId: v.id("documents"),
		status: v.union(
			v.literal("processing"),
			v.literal("published"),
			v.literal("error"),
			v.literal("archived")
		),
		processingProgress: v.optional(v.number()),
		processingError: v.optional(v.string()),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.documentId, {
			status: args.status,
			processingProgress: args.processingProgress,
			processingError: args.processingError,
		});
	},
});

export const updateDocumentPageCount = internalMutation({
	args: {
		documentId: v.id("documents"),
		totalPageCount: v.number(),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.documentId, {
			totalPageCount: args.totalPageCount,
		});
	},
});

export const initializeProcessedPages = internalMutation({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.documentId, {
			processedPages: 0,
		});
	},
});

export const createPageContentRecord = internalMutation({
	args: {
		documentId: v.id("documents"),
		pageNumber: v.number(),
		originalPageImageId: v.id("_storage"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.insert("documentContent", {
			documentId: args.documentId,
			pageNumber: args.pageNumber,
			markdown: "", // Will be filled by worker
			embedding: new Array(768).fill(0), // Will be filled by worker
			originalPageImageId: args.originalPageImageId,
			status: "pending",
		});
	},
});

export const updatePageStatus = internalMutation({
	args: {
		contentId: v.id("documentContent"),
		status: v.union(
			v.literal("pending"),
			v.literal("processing"),
			v.literal("completed"),
			v.literal("error")
		),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.contentId, {
			status: args.status,
		});
	},
});

export const updatePageContent = internalMutation({
	args: {
		contentId: v.id("documentContent"),
		markdown: v.string(),
		embedding: v.array(v.float64()),
		status: v.union(
			v.literal("pending"),
			v.literal("processing"),
			v.literal("completed"),
			v.literal("error")
		),
	},
	handler: async (ctx, args) => {
		await ctx.db.patch(args.contentId, {
			markdown: args.markdown,
			embedding: args.embedding,
			status: args.status,
		});
	},
});

export const incrementProcessedPages = internalMutation({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args) => {
		const doc = await ctx.db.get(args.documentId);
		if (doc) {
			const currentProcessed = doc.processedPages || 0;
			await ctx.db.patch(args.documentId, {
				processedPages: currentProcessed + 1,
				processingProgress: Math.round(
					((currentProcessed + 1) / doc.totalPageCount) * 100
				),
			});
		}
	},
});

export const checkDocumentCompletion = internalQuery({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args) => {
		const doc = await ctx.db.get(args.documentId);
		if (!doc) {
			return false;
		}

		return (doc.processedPages || 0) >= doc.totalPageCount;
	},
});

export const getDocumentForProcessing = internalQuery({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.documentId);
	},
});

export const getPageContent = internalQuery({
	args: {
		contentId: v.id("documentContent"),
	},
	handler: async (ctx, args) => {
		return await ctx.db.get(args.contentId);
	},
});

// Keep old processDocument for backward compatibility (deprecated)
export const processDocument = internalAction({
	args: {
		documentId: v.id("documents"),
	},
	handler: async (ctx, args) => {
		console.log("[OCR] Redirecting to new master/worker architecture");
		await ctx.runAction(internal.ocr.processDocumentMaster, args);
	},
});
