import { convexQuery } from "@convex-dev/react-query";
import { api } from "@lexivault/backend/convex/_generated/api";
import type { Id } from "@lexivault/backend/convex/_generated/dataModel";
import { useQuery } from "@tanstack/react-query";
import { ChevronRight, FileText, Search } from "lucide-react";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";

interface IndexItem {
	_id: string;
	label: string;
	level: number;
	targetPage: number;
	children: IndexItem[];
}

interface DocumentSidebarProps {
	documentId: Id<"documents">;
	currentPage: number;
	totalPages: number;
	onPageChange: (page: number) => void;
}

export function DocumentSidebar({
	documentId,
	currentPage,
	totalPages,
	onPageChange,
}: DocumentSidebarProps) {
	const [searchQuery, setSearchQuery] = useState("");

	// Fetch all page titles/content for the document
	const allContent = useQuery(
		convexQuery(api.documents.getAllDocumentContent, { documentId })
	);

	// Fetch document index (TOC)
	const documentIndexQuery = useQuery(
		convexQuery(
			(api.documents as unknown as { getDocumentIndex: any }).getDocumentIndex,
			{ documentId }
		)
	);

	const documentIndex =
		(documentIndexQuery.data as unknown as {
			_id: string;
			label: string;
			level: number;
			targetPage: number;
		}[]) || [];

	// Filter pages based on search
	interface PageData {
		pageNumber: number;
		title?: string;
		markdown?: string;
	}
	const pages = (allContent.data as unknown as PageData[]) || [];
	const filteredPages = searchQuery
		? pages.filter(
				(page: PageData) =>
					page.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
					page.markdown?.toLowerCase().includes(searchQuery.toLowerCase())
			)
		: pages;

	// Generate page list (1 to totalPages)
	const pageNumbers = Array.from({ length: totalPages }, (_, i) => i + 1);

	// Build Tree from Index
	const buildTree = (
		items: { _id: string; label: string; level: number; targetPage: number }[]
	): IndexItem[] => {
		const root: IndexItem[] = [];
		const stack: IndexItem[] = [];

		for (const item of items) {
			const node: IndexItem = { ...item, children: [] };

			// Pop stack until we find the parent (level < node.level)
			while (stack.length > 0) {
				const top = stack.at(-1);
				if (top && top.level < node.level) {
					break;
				}
				stack.pop();
			}

			// Add to parent or root
			const parent = stack.at(-1);
			if (parent) {
				parent.children.push(node);
			} else {
				root.push(node);
			}
			stack.push(node);
		}

		return root;
	};

	const tocTree = buildTree(documentIndex);

	return (
		<div className="flex h-full flex-col border-white/10 border-r bg-black/20 backdrop-blur-xl">
			{/* Header */}
			<div className="border-white/10 border-b p-4">
				<h3 className="mb-3 font-semibold text-foreground text-sm">
					Document Index
				</h3>
				{/* Search Input */}
				<div className="relative">
					<Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						className="h-9 border-white/10 bg-white/5 pl-9 text-sm placeholder:text-muted-foreground"
						onChange={(e) => setSearchQuery(e.target.value)}
						placeholder="Search in document..."
						type="text"
						value={searchQuery}
					/>
				</div>
			</div>

			{/* Content List */}
			<ScrollArea className="flex-1 overflow-y-auto">
				<div className="p-2">
					{/* Show TOC if available and NOT searching */}
					{!searchQuery && tocTree.length > 0 ? (
						<div className="space-y-1">
							{tocTree.map((item) => (
								<RecursiveTOCItem
									currentPage={currentPage}
									item={item}
									key={item._id}
									onPageChange={onPageChange}
								/>
							))}
						</div>
					) : (
						/* Fallback / Search Results */
						<>
							<p className="mb-2 px-2 font-medium text-muted-foreground text-xs uppercase tracking-wider">
								{searchQuery ? "Search Results" : `Pages (${totalPages})`}
							</p>

							{searchQuery && filteredPages.length === 0 ? (
								<div className="px-2 py-8 text-center">
									<FileText className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
									<p className="text-muted-foreground text-sm">
										No matches found
									</p>
								</div>
							) : (
								<div className="space-y-1">
									{(searchQuery ? filteredPages : pageNumbers).map(
										(
											item:
												| number
												| {
														pageNumber: number;
														title?: string;
														markdown?: string;
												  }
										) => {
											const pageNum =
												typeof item === "number" ? item : item.pageNumber;
											const pageData =
												typeof item === "number"
													? pages.find(
															(p: {
																pageNumber: number;
																title?: string;
																markdown?: string;
															}) => p.pageNumber === item
														)
													: item;
											const isActive = pageNum === currentPage;

											return (
												<button
													className={`flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm transition-all ${
														isActive
															? "bg-primary/20 text-primary ring-1 ring-primary/30"
															: "text-muted-foreground hover:bg-white/5 hover:text-foreground"
													}`}
													key={pageNum}
													onClick={() => onPageChange(pageNum)}
													type="button"
												>
													<span
														className={`flex h-6 w-6 shrink-0 items-center justify-center rounded text-xs ${
															isActive
																? "bg-primary text-primary-foreground"
																: "bg-white/10"
														}`}
													>
														{pageNum}
													</span>
													<span className="line-clamp-1 flex-1">
														{pageData?.title || `Page ${pageNum}`}
													</span>
													{isActive && (
														<ChevronRight className="h-4 w-4 text-primary" />
													)}
												</button>
											);
										}
									)}
								</div>
							)}
						</>
					)}
				</div>
			</ScrollArea>

			{/* Footer */}
			<div className="border-white/10 border-t p-3 text-center">
				<p className="text-muted-foreground text-xs">
					Page {currentPage} of {totalPages}
				</p>
			</div>
		</div>
	);
}

