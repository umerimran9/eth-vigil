# Product Redesign Brief — Guided Investigation Experience

> Captured verbatim from the project owner on 2026-08-12 as a reference brief for
> future work on Aegis/eth-vigil's frontend. This is a product/UX direction
> document, not a task that has been executed — treat it as the standing target
> to measure future redesign work against, not a changelog of what's done.
>
> Related, already-completed work from the same engagement: the investigation
> flow merge (`/detect` absorbing `/consensus` + `/explain`), the honest-data
> pass (removing fabricated stats/fallbacks across `/batch`, `/monitor`,
> `/reports`, `/settings`, `/history`), the per-model view selector, and the
> live Etherscan token-feature pipeline fix. This brief goes further — it's a
> full visual-design-system and IA reset, not yet implemented.

---

# Role

You are a **senior SaaS product designer, UX architect, frontend engineer, backend engineer, and QA engineer**.

You are working on my Final Year Project:

**AI-Powered Ethereum Blockchain Monitoring & Fraud Detection Platform**

The existing application already has a frontend, backend, AI/ML models, APIs, and blockchain/Etherscan integration. **Do not assume the current implementation is correct. Inspect the entire project before making changes.**

Your job is to transform the existing application into a **professional, coherent, minimalist blockchain security SaaS product** with a clear user journey.

---

# PRIMARY PROBLEM

The current frontend does not provide a strong enough operational flow.

A first-time user may open the website and think:

* What am I supposed to do?
* Where do I start?
* What should I enter?
* What happens after I submit a transaction?
* Which AI model is being used?
* What does the result mean?
* What should I investigate next?
* Where can I see the evidence behind the prediction?
* What action should I take?

The application currently feels more like a collection of frontend components/screens than a complete product.

### Your goal

Turn it into a **guided investigation experience**.

The user should never feel lost.

The core flow should feel like:

**Start Investigation → Enter Transaction → Scan Blockchain → Extract Data → Run Detection → AI Consensus → Risk Analysis → Explain Prediction → Investigate Evidence → Recommended Action**

The UI should progressively reveal information instead of displaying everything simultaneously.

---

# VERY IMPORTANT DESIGN DIRECTION

I do NOT want a generic AI-generated dashboard.

Avoid the typical:

* excessive glowing gradients
* giant neon AI text
* unnecessary 3D objects
* excessive glassmorphism
* huge rounded cards everywhere
* meaningless animated particles
* excessive purple/blue gradients
* "AI futuristic" visual clichés
* dashboards overloaded with charts
* decorative components that have no functional purpose
* fake-looking terminal interfaces
* excessive badges
* unnecessary statistics

The final product should look like a **real cybersecurity/blockchain SaaS product designed by a professional product team**.

Think about the design quality and restraint of products such as:

* Linear
* Stripe
* Vercel
* Raycast
* modern security operation platforms
* professional blockchain analytics platforms
* Chainalysis-style investigation products

Use these only as **design inspiration**, not as something to copy.

---

# DESIGN PHILOSOPHY

The visual language should be:

**Minimal + Technical + Trustworthy + Professional + Data-focused + Calm**

The application should feel appropriate for:

**Blockchain Security / Fraud Intelligence / Transaction Investigation**

rather than:

**"AI demo made for a university project."**

The design should make the FYP look like a real SaaS product.

---

# STEP 1 — AUDIT THE ENTIRE EXISTING PROJECT FIRST

Before changing anything:

Inspect:

* frontend architecture
* React components
* routes
* pages
* navigation
* state management
* API calls
* backend endpoints
* request/response schemas
* AI/ML integration
* Etherscan integration
* transaction processing
* fraud prediction pipeline
* explainability pipeline
* model selection
* consensus logic
* loading states
* error handling
* empty states
* responsive behavior
* existing animations
* duplicated components
* unused components
* dead code
* broken functionality
* inconsistent naming
* inconsistent API contracts
* hardcoded values
* simulated data
* placeholder content

Do not redesign based only on the visual appearance.

Understand how the **actual system works**.

---

# STEP 2 — MAP THE CURRENT USER JOURNEY

Create an internal map of:

1. First visit
2. User starts investigation
3. Transaction input
4. Validation
5. Blockchain data retrieval
6. Feature extraction
7. Model inference
8. Multi-model consensus
9. Risk calculation
10. Explainability
11. Threat intelligence
12. Final report
13. User's next action

