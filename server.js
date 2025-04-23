const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();

// Enable CORS
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-sControl-Allow-Methods', 'GET, POST, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
    next();
});

const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files from the public directory
app.use(express.static(path.join(__dirname, 'Public')));

// Add error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

// Add a test route
app.get('/', (req, res) => {
    try {
        console.log('Received request for root path');
        res.sendFile(path.join(__dirname, 'Public', 'index.html'));
    } catch (error) {
        console.error('Error serving index.html:', error);
        res.status(500).send('Error loading page');
    }
});

const MAX_ROOM_CAPACITY = 50;

const rooms = {};
const userNames = {};

io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);
    
    let currentRoom = null;
    let currentUser = null;
    
    socket.on('join', (roomName, userName) => {
        currentRoom = roomName;
        currentUser = userName;
        userNames[socket.id] = userName;
        
        if (!rooms[roomName]) {
            rooms[roomName] = new Set();
        }
        
        if (rooms[roomName].size >= MAX_ROOM_CAPACITY) {
            socket.emit('room-full', roomName);
            return;
        }

        // Get existing users' names
        const existingUsers = {};
        rooms[roomName].forEach(userId => {
            if (userNames[userId]) {  // Only include users that are still connected
                existingUsers[userId] = userNames[userId];
            }
        });

        // Clean up any disconnected users
        rooms[roomName].forEach(userId => {
            if (!userNames[userId]) {
                rooms[roomName].delete(userId);
            }
        });

        // Add user to room
        rooms[roomName].add(socket.id);
        socket.join(roomName);
        
        // Send existing users to the new participant
        socket.emit('existing-users', existingUsers);
        
        // Notify other users about the new user
        socket.to(roomName).emit('user-connected', socket.id, userName);
        
        console.log(`${userName} joined room ${roomName} (${rooms[roomName].size} participants)`);
        console.log('Current users in room:', Array.from(rooms[roomName]));
    });
    
    socket.on('offer', (targetId, offer) => {
        if (userNames[targetId]) {  // Only forward if target user exists
            console.log(`Forwarding offer: ${socket.id} -> ${targetId}`);
            socket.to(targetId).emit('offer', socket.id, offer);
        }
    });
    
    socket.on('answer', (targetId, answer) => {
        if (userNames[targetId]) {  // Only forward if target user exists
            console.log(`Forwarding answer: ${socket.id} -> ${targetId}`);
            socket.to(targetId).emit('answer', socket.id, answer);
        }
    });
    
    socket.on('ice-candidate', (targetId, candidate) => {
        if (userNames[targetId]) {  // Only forward if target user exists
            console.log(`Forwarding ICE candidate: ${socket.id} -> ${targetId}`);
            socket.to(targetId).emit('ice-candidate', socket.id, candidate);
        }
    });
    
    socket.on('chat-message', (userName, message, timestamp, roomName) => {
        socket.to(roomName).emit('chat-message', userName, message, timestamp);
    });
    
    socket.on('disconnect', () => {
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom].delete(socket.id);
            if (rooms[currentRoom].size === 0) {
                delete rooms[currentRoom];
            }
            socket.to(currentRoom).emit('user-disconnected', socket.id);
            delete userNames[socket.id];
            console.log(`${currentUser} disconnected from ${currentRoom}`);
            if (rooms[currentRoom]) {
                console.log(`Remaining users in room: ${Array.from(rooms[currentRoom])}`);
            }
        }
    });
});

const PORT = process.env.PORT || 3001;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    console.log(`Try accessing: http://localhost:${PORT}`);
    console.log(`Static files are being served from: ${path.join(__dirname, 'Public')}`);
});