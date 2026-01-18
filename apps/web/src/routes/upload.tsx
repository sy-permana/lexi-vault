import { api } from "@lexivault/backend/convex/_generated/api";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { CloudUpload, FileText, Loader2, Upload, X } from "lucide-react";
import { type ChangeEvent, type DragEvent, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";

export const Route = createFileRoute("/upload")({
	component: UploadComponent,
});

const CATEGORIES = [
	"Banking",
	"Tax",
	"Corporate",
	"Insurance",
	"Securities",
	"Other",
] as const;

function UploadComponent() {
	const navigate = useNavigate();
	const fileInputRef = useRef<HTMLInputElement>(null);

	// Form state
	const [file, setFile] = useState<File | null>(null);
	const [title, setTitle] = useState("");
	const [description, setDescription] = useState("");
	const [category, setCategory] = useState<string>("Banking");
	const [year, setYear] = useState(new Date().getFullYear());
	const [isPremium, setIsPremium] = useState(false);
	const [price, setPrice] = useState<number | undefined>(undefined);
	const [pageCount, setPageCount] = useState(1);

	// Upload state
	const [isUploading, setIsUploading] = useState(false);
	const [isDragOver, setIsDragOver] = useState(false);

	// Convex mutations
	const generateUploadUrl = useMutation(api.documents.generateUploadUrl);
	const createDocument = useMutation(api.documents.createDocument);

	const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(true);
	};

	const handleDragLeave = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);
	};

	const handleDrop = (e: DragEvent<HTMLDivElement>) => {
		e.preventDefault();
		setIsDragOver(false);

		const droppedFile = e.dataTransfer.files[0];
		if (droppedFile?.type === "application/pdf") {
			setFile(droppedFile);
			// Auto-fill title from filename
			if (!title) {
				setTitle(droppedFile.name.replace(".pdf", ""));
			}
		} else {
			toast.error("Please upload a PDF file");
		}
	};

	const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
		const selectedFile = e.target.files?.[0];
		if (selectedFile) {
			setFile(selectedFile);
			if (!title) {
				setTitle(selectedFile.name.replace(".pdf", ""));
			}
		}
	};

	const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
		if (e.key === "Enter" || e.key === " ") {
			e.preventDefault();
			fileInputRef.current?.click();
		}
	};

	const removeFile = () => {
		setFile(null);
		if (fileInputRef.current) {
			fileInputRef.current.value = "";
		}
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();

		if (!file) {
			toast.error("Please select a PDF file");
			return;
		}

		if (!title.trim()) {
			toast.error("Please enter a document title");
			return;
		}

		setIsUploading(true);

		try {
			// Step 1: Get upload URL
			const uploadUrl = await generateUploadUrl();

			// Step 2: Upload file to Convex storage
			const uploadResult = await fetch(uploadUrl, {
				method: "POST",
				headers: { "Content-Type": file.type },
				body: file,
			});

			if (!uploadResult.ok) {
				throw new Error("Failed to upload file");
			}

			const { storageId } = await uploadResult.json();

			// Step 3: Create document record
			await createDocument({
				title: title.trim(),
				description: description.trim() || undefined,
				category,
				year,
				storageId,
				totalPageCount: pageCount,
				isPremium,
				price: isPremium ? price : undefined,
			});

			toast.success(
				"Document uploaded successfully! Processing will begin shortly."
			);
			navigate({ to: "/documents" });
		} catch (error) {
			console.error("Upload failed:", error);
			toast.error("Failed to upload document. Please try again.");
		} finally {
			setIsUploading(false);
		}
	};

	return (
		<div className="container mx-auto max-w-3xl px-6 py-12">
			<div className="mb-10 text-center">
				<h1 className="mb-2 font-bold text-4xl tracking-tight">
					Upload Document
				</h1>
				<p className="text-lg text-muted-foreground">
					Upload a legal document for AI-powered OCR processing
				</p>
			</div>
			<Card className="border-muted bg-card/50 shadow-sm backdrop-blur-sm">
				<CardHeader>
					<CardTitle className="flex items-center gap-2">
						<FileText className="h-5 w-5 text-primary" />
						Document Details
					</CardTitle>
					<CardDescription>
						Provide metadata for the document to help with categorization
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form className="space-y-8" onSubmit={handleSubmit}>
						{/* File Drop Zone */}
						<div
							className={`relative flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed p-10 text-center transition-all ${
								isDragOver
									? "scale-[1.01] border-primary bg-primary/5"
									: "border-border hover:border-primary/50 hover:bg-muted/50"
							} ${file ? "border-primary/50 bg-primary/5" : ""}`}
							onClick={() => fileInputRef.current?.click()}
							onDragLeave={handleDragLeave}
							onDragOver={handleDragOver}
							onDrop={handleDrop}
							onKeyDown={handleKeyDown}
							role="button"
							tabIndex={0}
						>
							<input
								accept=".pdf,application/pdf"
								className="hidden"
								onChange={handleFileChange}
								ref={fileInputRef}
								type="file"
							/>

							{file ? (
								<div className="flex w-full flex-col items-center gap-4">
									<div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
										<FileText className="h-8 w-8 text-primary" />
									</div>
									<div className="space-y-1">
										<p className="font-medium text-lg">{file.name}</p>
										<p className="text-muted-foreground text-sm">
											{(file.size / 1024 / 1024).toFixed(2)} MB
										</p>
									</div>
									<Button
										className="mt-2"
										onClick={(e) => {
											e.stopPropagation();
											removeFile();
										}}
										size="sm"
										variant="outline"
									>
										<X className="mr-2 h-4 w-4" />
										Remove File
									</Button>
								</div>
							) : (
								<div className="flex flex-col items-center gap-4">
									<div className="flex h-16 w-16 items-center justify-center rounded-full bg-secondary">
										<CloudUpload className="h-8 w-8 text-muted-foreground" />
									</div>
									<div className="space-y-1">
										<p className="font-semibold text-lg">
											Click to upload or drag and drop
										</p>
										<p className="text-muted-foreground text-sm">
											PDF files only (max 50MB)
										</p>
									</div>
									<Button
										className="mt-2"
										size="sm"
										type="button"
										variant="secondary"
									>
										Select File
									</Button>
								</div>
							)}
						</div>

						<div className="grid gap-6">
							{/* Title */}
							<div className="space-y-2">
								<Label htmlFor="title">Document Title *</Label>
								<Input
									className="h-11"
									id="title"
									onChange={(e) => setTitle(e.target.value)}
									placeholder="e.g., Bank Indonesia Regulation No. 10/1998"
									required
									value={title}
								/>
							</div>

							{/* Description */}
							<div className="space-y-2">
								<Label htmlFor="description">Description</Label>
								<Textarea
									className="min-h-[100px] resize-y"
									id="description"
									onChange={(e) => setDescription(e.target.value)}
									placeholder="Brief description of the document context and purpose..."
									value={description}
								/>
							</div>

							{/* Category & Year */}
							<div className="grid grid-cols-1 gap-6 md:grid-cols-2">
								<div className="space-y-2">
									<Label htmlFor="category">Category *</Label>
									<Select onValueChange={setCategory} value={category}>
										<SelectTrigger className="h-11" id="category">
											<SelectValue placeholder="Select category" />
										</SelectTrigger>
										<SelectContent>
											{CATEGORIES.map((cat) => (
												<SelectItem key={cat} value={cat}>
													{cat}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>
								<div className="space-y-2">
									<Label htmlFor="year">Year *</Label>
									<Input
										className="h-11"
										id="year"
										max={new Date().getFullYear()}
										min={1900}
										onChange={(e) => setYear(Number(e.target.value))}
										required
										type="number"
										value={year}
									/>
								</div>
							</div>

							{/* Page Count */}
							<div className="space-y-2">
								<Label htmlFor="pageCount">Estimated Page Count *</Label>
								<Input
									className="h-11"
									id="pageCount"
									min={1}
									onChange={(e) => setPageCount(Number(e.target.value))}
									required
									type="number"
									value={pageCount}
								/>
								<p className="text-muted-foreground text-xs">
									This will be updated automatically after OCR processing
								</p>
							</div>

							{/* Premium Toggle */}
							<div className="rounded-lg border bg-card p-4">
								<div className="flex items-center justify-between">
									<div className="space-y-0.5">
										<Label className="text-base" htmlFor="isPremium">
											Premium Document
										</Label>
										<p className="text-muted-foreground text-sm">
											Require payment to view this document
										</p>
									</div>
									<Switch
										checked={isPremium}
										id="isPremium"
										onCheckedChange={setIsPremium}
									/>
								</div>

								{isPremium && (
									<div className="fade-in slide-in-from-top-2 mt-4 animate-in">
										<Label htmlFor="price">Price (IDR)</Label>
										<div className="relative mt-2">
											<span className="absolute top-1/2 left-3 -translate-y-1/2 text-muted-foreground">
												Rp
											</span>
											<Input
												className="h-11 pl-10"
												id="price"
												min={0}
												onChange={(e) =>
													setPrice(
														e.target.value ? Number(e.target.value) : undefined
													)
												}
												placeholder="50,000"
												type="number"
												value={price ?? ""}
											/>
										</div>
									</div>
								)}
							</div>
						</div>

						{/* Submit */}
						<Button
							className="h-11 w-full text-base"
							disabled={isUploading || !file}
							size="lg"
							type="submit"
						>
							{isUploading ? (
								<>
									<Loader2 className="mr-2 h-5 w-5 animate-spin" />
									Uploading...
								</>
							) : (
								<>
									<Upload className="mr-2 h-5 w-5" />
									Upload Document
								</>
							)}
						</Button>
					</form>
				</CardContent>
			</Card>
		</div>
	);
}
