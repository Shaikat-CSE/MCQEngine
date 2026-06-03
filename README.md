# 🔍 MCQ Finder — Premium AI-Native Question Matcher

MCQ Finder is a world-class, single-purpose application designed to search through Excel-based question banks using optimized fuzzy matching algorithms. Inspired by the sleek interface paradigms of Groq, Perplexity, and Linear, it delivers sub-50ms search results with an elegant, responsive light mode design.

---

## ⚡ Key Highlights
*   **Zero-Config Seeding**: Simply drop `.xlsx` files into the `./data` directory. The backend watcher automatically detects, parses, normalizes, and indexes them in under 5 seconds.
*   **Two-Stage Search Optimization**: Scales effortlessly to support **100,000+ MCQs** by utilizing a fast C++ candidate selection stage via `RapidFuzz` followed by detailed composite scoring.
*   **Interactive Light Mode**: Centered, minimal, luxury-grade user interface built using Next.js, Tailwind CSS, and Framer Motion.
*   **Smart Scoring**: Automatically decides whether to display a single high-confidence match ($\ge 85\%$) or the top 3 closest alternative candidates ($< 85\%$).
*   **Developer Friendly**: Keyboard shortcut `/` focuses the search bar instantly, and `Esc` clears active overlays.

---

## 📐 Architecture & Technology Stack

```
                                  +-----------------------+
                                  |   data/Subject.xlsx   |
                                  +-----------+-----------+
                                              |
                                              v (Dynamic Poller / Watcher)
+---------------------------------------------+---------------------------------------------+
| BACKEND (FastAPI + SQLAlchemy)                                                            |
|                                                                                           |
|   +-------------------+       +---------------------+       +---------------------------+ |
|   |    importer.py    | ----> |     models.py       | ----> | SQLite (mcq_finder.db)    | |
|   |  (Column Mapper)  |       |  (Subjects / MCQs)  |       | (Composite search index)  | |
|   +-------------------+       +---------------------+       +---------------------------+ |
|                                                                          |                |
|   +-------------------+       +---------------------+                    |                |
|   |     main.py       | <==== |      search.py      | <==================+                |
|   |   (REST API)      |       | (Two-stage Scorer)  |                                     |
|   +---------+---------+       +---------------------+                                     |
+-------------|-----------------------------------------------------------------------------+
              | (HTTP requests)
              v
+-------------|-----------------------------------------------------------------------------+
| FRONTEND (Next.js 15 + React + Framer Motion)                                             |
|                                                                                           |
|   +---------+---------+       +---------------------+       +---------------------------+ |
|   |     page.tsx      | <---> |    globals.css      | <---> | Local Storage             | |
|   |  (Interactive UI) |       | (Custom Light Theme)|       | (Recent Search History)   | |
|   +-------------------+       +---------------------+       +---------------------------+ |
+-------------------------------------------------------------------------------------------+
```

### Stack Detail
- **Frontend**: Next.js 15 (App Router), React, TypeScript, Tailwind CSS, Framer Motion, Lucide Icons
- **Backend**: FastAPI, Uvicorn, Python 3.11+
- **Fuzzy Search & Processing**: RapidFuzz, Pandas, Openpyxl
- **Database**: SQLite, SQLAlchemy ORM

---

## 📂 Project Directory Structure

```
MCQfinder/
├── data/                         # Excel question banks directory (Place .xlsx files here)
│   └── Python_Programming_300_MCQ.xlsx
├── backend/                      # FastAPI Python Backend
│   ├── app/
│   │   ├── config.py             # Configs (Paths, thresholds, RapidFuzz weights)
│   │   ├── database.py           # SQLite Session pool configurations
│   │   ├── importer.py           # Excel Parser & file change scanner
│   │   ├── main.py               # REST endpoints & background scheduler
│   │   ├── models.py             # SQLAlchemy schemas (Subject, MCQ, SearchLog)
│   │   └── search.py             # Two-stage fuzzy search matching engine
│   ├── requirements.txt          # Python packages list
│   └── venv/                     # Python local virtual environment
├── frontend/                     # Next.js Frontend
│   ├── src/
│   │   └── app/
│   │       ├── globals.css       # Global light mode rules, glows & scrollbars
│   │       ├── layout.tsx        # HTML wrapper layout
│   │       └── page.tsx          # Single-page interface & search component
│   ├── package.json              # NPM dependencies
│   └── tsconfig.json             # TypeScript configs
├── mcq_finder.db                 # Autogenerated SQLite database
└── README.md                     # This documentation
```

---

## 🗃️ Excel Sheet Columns Design
Each spreadsheet represents a **Subject**. The importer automatically normalizes and clean-maps column headers to support naming variations.

### Required Columns
*   **Question**: The body of the question (Maps: `question`, `q`, `ques`, `question text`).
*   **Option A**: Value for option A (Maps: `option a`, `option_a`, `opt a`, `a`).
*   **Option B**: Value for option B (Maps: `option b`, `option_b`, `opt b`, `b`).
*   **Option C**: Value for option C (Maps: `option c`, `option_c`, `opt c`, `c`).
*   **Option D**: Value for option D (Maps: `option d`, `option_d`, `opt d`, `d`).
*   **Correct Answer**: The correct option key (e.g. "A", "B", "C", "D") (Maps: `correct answer`, `answer`, `correct`, `ans`).

### Optional Columns (Displayed if present)
*   **Category** (Maps: `category`, `cat`)
*   **Topic** (Maps: `topic`)
*   **Difficulty** (Maps: `difficulty`, `diff`, `level`)

---

## ⚙️ Installation & Startup

### Step 1: Clone & Configure Data
Create a `./data` directory in the root of the project, and move your Excel course files into it:
```bash
mkdir data
# Copy your excel files (e.g. networking.xlsx, database.xlsx) into ./data
```

### Step 2: Spin Up Python Backend
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   # Windows Powershell
   python -m venv venv
   .\venv\Scripts\activate

   # macOS / Linux
   python3 -m venv venv
   source venv/bin/activate
   ```
3. Install the dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the backend development server:
   ```bash
   uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
   ```
The backend API documentation is accessible at `http://127.0.0.1:8000/docs`.

### Step 3: Spin Up Next.js Frontend
1. Open a new terminal in the `frontend` folder:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Run the development server:
   ```bash
   npm run dev
   ```
Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## 📡 API Reference

### 1. Get Subjects
*   **Endpoint**: `/api/subjects`
*   **Method**: `GET`
*   **Response**: Returns list of loaded courses with question count.
    ```json
    [
      {
        "id": 1,
        "name": "Python Programming",
        "file_name": "Python_Programming_300_MCQ.xlsx",
        "question_count": 300,
        "created_at": "2026-06-03T03:00:00"
      }
    ]
    ```

### 2. Search Questions
*   **Endpoint**: `/api/search`
*   **Method**: `POST`
*   **Body**:
    ```json
    {
      "subject_id": 1,
      "query": "lookup order nested function"
    }
    ```
*   **Response**: Returns list of MCQs with similarity match scores.

### 3. Server Status
*   **Endpoint**: `/api/status`
*   **Method**: `GET`
*   **Response**: Returns count statistics of active database data.

---

## 👥 Credits
Developed with ❤️ by **Codemy Technologies** ([codemybd.com](https://codemybd.com)).

