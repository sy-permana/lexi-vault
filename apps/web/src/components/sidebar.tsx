import { Link, useRouterState } from "@tanstack/react-router";
import { FileText, Home, Library, LogOut, Search, Upload } from "lucide-react";

const navItems = [
	{ icon: Home, label: "Home", path: "/" },
	{ icon: Search, label: "Search", path: "/search" },
	{ icon: Library, label: "Browse Library", path: "/browse" },
	{ icon: FileText, label: "My Documents", path: "/documents" },
	{ icon: Upload, label: "Upload", path: "/upload" },
];

export function Sidebar() {
	const router = useRouterState();
	const currentPath = router.location.pathname;

	const isActive = (path: string) => {
		if (path === "/" && currentPath === "/") {
			return true;
		}
		if (path !== "/" && currentPath.startsWith(path)) {
			return true;
		}
		return false;
	};

	return (
		<div className="fixed top-0 left-0 z-50 flex h-screen w-64 flex-col border-white/10 border-r bg-white/5 backdrop-blur-xl transition-colors dark:bg-black/20">
			{/* Logo */}
			<div className="p-6">
				<Link className="inline-flex items-center gap-2" to="/">
					<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary font-bold text-white shadow-lg shadow-primary/20">
						L
					</div>
					<span className="bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text font-bold text-transparent text-xl dark:from-white dark:to-gray-400">
						LexiVault
					</span>
				</Link>
			</div>

			{/* Navigation */}
			<nav className="flex-1 space-y-1 px-4 py-4">
				<div className="mb-4 px-2 font-semibold text-muted-foreground text-xs uppercase tracking-wider">
					Main Menu
				</div>
				{navItems.map((item) => (
					<Link
						className={`flex items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-sm transition-all duration-200 ${
							isActive(item.path)
								? "bg-primary/20 text-primary shadow-sm ring-1 ring-primary/30"
								: "text-muted-foreground hover:bg-white/10 hover:text-foreground"
						}`}
						key={item.path}
						to={item.path}
					>
						<item.icon className="h-4 w-4" />
						{item.label}
					</Link>
				))}
			</nav>

			{/* Footer */}
			<div className="border-gray-100 border-t p-4">
				<button
					className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 font-medium text-muted-foreground text-sm transition-colors hover:bg-red-50 hover:text-red-600"
					type="button"
				>
					<LogOut className="h-4 w-4" />
					Sign Out
				</button>
			</div>
		</div>
	);
}
