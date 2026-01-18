This is a formatted and structured version of your **LexiVault** project specification, optimized for readability and professional presentation.

---

# LexiVault: Professional Document Digitization & Monetization Platform

## 1. Project Vision

To transform static, non-searchable regulatory **"dark data"** into a structured, searchable, and monetizable digital library for professionals in Legal, Medical, and Banking sectors. LexiVault aims to be the **"Single Source of Truth"** for complex Indonesian regulations, bridging the gap between physical archives and modern digital workflows.

---

## 2. Core Functional Pillars

### A. The Digitization Pipeline (The "Kitchen")

The foundational engine where raw, often degraded PDF/Scans are converted into high-fidelity data.

* **Ingestion & Storage:** Uploads to **Convex File Storage** with pre-processing (deskewing/noise reduction) to handle low-quality historical scans.
* **AI-Native OCR (Gemini 3 Flash):**
* **Spatial Awareness:** Identifies headers, tables, and footnotes as distinct objects.
* **Contextual Correction:** Uses reasoning to fix OCR errors (e.g., "8ank" → "Bank") based on Indonesian legal context.
* **Markdown Output:** Enables high-performance rendering and easy indexing.


* **Hybrid Search Indexing:** Combined **Full-Text** (exact matches like "Pasal 34") and **Vector Search** (semantic queries).

### B. The Discovery Engine & Multilingual Discovery

Ensures language is not a barrier to finding critical regulatory information.

* **Semantic Cross-Lingual Search:** Uses `text-embedding-004` to map concepts (e.g., "money laundering" aligns with "pencucian uang").
* **AI Query Expansion:** Automatically expands English queries into relevant Indonesian legal terminology.
* **Intelligent Previews:** Utilizes **TanStack Start SSR** to deliver SEO-friendly snippets to prove value before purchase.

### C. The Monetization Layer

* **Granular Access Control:** Managed via **Convex Schemas** to lock documents at the ID level or tier.
* **Real-Time Entitlements:**
* **Instant Unlock:** Reactive subscriptions ensure documents unlock the moment payment clears without a page refresh.
* **Flexible Models:** Supports Pay-per-Doc or tiered professional subscriptions.



### D. The High-Performance Reader

* **Parallelized Fetching:** **TanStack Loaders** pre-fetch Markdown chunks in the background to eliminate loading spinners.
* **Type-Safe State:** **TanStack Router** ensures shared links (highlights/pages) are valid and type-safe.
* **Streaming Translation:** Real-time, word-by-word translation using Gemini 3 Flash piped through TanStack Start's streaming SSR.

---

## 3. Technical Architecture

| Component | Technology | Why? |
| --- | --- | --- |
| **Frontend** | **TanStack Start** | SSR, Streaming, and parallel data fetching; zero Layout Shift (CLS). |
| **Backend** | **Convex** | Reactive BaaS; replaces DB, API, WebSockets, and Storage in one. |
| **Runtime** | **Bun** | Ultra-fast package manager and runtime; speeds up CI/CD. |
| **Code Quality** | **Biome + Ultracite** | Instant formatting and strict rules for safe legal text parsing. |
| **AI Engine** | **Gemini 3 Flash** | Optimized for multimodal speed and long-context reasoning. |
| **Auth** | **Clerk** | Professional-grade authentication integrated with Convex. |

---

## 4. AI & OCR Deep Dive: Processing Logic

1. **Multimodal Action:** Convex Actions handle the heavy lifting of sending files to `gemini-3-flash-preview`.
2. **Extraction Prompt:** > "Extract all text from this Indonesian regulation page. Format as Markdown. Preserve headers (Pasal, Ayat). Convert tables to Markdown tables. Remove page numbers and headers/footers."
3. **Cross-Lingual Mapping:** Vector space is initialized with multilingual support during the embedding phase.
4. **Token Efficiency:** Large context windows allow Gemini to maintain consistent section numbering across massive documents.

---

## 5. POC (Proof of Concept) Scope

* **The "Magic" Conversion:** A single upload flow turning a scanned PDF into searchable Markdown in Convex.
* **TanStack Reader UI:** A polished UI with a searchable sidebar and main reader pane with TanStack Query caching.
* **Multilingual Demo:** Search "1998 banking crisis" in English to find "Krisis Moneter Perbankan 1998."
* **Reactive Paywall:** A simulated "Pay" button that instantly un-blurs text via Convex subscriptions.

---

## 6. Challenges & Risk Mitigation

* **Stack Stability:** TanStack Start is in Beta.
* *Mitigation:* Keep the frontend thin; house core logic in Convex for easier refactoring.


* **OCR Accuracy:** Legal professionals demand 100% accuracy.
* *Mitigation:* Implement a **"Split View"** (Original Scan vs. AI Text) for manual verification.


* **Search Speed:** * *Mitigation:* Use a **Hybrid Search** approach within Convex—combining keyword filtering with vector semantic search.