function RecursiveTOCItem({
	item,
	currentPage,
	onPageChange,
}: {
	item: IndexItem;
	currentPage: number;
	onPageChange: (page: number) => void;
}) {
	const [expanded, setExpanded] = useState(true);
	const hasChildren = item.children && item.children.length > 0;
	// Check if this item OR any child is active
	const isSelfActive = currentPage === item.targetPage;

	// Optional: Auto-expand path?
	// For now just manual expand

	return (
		<div className="w-full select-none">
			<div
				className={`flex w-full items-center gap-1 rounded-lg px-2 py-1.5 transition-colors ${
					isSelfActive
						? "bg-primary/10 text-primary"
						: "text-muted-foreground hover:bg-white/5 hover:text-foreground"
				}`}
			>
				{/* Expand/Collapse Toggle */}
				<button
					className={`flex h-6 w-6 shrink-0 items-center justify-center rounded hover:bg-white/10 ${
						hasChildren ? "opacity-100" : "opacity-0"
					}`}
					onClick={(e) => {
						e.stopPropagation();
						setExpanded(!expanded);
					}}
					type="button"
				>
					{hasChildren && (
						<ChevronRight
							className={`h-4 w-4 transition-transform ${
								expanded ? "rotate-90" : ""
							}`}
						/>
					)}
				</button>

				{/* Label (Click to navigate) */}
				<button
					className="flex-1 truncate text-left text-sm"
					onClick={() => onPageChange(item.targetPage)}
					type="button"
				>
					{item.label}
				</button>

				{/* Page Number Badge */}
				<span className="text-[10px] text-muted-foreground opacity-50">
					p.{item.targetPage}
				</span>
			</div>

			{/* Children */}
			{hasChildren && expanded && (
				<div className="ml-4 border-white/10 border-l pl-2">
					{item.children.map((child: IndexItem) => (
						<RecursiveTOCItem
							currentPage={currentPage}
							item={child}
							key={child._id}
							onPageChange={onPageChange}
						/>
					))}
				</div>
			)}
		</div>
	);
}
