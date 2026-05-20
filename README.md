# Meetly

Meetly is a real-time video calling web app built as a personal project to explore modern video communication, WebRTC, authentication, screen sharing, and end-to-end encryption.

The idea started after Skype shut down. I used to rely on Skype for video calls, movie nights, and screen sharing, so I thought: why not try building my own version? Meetly is the result — a lightweight video meeting app focused on smooth calls, secure communication, and a clean user experience.

---

## Features

- Real-time video and audio calls
- Room-based meetings
- Screen sharing
- Speaker view
- Authentication flow
- End-to-end encryption enabled
- Responsive user interface
- Docker-based development setup
- Clean and minimal meeting experience

---

## Tech Stack

### Frontend

- React
- TypeScript
- Tailwind CSS

### Backend / Realtime

- Node.js
- WebRTC
- WebSocket / Socket-based signaling

### DevOps / Tooling

- Docker
- Docker Compose
- GitHub

---

## Why I Built This

I wanted to understand how video calling platforms work under the hood.

Meetly helped me learn and experiment with:

- WebRTC peer-to-peer communication
- Signaling between users
- Media streams
- Screen sharing
- Authentication flows
- Secure communication using end-to-end encryption
- Building a practical full-stack application

It was also partly motivated by nostalgia. Skype was one of those apps that felt simple and familiar, and after it shut down, I wanted to see if I could build something similar myself — especially with better screen sharing for things like watching movies together.

---

## Getting Started

### Prerequisites

Make sure you have the following installed:

- Node.js
- npm or yarn
- Docker Desktop
- Git

---

## Installation

Clone the repository:

```bash
git clone https://github.com/emmettfrankenstein/Meetly.git
cd meetly
```

Install dependencies:

```bash
npm install
```

Or, if the frontend and backend are separate:

```bash
cd client
npm install

cd ../server
npm install
```

---

## Running Locally

Start the development server:

```bash
npm run dev
```

Or with Docker:

```bash
docker compose up --build
```

Then open the app in your browser:

```txt
http://localhost:3000
```

---

## Environment Variables

Create a `.env` file in the required directory and add your configuration.

Example:

```env
PORT=3000
VITE_API_URL=http://localhost:5000
```

Update these values based on your local setup.

---

## Project Structure

```txt
meetly/
├── client/              # Frontend application
├── server/              # Backend / signaling server
├── docker-compose.yml   # Docker configuration
├── README.md
└── package.json
```

The structure may vary depending on the current version of the project.

---

## Current Status

Meetly is currently a learning-focused project and is still evolving.

Implemented so far:

- Video calling
- Screen sharing
- Authentication flow
- End-to-end encryption
- Docker setup

Planned improvements:

- Better meeting controls
- Improved UI polish
- Chat during meetings
- Meeting links
- Participant list
- Better error handling
- Deployment-ready configuration

---

## Lessons Learned

Building Meetly gave me a much better understanding of how real-time apps work.

Some key takeaways:

- WebRTC is powerful but requires careful signaling logic
- Screen sharing needs thoughtful UX handling
- Authentication and meeting state can become complex quickly
- Docker makes setup easier but debugging can still be dramatic
- Real-time apps are basically “everything works until one tiny thing refuses to shake hands”

---

## Contributing

This is mainly a personal learning project, but suggestions and improvements are welcome.

To contribute:

1. Fork the repository
2. Create a new branch
3. Make your changes
4. Open a pull request

---

## License

This project is open source and available under the MIT License.

---

## Author

Built by **Suriya Prakash**

GitHub: [https://github.com/emmettfrankenstein/](https://github.com/emmettfrankenstein/)

---

## Acknowledgements

Inspired by the simplicity of classic video calling apps and the curiosity to understand how real-time communication works from the inside.
