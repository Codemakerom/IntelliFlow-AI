# 🚦 GridLock: Event-Driven Congestion Forecasting & Tactical Recommendation Engine

GridLock is a state-of-the-art, event-driven congestion forecasting and tactical recommendation engine designed for city-wide traffic enforcement in Bangalore. It bridges machine learning predictions, geographical topological graphs, LLM-powered command sandboxes, and automated dispatch APIs into a unified, bilingual command interface.


## 🌟 Problem Statement

Cities frequently experience severe congestion due to:

* Public gatherings and festivals
* Sports events and concerts
* Road closures and accidents
* Weather-related disruptions
* Unexpected traffic incidents

Traditional traffic systems react after congestion occurs. GridLock shifts traffic management from **reactive** to **predictive**, allowing authorities to intervene before roads become overwhelmed. 

---

## 🎯 Key Features

### 🔮 Predict Before It Happens

#### Event Planning & Simulation Engine

* Predict traffic impact before events begin
* Estimate congestion duration
* Forecast road closure probability
* Generate officer, vehicle, and barricade requirements
* Visualize event impact on an interactive map

---

### 🌊 Cascading Impact Predictor

Unlike traditional systems that only show current congestion, GridLock predicts where congestion will spread next.

* BFS-based congestion propagation engine
* Hotspot forecasting
* Traffic spillover prediction
* Network-wide impact analysis

---

### 🚧 Barricading & Choke Point Optimizer

Optimize intervention strategies before roads reach critical capacity.

* Critical junction identification
* Smart diversion planning
* Barricade placement recommendations
* Officer deployment optimization

---

### 🤖 AI Tactical Simulator

A conversational command assistant for traffic authorities.

Examples:

* *"What if the event runs 2 hours longer?"*
* *"What if we deploy 10 more officers?"*
* *"What if we keep this road open?"*

Instantly simulate outcomes before taking action.

---

### 🌍 Multilingual Support

Designed for diverse operational environments.

Supported Languages:

* English
* Kannada

---

### 🎙️ Voice Briefing & WhatsApp Dispatch

Deliver actionable intelligence directly to field officers.

* One-click voice summaries
* AI-generated operational briefings
* WhatsApp-based dispatch alerts
* Hands-free traffic management

---

### 🗺️ Interactive Event Map

Live operational visualization of:

* Events
* Diversions
* Barricades
* Congestion zones
* High-risk junctions

---

### 📊 Traffic Intelligence Dashboard

Mission Control for city-wide traffic operations.

Monitor:

* Active incidents
* Predicted delays
* Congestion severity
* Resource utilization
* Operational alerts

---

## 🏗️ System Architecture

GridLock integrates multiple data sources:

* Historical Traffic Data
* Weather Data
* Event Schedules
* Real-Time Incident Reports
* Road Network Data

These sources feed into predictive ML models and simulation engines to generate actionable traffic intelligence.

---

## 🚀 Technology Stack

### Frontend

* React.js
* Google Maps API
* Tailwind CSS

### Backend

* FastAPI
* Python

### Machine Learning

* Scikit-Learn
* XGBoost
* Graph-Based Congestion Modeling
* BFS Propagation Engine

### Deployment

* Google Cloud Platform

---

## 💡 How GridLock is Different

| Traditional Systems      | GridLock                             |
| ------------------------ | ------------------------------------ |
| Detect congestion        | Predict congestion                   |
| Reactive response        | Proactive planning                   |
| Static diversions        | AI-generated diversion strategies    |
| Manual resource planning | Automated deployment recommendations |
| Current traffic view     | Future traffic forecasting           |

---

## 🎯 Impact

GridLock helps authorities:

* Reduce congestion duration
* Improve emergency response times
* Optimize resource allocation
* Minimize economic losses caused by traffic delays
* Enhance commuter experience

---

## ⚙️ Project Structure

```
Flipkartgridlock/
├── backend/
│   ├── main.py              # FastAPI application server, endpoints & logic
│   ├── retrain_job.py       # Daily 2:00 AM Cron/Scheduler job for model retraining
│   ├── requirements.txt     # Python dependencies (FastAPI, scikit-learn, pandas)
│   └── .env                 # Environment variables (API keys)
├── frontend/
│   ├── src/                 # React UI Components, Maps, and Views
│   ├── package.json         # React + Vite dependencies & script commands
│   ├── vite.config.js       # Vite build configurations
│   └── README.md            # Frontend template notes
├── features_and_ml_logic.md # Detailed architecture and engineering documentation
└── README.md                # Project main documentation (this file)
```

---

## 🚀 Setup & Execution Guide

### 1. Backend Setup (FastAPI)
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a virtual environment:
   ```bash
   python -m venv .venv
   # Windows
   .venv\Scripts\activate
   # macOS/Linux
   source .venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file in the `backend/` directory:
   ```env
   GROQ_API_KEY=your_groq_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   TWILIO_ACCOUNT_SID=your_twilio_sid_here
   TWILIO_AUTH_TOKEN=your_twilio_token_here
   ```
5. Run the FastAPI development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### 2. Frontend Setup (React + Vite)
1. Navigate to the frontend directory:
   ```bash
   cd ../frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Run the frontend development server:
   ```bash
   npm run dev
   ```
4. Open the displayed local address (typically `http://localhost:5173`) in your browser.

### 3. Nightly Retraining
The backend server runs an automatic daily cron task scheduled at **02:00 AM** that:
1. Syncs feedback entries from `feedback_log.csv`.
2. Appends records to the main dataset.
3. Refits Target Encoders & Label Encoders.
4. Retrains and validates the `GradientBoosting` and `RandomForest` estimators.
5. Performs a hot-swap in memory with zero server downtime.