Identify every point where the user can become confused.

Fix those problems.

---

# STEP 3 — CREATE A CLEAR PRODUCT INFORMATION ARCHITECTURE

Do not create a complicated enterprise sidebar.

The application should have a simple structure.

Suggested conceptual structure:

### Home / Investigation

The primary starting point.

The user immediately understands:

> "Analyze an Ethereum transaction for fraud risk."

Primary input:

**Transaction Hash**

Optional advanced inputs should remain secondary.

---

### Investigation Workspace

After submitting a transaction, move the user into a dedicated investigation workspace.

This should become the central experience of the application.

The investigation should have a clear state:

**Analyzing Transaction**

Then:

**Blockchain Data Retrieved**

Then:

**Features Extracted**

Then:

**Models Evaluated**

Then:

**Consensus Calculated**

Then:

**Explainability Generated**

Then:

**Investigation Complete**

Do not fake these stages.

Connect them to actual backend operations where possible.

If an operation is genuinely asynchronous, represent its actual state.

---

# STEP 4 — DESIGN THE CORE INVESTIGATION FLOW

Build the UX around this sequence:

## Stage 1 — Input

User sees a focused transaction investigation interface.

Example:

> Analyze Ethereum Transaction

Input:

`0x...`

Button:

**Analyze Transaction**

Secondary options:

* Example transaction
* Advanced configuration
* Model configuration

Do not overwhelm the user.

---

## Stage 2 — Transaction Scanning

Show meaningful progress.

For example:

**Scanning Transaction**

* Validating transaction hash
* Retrieving blockchain metadata
* Inspecting transaction structure
* Extracting fraud detection features

The progress interface should reflect actual backend activity.

---

## Stage 3 — AI Detection

Show that the system is evaluating the transaction.

For example:

**Running Detection Models**

Show the relevant models used by the actual system.

For example:

* CatBoost
* LightGBM
* XGBoost
* ExtraTrees
* Logistic Regression
* Neural/Transformer model
* other models that actually exist in the repository

Do NOT invent models.

---

## Stage 4 — Consensus

After individual model predictions:

Show a clean consensus result.

For example:

**Consensus Analysis**

Fraud Probability

`87.4%`

Classification

**HIGH RISK**

Model Agreement

`6 / 7`

Do not make this visually noisy.

---

# STEP 5 — FINAL INVESTIGATION RESULT

The final result should immediately answer:

### What happened?

Example:

**HIGH RISK TRANSACTION**

Fraud Probability: 87.4%

Confidence: High

Then answer:

### Why?

Show the most important contributing factors.

### What evidence supports this?

Show relevant transaction/blockchain features.

### What should the user do?

Provide a clear recommendation.

Example:

**Recommended Action**

> Flag transaction for further investigation.

The user should not need to interpret ten charts to understand the result.

---

# STEP 6 — EXPLAINABILITY

Explainability should not be hidden behind complicated technical terminology.

Create an investigation section such as:

### Why was this transaction flagged?

Show the strongest factors.

For example:

* unusually high transaction value
* suspicious transaction timing
* abnormal gas behavior
* interaction pattern
* address-related indicators

Only show factors that actually exist in the model explanation.

If SHAP is used, present SHAP results in a clean human-readable format.

Do not dump raw SHAP values onto the user.

Provide an optional:

**View Technical Explanation**

for advanced users.

---

# STEP 7 — TRANSACTION INTELLIGENCE

Create a clean transaction intelligence section containing information such as:

### Transaction

* Hash
* Block
* Timestamp
* From
* To
* Value
* Gas
* Gas price
* Status

### Contract Interaction

* Contract address
* Function interaction
* Contract-related information

### Token Activity

Only display token-transfer information if it actually exists.

Do not create empty decorative sections.

---

# STEP 8 — RISK BREAKDOWN

Instead of displaying many unrelated charts, create a concise risk breakdown.

Possible categories:

* Transaction Risk
* Address Risk
* Contract Risk
* Behavioral Risk
* Model Risk

Only use categories supported by the actual backend.

Each should explain what contributed to the risk.

---

# STEP 9 — MODEL INSIGHTS

Create a secondary technical section.

This is where advanced users can inspect:

