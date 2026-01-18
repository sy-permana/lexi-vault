import { convexQuery } from "@convex-dev/react-query";
import { api } from "@lexivault/backend/convex/_generated/api";
import type { Doc, Id } from "@lexivault/backend/convex/_generated/dataModel";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import {
	ArrowLeft,
	ChevronLeft,
	ChevronRight,
	Eye,
	EyeOff,
	FileText,
} from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { DocumentSidebar } from "@/components/document-sidebar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

export const Route = createFileRoute("/reader/$documentId")({
	component: DocumentReaderComponent,
	validateSearch: (search: Record<string, unknown>) => {
		return {
			page: Number(search.page) || 1,
		};
	},
});

function DocumentReaderComponent() {
	const { documentId } = Route.useParams();
	const { page } = Route.useSearch();
	const navigate = useNavigate();
	const [showSplitView, setShowSplitView] = useState(false);

	const document = useQuery(
		convexQuery(api.documents.getDocument, {
			id: documentId as Id<"documents">,
		})
	);

	const content = useQuery(
		convexQuery(api.documents.getDocumentContent, {
			documentId: documentId as Id<"documents">,
			pageNumber: page,
		})
	);

	const pageData = (content.data as any)?.[0] as
		| Doc<"documentContent">
		| undefined;

	// Only show full-page loader on initial document load, not on page changes
	if (document.isLoading) {
		return (
			<div className="container mx-auto max-w-7xl px-4 py-8">
				<div className="animate-pulse space-y-4">
					<div className="h-8 w-64 rounded bg-muted" />
					<div className="h-4 w-48 rounded bg-muted" />
					<div className="mt-8 space-y-2">
						<div className="h-4 rounded bg-muted" />
						<div className="h-4 rounded bg-muted" />
						<div className="h-4 w-3/4 rounded bg-muted" />
					</div>
				</div>
			</div>
		);
	}

	if (!document.data) {
		return (
			<div className="container mx-auto max-w-4xl px-4 py-8">
				<Card className="p-8 text-center">
					<FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
					<h2 className="mb-2 font-semibold text-xl">Document not found</h2>
					<p className="mb-4 text-muted-foreground">
						The document you're looking for doesn't exist.
					</p>
					<Link to="/documents">
						<Button>
							<ArrowLeft className="mr-2 h-4 w-4" />
							Back to Documents
						</Button>
					</Link>
				</Card>
			</div>
		);
	}

	const doc = document.data as Doc<"documents">;
	const isProcessing = doc.status === "processing";
	const processedPages = doc.processedPages || 0;
	const totalPages = doc.totalPageCount;
	const progress = totalPages > 0 ? (processedPages / totalPages) * 100 : 0;

	const goToPage = (newPage: number) => {
		navigate({
			to: "/reader/$documentId",
			params: { documentId },
			search: { page: newPage },
		});
	};

	return (
		<div className="flex h-screen">
			{/* Document Navigation Sidebar */}
			<aside className="fixed top-0 left-64 z-40 h-screen w-64">
				<DocumentSidebar
					currentPage={page}
					documentId={documentId as Id<"documents">}
					onPageChange={goToPage}
					totalPages={totalPages}
				/>
			</aside>

			{/* Main Content */}
			<main className="ml-64 flex-1 overflow-y-auto">
				<div className="container mx-auto max-w-5xl px-4 py-8">
					{/* Header */}
					<div className="mb-6">
						<Link to="/documents">
							<Button className="mb-4" size="sm" variant="ghost">
								<ArrowLeft className="mr-2 h-4 w-4" />
								Back to Documents
							</Button>
						</Link>
						<div className="flex items-start justify-between">
							<div className="flex-1">
								<h1 className="mb-2 font-bold text-3xl">{doc.title}</h1>
								<div className="flex items-center gap-2 text-muted-foreground">
									<span>{doc.category}</span>
									<span>•</span>
									<span>{doc.year}</span>
									<span>•</span>
									<span>{totalPages} pages</span>
									{doc.isPremium && (
										<>
											<span>•</span>
											<span className="font-medium text-amber-500">
												Premium
											</span>
										</>
									)}
								</div>
								{doc.description && (
									<p className="mt-2 text-muted-foreground">
										{doc.description}
									</p>
								)}
							</div>

							{!isProcessing && pageData?.originalPageImageId && (
								<Button
									className="ml-4"
									onClick={() => setShowSplitView(!showSplitView)}
									variant="outline"
								>
									{showSplitView ? (
										<>
											<EyeOff className="mr-2 h-4 w-4" />
											Hide Original
										</>
									) : (
										<>
											<Eye className="mr-2 h-4 w-4" />
											Show Original
										</>
									)}
								</Button>
							)}
						</div>
					</div>

					{/* Processing Progress */}
					{isProcessing && (
						<Card className="mb-6 p-6">
							<div className="space-y-2">
								<div className="flex items-center justify-between text-sm">
									<span className="font-medium">Processing document...</span>
									<span className="text-muted-foreground">
										{processedPages} / {totalPages} pages (
										{Math.round(progress)}%)
									</span>
								</div>
								<Progress className="h-2" value={progress} />
								<p className="text-muted-foreground text-xs">
									Pages are being processed in parallel. Check back soon!
								</p>
							</div>
						</Card>
					)}

					{/* Page Navigation */}
					{!isProcessing && totalPages > 1 && (
						<div className="mb-4 flex items-center justify-between">
							<Button
								disabled={page <= 1}
								onClick={() => goToPage(page - 1)}
								size="sm"
								variant="outline"
							>
								<ChevronLeft className="mr-1 h-4 w-4" />
								Previous
							</Button>
							<span className="text-muted-foreground text-sm">
								Page {page} of {totalPages}
							</span>
							<Button
								disabled={page >= totalPages}
								onClick={() => goToPage(page + 1)}
								size="sm"
								variant="outline"
							>
								Next
								<ChevronRight className="ml-1 h-4 w-4" />
							</Button>
						</div>
					)}

					{/* Content - Split View or Single View */}
					{content.isLoading ? (
						// Show skeleton only in content area during page transitions
						<Card className="glass-card border-0 p-6">
							<div className="animate-pulse space-y-4">
								<div className="h-6 w-3/4 rounded bg-muted/50" />
								<div className="space-y-2">
									<div className="h-4 rounded bg-muted/50" />
									<div className="h-4 rounded bg-muted/50" />
									<div className="h-4 w-5/6 rounded bg-muted/50" />
									<div className="h-4 rounded bg-muted/50" />
									<div className="h-4 w-4/5 rounded bg-muted/50" />
								</div>
							</div>
						</Card>
					) : showSplitView && pageData?.originalPageImageId ? (
						<div className="grid grid-cols-2 gap-4">
							{/* Original Scan */}
							<Card className="p-4">
								<h3 className="mb-3 font-semibold text-muted-foreground text-sm">
									Original Scan
								</h3>
								<PageImage storageId={pageData.originalPageImageId} />
							</Card>

							{/* AI Text */}
							<Card className="p-6">
								<h3 className="mb-3 font-semibold text-muted-foreground text-sm">
									Extracted Text
								</h3>
								{pageData.markdown ? (
									<div className="prose prose-sm dark:prose-invert max-w-none">
										<ReactMarkdown>{pageData.markdown}</ReactMarkdown>
									</div>
								) : (
									<div className="py-12 text-center">
										<FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
										<p className="text-muted-foreground">
											No content extracted yet
										</p>
									</div>
								)}
							</Card>
						</div>
					) : (
						<Card className="glass-card border-0 p-6">
							{pageData?.markdown ? (
								<div className="prose prose-sm dark:prose-invert max-w-none">
									{pageData.title && (
										<h2 className="mb-4 font-semibold text-xl">
											{pageData.title}
										</h2>
									)}
									<ReactMarkdown>{pageData.markdown}</ReactMarkdown>
								</div>
							) : (
								<div className="py-12 text-center">
									<FileText className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
									<p className="text-muted-foreground">
										{isProcessing
											? "Document is still being processed..."
											: "No content available for this page."}
									</p>
								</div>
							)}
						</Card>
					)}
				</div>
			</main>
		</div>
	);
}

// Sub-component to display page image
function PageImage({ storageId }: { storageId: Id<"_storage"> }) {
	const imageUrl = useQuery(
		convexQuery(api.documents.getPageImage, { storageId })
	);

	if (imageUrl.isLoading) {
		return <div className="h-[600px] animate-pulse rounded bg-muted" />;
	}

	if (!imageUrl.data) {
		return (
			<div className="flex h-[600px] items-center justify-center rounded bg-muted">
				<p className="text-muted-foreground">Image not available</p>
			</div>
		);
	}

	return (
		<div className="overflow-hidden rounded border">
			<embed
				className="h-[600px] w-full"
				src={imageUrl.data as string}
				type="application/pdf"
			/>
		</div>
	);
}
