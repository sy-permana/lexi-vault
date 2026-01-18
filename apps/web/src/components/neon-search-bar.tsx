import { Search as SearchIcon } from "lucide-react";
import type { FormEvent } from "react";
import { Input } from "@/components/ui/input";

interface NeonSearchBarProps {
	query: string;
	setQuery: (query: string) => void;
	onSearch: (e: FormEvent) => void;
	placeholder?: string;
	className?: string;
}

export function NeonSearchBar({
	query,
	setQuery,
	onSearch,
	placeholder = "Search...",
	className = "",
}: NeonSearchBarProps) {
	return (
		<div className={`relative w-full max-w-3xl ${className}`}>
			{/* Background Glow Effect */}
			<div className="absolute -inset-1 rounded-full bg-gradient-to-r from-purple-600 via-pink-600 to-blue-600 opacity-30 blur-2xl transition duration-1000 group-hover:opacity-100 group-hover:duration-200" />

			<form className="relative" onSubmit={onSearch}>
				<div className="relative flex items-center">
					<SearchIcon className="absolute left-6 h-6 w-6 text-white/50" />
					<Input
						className="h-16 w-full rounded-full border border-white/10 bg-black/20 pl-16 text-white text-xl shadow-2xl backdrop-blur-md transition-all placeholder:text-gray-400 hover:bg-black/30 hover:shadow-purple-500/20 focus:border-purple-500/50 focus:bg-black/40 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
						onChange={(e) => setQuery(e.target.value)}
						placeholder={placeholder}
						type="text"
						value={query}
					/>
					{/* Right Action Button (Enter) */}
					<button
						className="absolute top-1/2 right-3 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white/50 transition-colors hover:bg-white/20 hover:text-white"
						type="submit"
					>
						<span className="sr-only">Search</span>
						<svg
							className="h-5 w-5"
							fill="none"
							stroke="currentColor"
							viewBox="0 0 24 24"
							xmlns="http://www.w3.org/2000/svg"
						>
							<path
								d="M13.5 4.5L21 12M21 12L13.5 19.5M21 12H3"
								strokeLinecap="round"
								strokeLinejoin="round"
								strokeWidth="2"
							/>
						</svg>
					</button>
				</div>
			</form>
		</div>
	);
}