* individual model predictions
* confidence/probability
* model agreement
* ensemble result
* threshold
* explainability
* model-specific information

Keep this section visually secondary.

The average user should not need to understand machine learning to use the product.

---

# STEP 10 — INVESTIGATION REPORT

At the end of the investigation provide:

**Investigation Summary**

Include:

* Transaction
* Final classification
* Fraud probability
* Confidence
* Model consensus
* Major risk indicators
* Explainability summary
* Blockchain evidence
* Recommended action

Provide an option to export/download the report if the backend already supports it.

If export functionality does not exist, determine whether it can be implemented cleanly.

---

# STEP 11 — NAVIGATION

Do not create a traditional dashboard with 15 unrelated sidebar pages.

Navigation should represent actual user tasks.

Prefer something conceptually like:

**Investigate**
**History**
**Models**
**System**

Keep it minimal.

The primary CTA should always be obvious:

**New Investigation**

A user should be able to return to a new transaction analysis from anywhere.

---

# STEP 12 — DASHBOARD

If the existing dashboard is retained, redesign it around actual useful information.

Do NOT fill it with random charts.

Possible useful information:

* investigations performed
* high-risk transactions
* recent investigations
* detection accuracy/performance
* model consensus
* current blockchain status

But prioritize the investigation workflow.

The dashboard should not become the product itself.

The investigation should be the product.

---

# STEP 13 — VISUAL SYSTEM

Create a consistent design system.

Define:

### Typography

Use a professional modern sans-serif.

Clear hierarchy between:

* page title
* section title
* metric
* body text
* metadata
* technical information

Avoid excessive typography variations.

### Spacing

Use a consistent spacing scale.

Give important information breathing room.

### Cards

Use cards only when they improve grouping or hierarchy.

Do not put every piece of information into a card.

### Borders

Use subtle borders.

Avoid excessive glowing outlines.

### Color

Use a restrained palette.

Use color primarily to communicate meaning:

* neutral
* success
* warning
* danger

Risk colors should be meaningful, not decorative.

### Background

Use a clean dark/light system appropriate for a blockchain security product.

If the existing application is dark, refine it rather than blindly changing it.

---

# STEP 14 — ANIMATION

Animation should communicate state.

Good examples:

* progress transitions
* result reveal
* loading states
* page transitions
* expanding investigation sections
* subtle hover states

Avoid:

* constant floating animations
* excessive particles
* random glowing objects
* distracting 3D animations
* animations that delay usability

The product should still feel excellent with animations disabled.

---

# STEP 15 — MAKE THE PRODUCT FEEL REAL

Every screen must answer:

**Why does this screen exist?**

Remove:

* placeholder sections
* fake statistics
* fake blockchain activity
* meaningless charts
* decorative AI elements
* duplicate information
* unused buttons
* buttons that do nothing
* fake loading animations
* dead navigation links

If data is unavailable, create a proper empty state rather than inventing data.

---

# STEP 16 — FRONTEND ↔ BACKEND INTEGRATION AUDIT

This is extremely important.

Inspect every frontend API call.

For each endpoint verify:

* URL
* HTTP method
* request body
* parameters
* response schema
* error response
* loading state
* timeout
* retry behavior
* authentication if applicable
* data transformation

Make sure the frontend uses the **actual backend response**.

Do not create fake frontend data simply to make the UI look complete.

If frontend and backend disagree, fix the integration.

---

# STEP 17 — BACKEND IMPROVEMENT

Do not rewrite the backend unnecessarily.

First identify architectural problems.

Improve only where required for:

* clean API contracts
* reliable transaction analysis
* proper error handling
* consistent response structure
* asynchronous processing
* model execution
* explainability
* blockchain data retrieval
* frontend integration
* performance

The backend must remain compatible with the actual AI/ML pipeline.

**Do not modify the trained models or preprocessing logic unless you identify a genuine integration problem.**

---

# STEP 18 — ERROR STATES

Design proper error states.

Examples:

### Invalid transaction hash

> Enter a valid Ethereum transaction hash.

### Transaction not found

> We couldn't locate this transaction on the blockchain.

### Blockchain API failure

> Blockchain data could not be retrieved. Try again.

### Model failure

> Detection could not be completed.

### Partial analysis

Clearly explain what succeeded and what failed.

Never leave the user staring at an infinite spinner.

