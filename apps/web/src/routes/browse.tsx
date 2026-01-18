import { convexQuery } from "@convex-dev/react-query";
import { api } from "@lexivault/backend/convex/_generated/api";
import type { Doc } from "@lexivault/backend/convex/_generated/dataModel";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import { FileText, Lock } from "lucide-react";
import { useState } from "react";

import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/browse")({
	component: BrowseComponent,
});

const CATEGORIES = [
	"All",
	"Banking",
	"Tax",
	"Corporate",
	"Insurance",
	"Securities",
	"Other",
] as const;

function BrowseComponent() {
	const [selectedCategory, setSelectedCategory] = useState<string>("All");

	// Fetch all published documents
	const allDocuments = useQuery(
		convexQuery(api.documents.listDocuments, { status: "published" })
	);

	// Filter by category
	const docs = allDocuments.data as Doc<"documents">[] | undefined;
	const filteredDocuments = docs?.filter(
		(doc: Doc<"documents">) =>
			selectedCategory === "All" || doc.category === selectedCategory
	);

	return (
		<div className="container mx-auto max-w-7xl px-6 py-12">
			{/* Header */}
			<div className="mb-10">
				<h1 className="mb-2 font-bold text-4xl">Browse Library</h1>
				<p className="text-lg text-muted-foreground">
					Explore all available legal documents
				</p>
			</div>

			{/* Category Filters */}
			<div className="mb-8 flex flex-wrap gap-2">
				{CATEGORIES.map((category) => (
					<button
						className={`rounded-full px-4 py-2 font-medium text-sm transition-all ${
							selectedCategory === category
								? "bg-primary text-primary-foreground shadow-sm"
								: "bg-white/60 backdrop-blur-sm hover:bg-white/80"
						}`}
						key={category}
						onClick={() => setSelectedCategory(category)}
						type="button"
					>
						{category}
					</button>
				))}
			</div>

			{/* Document Count */}
			{filteredDocuments && (
				<p className="mb-6 text-muted-foreground text-sm">
					{filteredDocuments.length} document
					{filteredDocuments.length !== 1 ? "s" : ""}
				</p>
			)}

			{/* Loading State */}
			{allDocuments.isLoading && (
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					{Array.from({ length: 6 }).map((_, i) => (
						<Card
							className="glass-card animate-pulse p-6"
							key={`skeleton-${i}`}
						>
							<div className="mb-4 h-4 w-20 rounded bg-muted" />
							<div className="mb-3 h-6 w-full rounded bg-muted" />
							<div className="mb-4 h-4 w-3/4 rounded bg-muted" />
							<div className="h-4 w-1/2 rounded bg-muted" />
						</Card>
					))}
				</div>
			)}

			{/* Empty State */}
			{!allDocuments.isLoading && filteredDocuments?.length === 0 && (
				<div className="py-20 text-center">
					<FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
					<h3 className="mb-2 font-semibold text-xl">No documents found</h3>
					<p className="text-muted-foreground">
						{selectedCategory === "All"
							? "No documents have been published yet"
							: `No ${selectedCategory} documents available`}
					</p>
				</div>
			)}

			{/* Document Grid */}
			{!allDocuments.isLoading &&
				filteredDocuments &&
				filteredDocuments.length > 0 && (
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{filteredDocuments.map((doc: Doc<"documents">) => (
							<Link
								key={doc._id}
								params={{ documentId: doc._id }}
								search={{ page: 1 }}
								to="/reader/$documentId"
							>
								<Card className="glass-card group relative flex h-full cursor-pointer flex-col border-0 p-6">
									{/* Premium Lock Overlay */}
									{doc.isPremium && (
										<div className="absolute top-4 right-4 z-10">
											<div className="flex items-center gap-1 rounded-full bg-amber-100/80 px-2 py-1 font-medium text-amber-700 text-xs shadow-sm backdrop-blur-sm">
												<Lock className="h-3 w-3" />
												<span className="text-black">Premium</span>
											</div>
										</div>
									)}

									{/* Category Badge */}
									<div className="mb-4">
										<span className="inline-block rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-medium text-primary text-xs">
											{doc.category}
										</span>
									</div>

									{/* Document Title */}
									<h3 className="mb-3 line-clamp-2 font-bold text-gray-200 text-lg transition-colors group-hover:text-primary">
										{doc.title}
									</h3>

									{/* Description */}
									{doc.description && (
										<p className="mb-4 line-clamp-2 flex-1 text-muted-foreground text-sm leading-relaxed">
											{doc.description}
										</p>
									)}

									{/* Metadata Footer */}
									<div className="flex items-center justify-between border-gray-100/50 border-t pt-4 text-muted-foreground text-xs">
										<span className="font-medium">{doc.year}</span>
										<div className="flex items-center gap-1 rounded bg-white/50 px-2 py-1">
											<FileText className="h-3 w-3" />
											<span>{doc.totalPageCount} pages</span>
										</div>
									</div>
								</Card>
							</Link>
						))}
					</div>
				)}
		</div>
	);
}
