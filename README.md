# GK Sky Admin Portal & Live Visitor Analytics

Live visitor tracking and executive analytics dashboard for [gksky.in](https://gksky.in), inspired by the session journey tracking system in `green-admin`.

---

## 🚀 Features

- **Live Visitor Tracking**: Real-time stream of active visitors on `gksky.in`.
- **Session Journeys**: Step-by-step visual timeline tracking pages visited, button clicks (Telegram, Email, Copy Address), and time spent.
- **Device & Environment Intelligence**: Detects OS (Windows, macOS, iOS, Android), Browser (Chrome, Safari, Edge, Firefox), and Device type (Mobile, Desktop, Tablet).
- **Date Filtering**: Quick round-border day pills (Today, Yesterday, Last 7 Days, or custom date picker) with chronological (morning-to-evening) sorting.
- **Audio Chime**: Live audio chime alerts (Web Audio API) when a new visitor arrives.
- **Password Protected**: Simple, secure password lock matching `green-admin` (`romeoPistol` or custom).
- **MongoDB Persisted**: Stores full session journeys in MongoDB via Mongoose.

---

## 🛠️ Tech Stack

- **Next.js 16** (App Router)
- **TypeScript** & **Tailwind CSS**
- **MongoDB** / **Mongoose**
- **Lucide React Icons**

---

## ⚙️ Environment Variables

Create `.env.local`:

```env
# MongoDB Connection String
MONGO_URL=mongodb+srv://skygamer2k25_db_user:lw0Z6V4bnlGuFzMZ@greene.sqz5lxl.mongodb.net/gksky?retryWrites=true&w=majority&authSource=admin

# Admin Portal Password
ADMIN_PASSWORD=romeoPistol

# Main Website URL
NEXT_PUBLIC_GKSKY_URL=https://gksky.in
```

---

## 🏃 Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev -- -p 3001

# Production build
npm run build
npm start
```

Default admin password: `romeoPistol`
