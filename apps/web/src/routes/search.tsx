import { api } from "@lexivault/backend/convex/_generated/api";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { FileText, Loader2, Search as SearchIcon } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { NeonSearchBar } from "@/components/neon-search-bar";
import { Card } from "@/components/ui/card";

interface SearchResult {
	documentId: string;
	documentTitle: string;
	pageNumber: number;
	category: string;
	year: number;
	snippet: string;
	score: number;
}

export const Route = createFileRoute("/search")({
	component: SearchComponent,
	validateSearch: (search: Record<string, unknown>) => {
		return {
			q: (search.q as string) || "",
		};
	},
});

function SearchComponent() {
	const navigate = useNavigate();
	const { q } = Route.useSearch();
	const [query, setQuery] = useState(q);
	const [debouncedQuery, setDebouncedQuery] = useState(q);
	const [results, setResults] = useState<SearchResult[]>([]);
	const [isSearching, setIsSearching] = useState(false);

	const hybridSearch = useAction(api.search.hybridSearch);

	// Sync query with URL param
	useEffect(() => {
		setQuery(q);
		setDebouncedQuery(q);
	}, [q]);

	// Debounce search
	useEffect(() => {
		const timer = setTimeout(() => setDebouncedQuery(query), 300);
		return () => clearTimeout(timer);
	}, [query]);

	// Execute search
	useEffect(() => {
		if (debouncedQuery.trim()) {
			setIsSearching(true);
			hybridSearch({ query: debouncedQuery })
				.then((data) => {
					setResults(data as SearchResult[]);
					setIsSearching(false);
				})
				.catch((error) => {
					console.error("Search error:", error);
					setIsSearching(false);
				});
		} else {
			setResults([]);
		}
	}, [debouncedQuery, hybridSearch]);

	const handleSearch = (e: FormEvent) => {
		e.preventDefault();
		if (query.trim()) {
			navigate({ to: "/search", search: { q: query.trim() } });
		}
	};

	return (
		<div className="container mx-auto max-w-7xl px-6 py-8">
			{/* Search Bar */}
			{/* Search Bar */}
			{/* Hero Search Section - Glowing Glass Wrapper */}
			<div className="relative mx-auto mt-20 mb-20 w-full max-w-3xl">
				{/* Background Glow Effect */}

				<NeonSearchBar
					className="mx-auto"
					onSearch={handleSearch}
					placeholder="Search legal documents..."
					query={query}
					setQuery={setQuery}
				/>

				{/* Helper Text below search */}
				<div className="mt-4 text-center">
					<p className="text-gray-400 text-sm">
						Try searching for{" "}
						<span className="text-purple-400">"banking regulations"</span> or{" "}
						<span className="text-cyan-400">"contract law"</span>
					</p>
				</div>
			</div>

			{/* Results */}
			{isSearching && (
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-8 w-8 animate-spin text-primary" />
				</div>
			)}

			{!(isSearching || debouncedQuery) && (
				<div className="py-20 text-center">
					<SearchIcon className="mx-auto mb-4 h-16 w-16 text-muted-foreground/50" />
					<h3 className="mb-2 font-semibold text-foreground text-xl">
						Start searching
					</h3>
					<p className="text-muted-foreground">
						Enter keywords to find legal documents
					</p>
				</div>
			)}

			{!isSearching && debouncedQuery && results.length === 0 && (
				<div className="py-20 text-center">
					<FileText className="mx-auto mb-4 h-16 w-16 text-muted-foreground/50" />
					<h3 className="mb-2 font-semibold text-foreground text-xl">
						No results found
					</h3>
					<p className="text-muted-foreground">
						Try different keywords or check your spelling
					</p>
				</div>
			)}

			{!isSearching && results.length > 0 && (
				<>
					<p className="mb-6 text-muted-foreground text-sm">
						Found {results.length} result{results.length !== 1 ? "s" : ""}
					</p>

					{/* Search Results Grid */}
					<div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
						{results.map((result, index) => (
							<Link
								key={`${result.documentId}-${result.pageNumber}-${index}`}
								params={{ documentId: result.documentId }}
								search={{ page: result.pageNumber }}
								to="/reader/$documentId"
							>
								<Card className="glass-card group flex h-full cursor-pointer flex-col border-0 p-6">
									{/* Category Badge */}
									<div className="mb-4">
										<span className="inline-block rounded-full border border-primary/20 bg-primary/10 px-3 py-1 font-medium text-primary text-xs">
											{result.category}
										</span>
									</div>

									{/* Document Title */}
									<h3 className="mb-3 line-clamp-2 font-bold text-foreground text-lg transition-colors group-hover:text-primary">
										{result.documentTitle}
									</h3>

									{/* Snippet */}
									{result.snippet && (
										<p className="mb-4 line-clamp-3 flex-1 text-muted-foreground text-sm leading-relaxed">
											{result.snippet}
										</p>
									)}

									{/* Metadata Footer */}
									<div className="flex items-center justify-between border-white/10 border-t pt-4 text-muted-foreground text-xs">
										<span className="font-medium">{result.year}</span>
										<div className="flex items-center gap-1 rounded bg-white/10 px-2 py-1">
											<FileText className="h-3 w-3" />
											<span>Page {result.pageNumber}</span>
										</div>
									</div>
								</Card>
							</Link>
						))}
					</div>
				</>
			)}
		</div>
	);
}
