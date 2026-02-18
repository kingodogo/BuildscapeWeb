# Buildscape Bug Tracker

A modern bug tracking and issue management system for the Buildscape Minecraft mod. Built with React, TypeScript, and MongoDB Atlas.

## Features

- 🐛 **Bug Reporting** - Submit and track bug reports with detailed information
- 👥 **User Management** - User authentication with role-based access control
- 📊 **Admin Panel** - Manage reports, users, and configuration
- ☁️ **Cloud Storage** - All data stored in MongoDB Atlas (no local storage)
- 🎨 **Modern UI** - Clean, responsive design with Tailwind CSS

## Tech Stack

- **Frontend:** React, TypeScript, Vite, Tailwind CSS
- **Backend:** Vercel Serverless Functions
- **Database:** MongoDB Atlas
- **Deployment:** Vercel

## Getting Started

### Prerequisites

- Node.js 20.x
- MongoDB Atlas account
- Vercel account (for deployment)

### Local Development

1. Clone the repository:
```bash
git clone https://github.com/kingodogo/BuildScape-Web.git
cd BuildScape-Web
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
Create a `.env.local` file:
```
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/buildscape_tracker?retryWrites=true&w=majority
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your-secure-password
ADMIN_EMAIL=admin@buildscape.com
```

4. Run development server:
```bash
npm run dev
```

For full API testing (requires Vercel CLI):
```bash
npm run dev:api
```

### Deployment

1. Push to GitHub
2. Connect repository to Vercel
3. Set environment variables in Vercel dashboard:
   - `MONGODB_URI` - Your MongoDB Atlas connection string
   - `ADMIN_USERNAME` - Admin account username (optional, defaults to 'admin')
   - `ADMIN_PASSWORD` - Admin account password
   - `ADMIN_EMAIL` - Admin account email (optional)

4. Deploy!

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `MONGODB_URI` | MongoDB Atlas connection string | Yes |
| `ADMIN_USERNAME` | Admin account username | No (defaults to 'admin') |
| `ADMIN_PASSWORD` | Admin account password | No |
| `ADMIN_EMAIL` | Admin account email | No |

## Project Structure

```
├── api/              # Vercel serverless functions
│   ├── auth.ts       # Authentication endpoints
│   ├── data.ts       # Bug reports and config endpoints
│   └── db.ts         # MongoDB connection
├── components/       # React components
├── services/         # API service layers
├── types.ts          # TypeScript type definitions
└── App.tsx           # Main application component
```

## License

Private project - All rights reserved

