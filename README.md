<h1 align="center">KanDo Kanban Board</h1>

<p align="center">
  An open-source, self-hosted kanban management tool — a lightweight alternative to Trello and Notion.
</p>

---

## 🚀 Features
- Self-hosted and open-source
- Built with **Next.js**, **Firebase**, and **TailwindCSS**
- Real-time updates with Firebase
- Simple and customizable UI

---


## 📦 Tech Stack

### Frontend
- **Core:** Next.js (15.4.1), React (19.1.0), React DOM (19.1.0)
- **Types:** @types/node (^20), @types/react (^19), @types/react-dom (^19)
- **Firebase Integration:** firebase (^12.0.0), react-firebase-hooks (^5.1.1)
- **Styling:** tailwindcss (^4), @tailwindcss/postcss (^4), lucide-react (^0.542.0)

### Backend
- **Core:** Node.js
- **Environment Management:** dotenv (^17.2.0)
- **Firebase:** firebase (^12.0.0)

## Testing
- **Jest:** jest (^30.1.1), jest-environment-jsdom (^30.1.1)
- **Babel:** @babel/preset-env (^7.28.3), @babel/preset-react (^7.27.1), @babel/preset-typescript (^7.27.1)
- **Testing Library:** @testing-library/jest-dom (^6.8.0), @testing-library/react (^16.3.0), @testing-library/user-event (^14.6.1)

---

## ⚙️ Installation & Setup

### 1. Clone the repository
```bash
git clone https://github.com/your-username/kando.git
cd kando
```

### 2. Frontend Setup
```bash
cd client
npm install
cp .env.example .env.local
```
- Update .env.local with your Firebase project credentials.
- Start the development server:
```bash
npm run dev
```

### 3. Backend Setup
```bash
cd ../server
npm install
cp .env.example .env
```
- Update `.env` with required environment variables. Copy from `.env.example`.
- To send email notifications, set SMTP vars (`SMTP_HOST`, `SMTP_FROM`, and usually `SMTP_USER` / `SMTP_PASS`). Port defaults to `587` (`465` uses TLS). Any SMTP provider works (for Gmail, use an [app password](https://support.google.com/accounts/answer/185833)). If SMTP is unset, in-app inbox notifications still work and emails are skipped.
- Set `FRONTEND_URL` to the client origin so email links and CORS match.
- Start the backend:
```bash
npm run dev
```

--- 

## 📚 Project Structure
```bash
kando/
├── client/     # Frontend (Next.js + TailwindCSS + Firebase)
├── server/     # Backend (Node.js + Firebase + dotenv)
└── README.md   # Project documentation
```

## 🤝 Contributing
Contributions are welcome!
- Fork the repo
- Create a feature branch (`git checkout -b feature/new-feature`)
- Commit your changes (`git commit -m "Add new feature"`)
- Push to your branch and open a PR

## 📄 License
This project is licensed under the [MIT License](https://choosealicense.com/licenses/mit/).