---

# STEP 19 — RESPONSIVE DESIGN

Test the application at:

* desktop
* laptop
* tablet
* mobile

The primary investigation workflow must remain usable.

Do not simply shrink desktop components.

---

# STEP 20 — UX TESTING

Act as a real first-time user.

Perform these scenarios:

### Scenario A

"I know nothing about this application."

Can I understand what to do within 5 seconds?

### Scenario B

"I have a transaction hash."

Can I analyze it immediately?

### Scenario C

"The transaction is flagged."

Can I understand why?

### Scenario D

"I don't trust the prediction."

Can I inspect the evidence?

### Scenario E

"I want to analyze another transaction."

Can I do it without getting lost?

### Scenario F

"The backend fails."

Does the UI clearly explain what happened?

Fix every usability problem you discover.

---

# IMPORTANT — DO NOT DESTROY GOOD EXISTING WORK

Before modifying the project:

Identify what is already working well.

Preserve:

* working API integrations
* working model pipelines
* working Etherscan integration
* working explainability
* useful components
* useful visual elements
* existing functionality

Refactor where appropriate rather than rebuilding everything from scratch.

---

# FINAL PRODUCT EXPERIENCE

The final experience should feel approximately like:

### LANDING / HOME

**Ethereum Transaction Intelligence**

> Analyze blockchain transactions for fraud risk using machine learning and explainable AI.

[ Transaction Hash ]

**Analyze Transaction**

---

### ANALYSIS

**Investigating Transaction**

1. Blockchain metadata ✓
2. Feature extraction ✓
3. AI detection ✓
4. Consensus ✓
5. Explainability ✓

---

### RESULT

**HIGH RISK**

87.4% Fraud Probability

High Confidence

**6 / 7 Models Agree**

---

### WHY

**Primary Risk Factors**

Meaningful model-derived factors.

---

### EVIDENCE

Transaction + blockchain intelligence.

---

### ACTION

**Recommended Action**

Flag for further investigation.

---

# CRITICAL DESIGN RULE

Do NOT make every screen look impressive.

Make the **workflow** impressive.

A professional product is not impressive because it has more gradients, animations, cards, charts, or 3D effects.

It is impressive because:

**the user always knows what to do next.**

---

# IMPLEMENTATION PROCESS

Follow this order:

### Phase 1

Audit the complete existing project.

### Phase 2

Understand frontend/backend/AI architecture.

### Phase 3

Map current user journey.

### Phase 4

Identify UX, architecture, integration, and visual problems.

### Phase 5

Create the improved information architecture.

### Phase 6

Redesign the core investigation workflow.

### Phase 7

Implement the visual design system.

### Phase 8

Fix frontend/backend integration.

### Phase 9

Implement proper loading/error/empty states.

### Phase 10

Test the entire workflow end-to-end.

### Phase 11

Perform a final UI/UX and QA audit.

---

# OUTPUT REQUIRED BEFORE MAJOR CHANGES

Before implementing the redesign, provide me with:

1. **Current Architecture**
2. **Current User Flow**
3. **Problems/Gaps Found**
4. **Frontend Problems**
5. **Backend Problems**
6. **Frontend ↔ Backend Integration Problems**
7. **Proposed New User Flow**
8. **Proposed Information Architecture**
9. **Proposed Page/Component Structure**
10. **Visual Design Direction**
11. **What You Will Preserve**
12. **What You Will Refactor**
13. **What You Will Remove**
14. **What You Will Add**
15. **Implementation Plan**

Then implement the changes.

Do not stop at giving recommendations.

---

# FINAL REQUIREMENT

After implementation, perform a complete end-to-end test as if you are a first-time user.

Start from the homepage.

Enter a real/example Ethereum transaction.

Follow the complete investigation.

Verify:

**Frontend → Backend → Blockchain Data → Feature Extraction → AI/ML → Consensus → Explainability → Final Result → UI**

Fix any broken flow you discover.

The final application must feel like a **real minimalist blockchain fraud investigation SaaS platform**, not an AI-generated dashboard and not a collection of disconnected FYP screens.

Prioritize:

**Clarity > Functionality > Trust > Information hierarchy > Visual polish > Animation**

The most important success criterion is:

> **A first-time user should immediately understand what the product does, know exactly what to do, and understand the result without needing instructions.**
