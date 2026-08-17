# Aegis AI: Ethereum Fraud Detection & SOC Intelligence Gateway

> Complete, lightweight production stack containing the React Frontend, FastAPI Serving Gateway, 6 Preloaded ML Models, and Live Etherscan Ingestion Worker.

---

## ⚡ Quickstart on Laptop (Turnkey Execution)

### 1. Clone the repository
```bash
git clone -b production-deploy https://github.com/umerimran9/eth-vigil.git
cd eth-vigil
```

### 2. Set up Python Environment for Backend
```bash
python -m venv .venv
# On Windows PowerShell:
.\.venv\Scripts\Activate.ps1
# On Windows Command Prompt:
.\.venv\Scripts\activate.bat

pip install -r backend/requirements.txt
```

### 3. Set up Frontend Node Environment
```bash
npm install
```

### 4. Configure Environment (Optional Etherscan API Key)
Copy `backend/.env.example` to `backend/.env` and add your Etherscan API key:
```env
ETHERSCAN_API_KEY=your_key_here
```

### 5. Launch the Complete Stack
* **Option A (One-Click Launcher):** Double-click `start_all.bat`
* **Option B (Separate Terminals):**
  * **Backend (Port 8000):** `start_backend.bat` (or `cd backend && python -m uvicorn WebApp.app:app --host 127.0.0.1 --port 8000`)
  * **Frontend (Port 3000):** `start_frontend.bat` (or `npm run dev -- --port 3000`)
  * **Live Ingestion:** `start_live_ingest.bat` (or `cd backend && python tools/live_ingest_etherscan.py`)

* **Open the Web UI:** [http://localhost:3000](http://localhost:3000)

---

====================================================

PROJECT

AI-Powered Ethereum Blockchain Monitoring & Fraud Detection Platform

====================================================

GOAL

Create a futuristic AI platform that monitors Ethereum transactions in real time and detects fraudulent activity using Artificial Intelligence.

This is NOT an academic project.

Do NOT make it look like a student FYP.

It should look like a startup product that has received millions in funding.

The first impression should be

"This is a real enterprise AI platform."

====================================================

DESIGN PHILOSOPHY

Think beyond dashboards.

Avoid traditional admin templates.

Avoid generic SaaS layouts.

Create something memorable.

The interface should feel alive.

Inspired by

Apple

Nothing OS

Linear

Arc Browser

Vercel

Framer

Stripe

Tesla

Microsoft Copilot

Chainalysis

VisionOS

The experience should be minimal, futuristic, elegant, intelligent and immersive.

====================================================

IMPORTANT

DO NOT CREATE

❌ Login page

❌ Registration page

❌ Forgot password

❌ Traditional left sidebar

❌ Traditional top navigation

❌ Admin dashboard template

❌ Bootstrap-looking cards

❌ Generic analytics dashboard

❌ University project appearance

❌ Crypto exchange appearance

❌ Rainbow gradients

❌ Cluttered interface

====================================================

NAVIGATION

Create an innovative navigation system.

Use one of these concepts or invent something even better.

Floating AI Core

Floating Dock

Radial Navigation

Morphing Navigation

Dynamic Island Navigation

Command Palette

Floating Pills

Infinite Canvas Navigation

Navigation should be smooth and animated.

Switching sections should feel like morphing into another workspace instead of loading a page.

====================================================

LANDING EXPERIENCE

Immediately immerse the user.

No boring hero section.

Use cinematic motion.

Animated blockchain network.

Moving particles.

Aurora background.

Glass layers.

Depth.

Subtle motion.

A central AI Core should visually represent the intelligence of the platform.

Everything revolves around it.

====================================================

CORE MODULES

• Live Blockchain Monitoring

• Fraud Detection

• Batch Detection

• AI Models

• AI Consensus

• Explainability

• Analytics

• History

• Reports

• Settings

====================================================

LIVE BLOCKCHAIN MONITORING

Using Etherscan API.

Display

Latest blocks

Recent transactions

Risk indicators

Transaction details

Live updates

Search by

Wallet

Transaction Hash

Block Number

Transactions should animate into the interface like a real monitoring system.

====================================================

FRAUD DETECTION

Allow three methods.

1.

Paste Transaction Hash

System automatically retrieves transaction data and predicts.

2.

Upload CSV

Batch analysis.

3.

Manual feature entry.

After prediction show

Prediction

Confidence

Risk Level

Processing Time

Recommendation

Feature Importance

SHAP explanation

====================================================

AI MODELS

Support

LightGBM

XGBoost

Random Forest

Logistic Regression

MLP

FT Transformer

TabNet

Each model should have its own immersive page.

Not just a card.

Each page should explain

Architecture

Performance

Metrics

ROC

PR

Confusion Matrix

Feature Importance

SHAP

Inference Speed

Advantages

Limitations

====================================================

AI CONSENSUS

One of the signature features.

Run all seven models.

Display

Prediction from every model.

Agreement percentage.

Consensus confidence.

Final recommendation.

Beautiful visualization.

Animated voting.

Models should visually connect into a central Consensus Engine.

====================================================

EXPLAINABILITY

Dedicated experience.

Interactive SHAP visualization.

Feature Importance.

Prediction reasoning.

Natural language explanation.

====================================================

ANALYTICS

Modern visual analytics.

Fraud trends.

Model usage.

Prediction timeline.

Detection statistics.

Interactive charts.

====================================================

HISTORY

Store previous analyses.

Search.

Filter.

Export.

Re-run prediction.

====================================================

REPORTS

Generate professional reports.

PDF

CSV

Prediction Summary

Batch Summary

====================================================

DESIGN LANGUAGE

Dark Mode

Luxury SaaS

Minimal

Glassmorphism

Frosted Glass

Soft Shadows

Mesh Gradients

Aurora Lighting

Rounded Corners

Floating Elements

Exceptional Typography

Immersive Motion

Elegant spacing

====================================================

COLORS

Near-black background.

Electric Blue

Indigo

Purple

Cyan

Green for Safe.

Red for High Risk.

Use color intentionally.

====================================================

ANIMATIONS

This is extremely important.

Avoid basic fade-ins.

Use

Morphing

Shared element transitions

Staggered entrances

Magnetic hover

Cursor interaction

Depth

Layered parallax

Dock magnification

Physics-based motion

Fluid page transformations

Animated blockchain nodes

Live transaction flow

Animated consensus visualization

Prediction pipeline animation

Loading sequences that tell a story instead of using a spinner.

====================================================

MICRO INTERACTIONS

Everything responds.

Buttons lift.

Cards tilt.

Icons animate.

Charts draw themselves.

Notifications slide naturally.

Hover states feel premium.

====================================================

TECH STACK

React

TypeScript

Tailwind CSS

shadcn/ui

Framer Motion

GSAP (only where needed)

Recharts

TanStack Table

React Flow

Lucide Icons

Responsive Design

====================================================

FINAL GOAL

Do not build a website.

Design an unforgettable product experience.

The user should feel like they are operating an AI-powered blockchain security command center rather than using a traditional web application.

Every interaction should reinforce trust, intelligence, speed, and sophistication.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/96a466c6-9e12-4450-9080-b638beaf054e).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
