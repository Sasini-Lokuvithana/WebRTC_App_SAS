# Real-Time Video Conferencing Application with WebRTC

A real-time video conferencing application built using WebRTC technology that enables peer-to-peer communication with features such as video, audio, and text chat.

## Features

- Multi-user video conferencing
- Real-time text chat
- Audio mute/unmute functionality
- Video toggle on/off
- Screen sharing capability
- Room-based communication
- Modern, responsive UI

## Technologies Used

- WebRTC for peer-to-peer communication
- Socket.IO for signaling
- Node.js and Express for the backend server
- Pure JavaScript for frontend functionality
- HTML5 and CSS3 for the user interface

## Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/webrtc-video-conference.git
cd webrtc-video-conference
```

2. Install dependencies:
```bash
npm install
```

3. Start the server:
```bash
npm run dev
```

4. Open your browser and navigate to:
```
http://localhost:3001
```

## Usage

1. Enter a room name and click "Join Room"
2. Share the room name with others you want to connect with
3. Use the control buttons to:
   - Mute/unmute your audio
   - Toggle your video on/off
   - Share your screen
   - Send text messages in the chat

## Architecture

The application uses a client-server architecture where:
- The server handles signaling using Socket.IO
- WebRTC handles the peer-to-peer connections for video/audio streaming
- The frontend manages the UI and user interactions

### Key Components:
- Signaling server (Node.js + Socket.IO)
- WebRTC peer connections
- Media stream handling
- Room management
- Chat functionality

## Development

To run the application in development mode:
```bash
npm run dev
```

This will start the server with nodemon for automatic reloading on file changes.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- WebRTC.org for the technology and documentation
- Socket.IO team for the real-time engine
- The open-source community for various tools and libraries 