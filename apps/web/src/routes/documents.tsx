import { convexQuery } from "@convex-dev/react-query";
import { api } from "@lexivault/backend/convex/_generated/api";
import type { Doc } from "@lexivault/backend/convex/_generated/dataModel";
import { useQuery } from "@tanstack/react-query";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
	AlertCircle,
	Archive,
	CheckCircle,
	Clock,
	FileText,
	Plus,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export const Route = createFileRoute("/documents")({
	component: DocumentsComponent,
});

const STATUS_CONFIG = {
	processing: {
		icon: Clock,
		label: "Processing",
		gradient: "from-yellow-400 to-orange-500",
	},
	published: {
		icon: CheckCircle,
		label: "Published",
		gradient: "from-green-400 to-emerald-500",
	},
	error: {
		icon: AlertCircle,
		label: "Error",
		gradient: "from-red-400 to-rose-500",
	},
	archived: {
		icon: Archive,
		label: "Archived",
		gradient: "from-gray-400 to-gray-500",
	},
} as const;

function DocumentsComponent() {
	const documents = useQuery(convexQuery(api.documents.listDocuments, {}));
	const docs = documents.data as Doc<"documents">[] | undefined;

	return (
		<div className="container mx-auto max-w-7xl px-6 py-12">
			<div className="mb-10 flex items-center justify-between">
				<div>
					<h1 className="mb-2 font-bold text-4xl">Documents</h1>
					<p className="text-lg text-muted-foreground">
						Manage your digitized regulatory documents
					</p>
				</div>
				<Link to="/upload">
					<Button className="h-auto rounded-full bg-gradient-to-r from-primary to-accent px-6 py-3 transition-all hover:shadow-lg">
						<Plus className="mr-2 h-5 w-5" />
						Upload Document
					</Button>
				</Link>
			</div>

			{documents.isLoading ? (
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
			) : docs?.length === 0 ? (
				<Card className="glass-card border-0 p-16 text-center">
					<FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground" />
					<h3 className="mb-2 font-bold text-2xl">No documents yet</h3>
					<p className="mb-6 text-lg text-muted-foreground">
						Upload your first regulatory document to get started
					</p>
					<Link to="/upload">
						<Button className="h-auto rounded-full bg-gradient-to-r from-primary to-accent px-8 py-4">
							<Plus className="mr-2 h-5 w-5" />
							Upload Document
						</Button>
					</Link>
				</Card>
			) : (
				<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
					{docs?.map((doc: Doc<"documents">) => {
						const status = doc.status as keyof typeof STATUS_CONFIG;
						const statusConfig =
							STATUS_CONFIG[status] || STATUS_CONFIG.processing;
						const StatusIcon = statusConfig.icon;

						return (
							<Link
								key={doc._id}
								params={{ documentId: doc._id }}
								search={{ page: 1 }}
								to="/reader/$documentId"
							>
								<Card className="glass-card group relative flex h-full cursor-pointer flex-col border-0 p-6 transition-all hover:scale-[1.02]">
									{/* Status Badge */}
									<div className="absolute top-4 right-4 z-10">
										<div
											className={`flex items-center gap-1.5 rounded-full bg-gradient-to-r px-3 py-1.5 ${statusConfig.gradient} font-medium text-white text-xs shadow-sm`}
										>
											<StatusIcon className="h-3.5 w-3.5" />
											{statusConfig.label}
										</div>
									</div>

									{/* Category Badge */}
									<div className="mb-4">
										<span className="inline-block rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-medium text-primary text-xs">
											{doc.category}
										</span>
									</div>

									{/* Document Title */}
									<h3 className="mb-3 line-clamp-2 font-bold text-foreground text-lg transition-colors group-hover:text-primary">
										{doc.title}
									</h3>

									{/* Description */}
									{doc.description && (
										<p className="mb-4 line-clamp-2 flex-1 text-muted-foreground text-sm leading-relaxed">
											{doc.description}
										</p>
									)}

									{/* Premium Badge */}
									{doc.isPremium && (
										<div className="mb-4">
											<span className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-amber-400 to-orange-500 px-3 py-1 font-medium text-white text-xs">
												Premium
											</span>
										</div>
									)}

									{/* Processing Progress */}
									{doc.status === "processing" &&
										doc.processedPages !== undefined &&
										doc.totalPageCount && (
											<div className="mb-4">
												<div className="h-2 w-full overflow-hidden rounded-full bg-muted/30">
													<div
														className="h-full rounded-full bg-gradient-to-r from-primary to-accent shadow-sm transition-all"
														style={{
															width: `${(doc.processedPages / doc.totalPageCount) * 100}%`,
														}}
													/>
												</div>
												<p className="mt-2 text-muted-foreground text-xs">
													{doc.processedPages} / {doc.totalPageCount} pages (
													{Math.round(
														(doc.processedPages / doc.totalPageCount) * 100
													)}
													%)
												</p>
											</div>
										)}

									{/* Error Message */}
									{doc.status === "error" && doc.processingError && (
										<div className="mb-4 rounded-xl border border-red-200/50 bg-red-50/50 p-3 backdrop-blur-sm">
											<p className="text-red-600 text-sm">
												{doc.processingError}
											</p>
										</div>
									)}

									{/* Metadata Footer */}
									<div className="flex items-center justify-between border-white/10 border-t pt-4 text-muted-foreground text-xs">
										<span className="font-medium">{doc.year}</span>
										<div className="flex items-center gap-1 rounded bg-white/10 px-2 py-1">
											<FileText className="h-3 w-3" />
											<span>{doc.totalPageCount} pages</span>
										</div>
									</div>
								</Card>
							</Link>
						);
					})}
				</div>
			)}
		</div>
	);
}
