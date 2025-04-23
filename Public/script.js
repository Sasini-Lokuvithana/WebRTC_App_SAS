// DOM elements
const localVideo = document.getElementById('localVideo');
const videoContainer = document.getElementById('videoContainer');
const muteButton = document.getElementById('muteButton');
const videoButton = document.getElementById('videoButton');
const shareScreenButton = document.getElementById('shareScreen');
const messageInput = document.getElementById('messageInput');
const sendMessageButton = document.getElementById('sendMessage');
const chatMessages = document.getElementById('chatMessages');
const roomNameInput = document.getElementById('roomName');
const userNameInput = document.getElementById('userName');
const joinRoomButton = document.getElementById('joinRoom');
const leaveRoomButton = document.getElementById('leaveRoom');
const joinDialog = document.getElementById('joinDialog');
const conferenceContainer = document.getElementById('conferenceContainer');
const chatPanel = document.getElementById('chatPanel');
const chatButton = document.getElementById('chatButton');
const closeChatButton = document.getElementById('closeChatButton');

// Global variables
let localStream;
let screenStream;
let peerConnections = {};
let socket;
let roomName = '';
let userName = '';
let participants = new Map();
let unreadMessages = 0;

// Initialize
async function init() {
    try {
        // Request camera and microphone permissions immediately
        localStream = await navigator.mediaDevices.getUserMedia({
            video: {
                width: { ideal: 1280 },
                height: { ideal: 720 },
                facingMode: "user"
            },
            audio: {
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true
            }
        });

        // Set up local video
        localVideo.srcObject = localStream;
        
        // Add name overlay to local video
        const localOverlay = document.querySelector('.local-video-container .video-overlay');
        if (localOverlay) {
            localOverlay.innerHTML = '<span class="participant-name">You</span>';
        }
        
        console.log('Camera initialized successfully');

    } catch (err) {
        console.error('Error initializing camera:', err);
        alert('Please allow camera and microphone access to use this app');
    }

    // Set up event listeners
    joinRoomButton.addEventListener('click', joinRoom);
    leaveRoomButton.addEventListener('click', leaveRoom);
    muteButton.addEventListener('click', toggleMute);
    videoButton.addEventListener('click', toggleVideo);
    shareScreenButton.addEventListener('click', toggleScreenShare);
    sendMessageButton.addEventListener('click', sendMessage);
    chatButton.addEventListener('click', toggleChat);
    closeChatButton.addEventListener('click', toggleChat);
    
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') sendMessage();
    });

    // Initially hide chat panel
    chatPanel.style.display = 'none';
    videoContainer.style.marginLeft = '0';
}

function toggleChat() {
    const chatPanel = document.getElementById('chatPanel');
    const videoContainer = document.getElementById('videoContainer');
    const chatButton = document.getElementById('chatButton');
    
    if (!chatPanel.classList.contains('open')) {
        chatPanel.classList.add('open');
        videoContainer.classList.add('chat-open');
        chatButton.classList.add('active');
        chatPanel.style.display = 'flex';
        // Reset unread messages when opening chat
        unreadMessages = 0;
        updateNotificationBadge();
    } else {
        chatPanel.classList.remove('open');
        videoContainer.classList.remove('chat-open');
        chatButton.classList.remove('active');
        chatPanel.style.display = 'none';
    }
}

function updateNotificationBadge() {
    const chatButton = document.getElementById('chatButton');
    let badge = chatButton.querySelector('.notification-badge');
    
    if (!badge) {
        badge = document.createElement('span');
        badge.className = 'notification-badge';
        chatButton.appendChild(badge);
    }
    
    if (unreadMessages > 0) {
        badge.textContent = unreadMessages;
        badge.classList.add('show');
    } else {
        badge.classList.remove('show');
    }
}

async function joinRoom() {
    roomName = roomNameInput.value.trim();
    userName = userNameInput.value.trim();

    if (!roomName || !userName) {
        alert('Please enter both your name and a room name');
        return;
    }

    try {
        // Get user media first
        if (!localStream) {
            localStream = await navigator.mediaDevices.getUserMedia({
                video: {
                    width: { ideal: 1280 },
                    height: { ideal: 720 },
                    facingMode: "user"
                },
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true
                }
            });
            localVideo.srcObject = localStream;
        }

        // Initialize socket connection
        socket = io('http://localhost:3001');
        setupSocketEvents();

        // Join the room
        socket.emit('join', roomName, userName);

        // Update UI
        joinDialog.style.display = 'none';
        conferenceContainer.style.display = 'flex';
        
        // Don't show chat panel automatically
        chatPanel.style.display = 'none';
        videoContainer.classList.remove('chat-open');
        chatButton.classList.remove('active');
        
        // Setup chat events
        setupChatEvents();
        
        // Add welcome message
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        addMessage('System', `Welcome to the room, ${userName}!`, timestamp, false);
        
        // Update local video name display
        const localOverlay = document.querySelector('.local-video-container .video-overlay');
        if (localOverlay) {
            localOverlay.innerHTML = `<span class="participant-name">${userName} (You)</span>`;
        }
        
        // Initialize participants list with current user
        updateParticipantsList();
        
        console.log('Successfully joined room:', roomName, 'as:', userName);

    } catch (err) {
        console.error('Error joining room:', err);
        alert('Could not join the room. Please check your camera and microphone permissions.');
    }
}

function updateParticipantsList() {
    const participantsList = document.getElementById('participantsList');
    const participantCount = document.getElementById('participantCount');
    
    // Clear current list
    participantsList.innerHTML = '';
    
    // Add current user first
    const youItem = document.createElement('div');
    youItem.className = 'participant-item you';
    youItem.innerHTML = `
        <i class="fas fa-user"></i>
        <span>${userName} (You)</span>
    `;
    participantsList.appendChild(youItem);
    
    // Add other participants
    participants.forEach((name, id) => {
        const item = document.createElement('div');
        item.className = 'participant-item';
        item.innerHTML = `
            <i class="fas fa-user"></i>
            <span>${name}</span>
        `;
        participantsList.appendChild(item);
    });
    
    // Update participant count
    participantCount.textContent = participants.size + 1; // +1 for current user
}

function setupSocketEvents() {
    socket.on('existing-users', async (existingUsers) => {
        console.log('Existing users:', existingUsers);
        // Add existing users to participants map
        Object.entries(existingUsers).forEach(([userId, userName]) => {
            participants.set(userId, userName);
        });
        updateParticipantsList();
        
        // Create connections with existing users and send offers immediately
        for (const [userId, userName] of Object.entries(existingUsers)) {
            console.log('Setting up connection with existing user:', userId, userName);
            if (!peerConnections[userId]) {
                try {
                    const pc = await createPeerConnection(userId);
                    peerConnections[userId].userName = userName;
                    console.log('Created peer connection for existing user:', userId, 'with name:', userName);
                    await createAndSendOffer(userId);
                } catch (err) {
                    console.error('Error setting up connection with existing user:', err);
                }
            }
        }
    });

    socket.on('user-connected', async (userId, remoteUserName) => {
        console.log('New user connected:', userId, remoteUserName);
        // Add new user to participants map
        participants.set(userId, remoteUserName);
        updateParticipantsList();
        
        try {
            if (!peerConnections[userId]) {
                const pc = await createPeerConnection(userId);
                peerConnections[userId].userName = remoteUserName;
                console.log('Created peer connection for new user:', userId, 'with name:', remoteUserName);
                setTimeout(async () => {
                    try {
                        await createAndSendOffer(userId);
                    } catch (err) {
                        console.error('Error creating offer for new user:', err);
                    }
                }, 1000);
            }
        } catch (err) {
            console.error('Error handling new user connection:', err);
        }
    });

    socket.on('offer', async (userId, offer) => {
        console.log('Received offer from:', userId);
        try {
            if (!peerConnections[userId]) {
                await createPeerConnection(userId);
            }
            const pc = peerConnections[userId];
            if (pc.signalingState !== "stable") {
                console.log('Signaling state is not stable, waiting...');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
            await pc.setRemoteDescription(new RTCSessionDescription(offer));
            const answer = await pc.createAnswer();
            await pc.setLocalDescription(answer);
            socket.emit('answer', userId, answer);
        } catch (err) {
            console.error('Error handling offer:', err);
        }
    });

    socket.on('answer', async (userId, answer) => {
        console.log('Received answer from:', userId);
        try {
            const pc = peerConnections[userId];
            if (pc) {
                await pc.setRemoteDescription(new RTCSessionDescription(answer));
                console.log('Successfully set remote description from answer');
            }
        } catch (err) {
            console.error('Error handling answer:', err);
        }
    });

    socket.on('ice-candidate', async (userId, candidate) => {
        try {
            const pc = peerConnections[userId];
            if (pc) {
                await pc.addIceCandidate(new RTCIceCandidate(candidate));
                console.log('Successfully added ICE candidate');
            }
        } catch (err) {
            console.error('Error adding ICE candidate:', err);
        }
    });

    socket.on('user-disconnected', (userId) => {
        console.log('User disconnected:', userId);
        // Remove user from participants map
        participants.delete(userId);
        updateParticipantsList();
        
        if (peerConnections[userId]) {
            peerConnections[userId].close();
            delete peerConnections[userId];
            removeVideoElement(userId);
            updateVideoLayout();
        }
    });

    socket.on('chat-message', (sender, message, timestamp) => {
        addMessage(sender, message, timestamp, false);
    });
}

// Helper function to create and send an offer
async function createAndSendOffer(userId) {
    try {
        if (peerConnections[userId] && localStream) {
            const offer = await peerConnections[userId].createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            await peerConnections[userId].setLocalDescription(offer);
            console.log('Sending offer to:', userId);
            socket.emit('offer', userId, offer);
        }
    } catch (err) {
        console.error('Error creating offer:', err);
    }
}

async function createPeerConnection(userId) {
    try {
        console.log('Creating peer connection for user:', userId);
        
        const configuration = {
            iceServers: [
                { urls: 'stun:stun.l.google.com:19302' },
                { urls: 'stun:stun1.l.google.com:19302' },
                { 
                    urls: 'turn:numb.viagenie.ca',
                    username: 'webrtc@live.com',
                    credential: 'muazkh'
                }
            ],
            iceCandidatePoolSize: 10,
            bundlePolicy: 'max-bundle',
            rtcpMuxPolicy: 'require',
            iceTransportPolicy: 'all'
        };

        const peerConnection = new RTCPeerConnection(configuration);
        peerConnections[userId] = peerConnection;

        // Add local stream tracks to the peer connection
        if (localStream) {
            console.log('Adding local stream tracks to peer connection for user:', userId);
            localStream.getTracks().forEach(track => {
                console.log('Adding track:', track.kind, 'to peer connection');
                const sender = peerConnection.addTrack(track, localStream);
                
                // Handle track replacement for screen sharing
                sender.track.onended = () => {
                    console.log('Track ended, replacing with camera track');
                    if (localStream) {
                        const newTrack = localStream.getTracks().find(t => t.kind === track.kind);
                        if (newTrack) {
                            sender.replaceTrack(newTrack);
                        }
                    }
                };
            });
        }

        // Handle ICE candidates
        peerConnection.onicecandidate = (event) => {
            if (event.candidate) {
                console.log('Sending ICE candidate to:', userId);
                socket.emit('ice-candidate', userId, event.candidate);
            }
        };

        // Handle connection state changes
        peerConnection.onconnectionstatechange = () => {
            console.log(`Connection state for ${userId}:`, peerConnection.connectionState);
            if (peerConnection.connectionState === 'connected') {
                console.log(`Successfully connected to ${userId}`);
            }
        };

        // Handle ICE connection state changes
        peerConnection.oniceconnectionstatechange = () => {
            console.log(`ICE connection state for ${userId}:`, peerConnection.iceConnectionState);
            if (peerConnection.iceConnectionState === 'failed') {
                console.log('ICE connection failed, attempting to restart');
                peerConnection.restartIce();
            }
        };

        // Handle remote stream
        peerConnection.ontrack = (event) => {
            console.log('Received remote track from:', userId);
            console.log('Track kind:', event.track.kind);
            console.log('Streams:', event.streams.length);
            
            if (event.streams && event.streams[0]) {
                console.log('Adding video element for remote stream');
                addVideoElement(userId, event.streams[0]);
            }
        };

        return peerConnection;
    } catch (err) {
        console.error('Error creating peer connection:', err);
        throw err;
    }
}

function addVideoElement(userId, stream) {
    console.log('Adding video element for user:', userId, 'with stream:', stream);
    
    // Remove any existing video element for this user
    removeVideoElement(userId);

    const videoContainer = document.createElement('div');
    videoContainer.className = 'remote-video';
    videoContainer.id = `video-container-${userId}`;

    const video = document.createElement('video');
    video.id = `video-${userId}`;
    video.autoplay = true;
    video.playsInline = true;
    video.srcObject = stream;
    video.style.width = '100%';
    video.style.height = '100%';
    video.style.objectFit = 'cover';

    // Add event listeners for video errors
    video.onerror = (error) => {
        console.error('Video error for user:', userId, error);
    };

    video.onloadedmetadata = () => {
        console.log('Video metadata loaded for user:', userId);
        video.play().catch(err => {
            console.warn('Error playing video for user:', userId, err);
            // Add click-to-play functionality
            video.addEventListener('click', () => {
                video.play().catch(console.error);
            });
        });
    };

    const overlay = document.createElement('div');
    overlay.className = 'video-overlay';
    // Get the user's name from the peerConnections object
    const displayName = peerConnections[userId]?.userName || 'Unknown User';
    overlay.innerHTML = `<span class="participant-name">${displayName}</span>`;

    videoContainer.appendChild(video);
    videoContainer.appendChild(overlay);
    document.getElementById('videoContainer').appendChild(videoContainer);

    // Update grid layout based on number of participants
    updateVideoLayout();

    // Log the video element creation
    console.log('Created video element for user:', userId, 'with name:', displayName);
}

function updateVideoLayout() {
    const videoContainer = document.getElementById('videoContainer');
    const videos = videoContainer.getElementsByClassName('remote-video');
    const totalParticipants = videos.length + 1; // +1 for local video

    console.log('Updating video layout for', totalParticipants, 'participants');

    // Calculate optimal grid layout
    let columns;
    if (totalParticipants <= 2) {
        columns = 1;
    } else if (totalParticipants <= 4) {
        columns = 2;
    } else if (totalParticipants <= 9) {
        columns = 3;
    } else {
        columns = Math.ceil(Math.sqrt(totalParticipants));
    }

    // Update grid template
    videoContainer.style.gridTemplateColumns = `repeat(${columns}, 1fr)`;
    
    // Update each video container's aspect ratio
    Array.from(videos).forEach(videoContainer => {
        videoContainer.style.height = '0';
        videoContainer.style.paddingBottom = '56.25%'; // 16:9 aspect ratio
    });

    // Update local video container size based on number of participants
    const localVideoContainer = document.querySelector('.local-video-container');
    if (localVideoContainer) {
        if (totalParticipants > 4) {
            localVideoContainer.style.width = '160px';
            localVideoContainer.style.height = '90px';
        } else {
            localVideoContainer.style.width = '240px';
            localVideoContainer.style.height = '135px';
        }
    }
}

function removeVideoElement(userId) {
    const videoContainer = document.getElementById(`video-container-${userId}`);
    if (videoContainer) {
        videoContainer.remove();
        updateVideoLayout();
    }
}

function toggleMute() {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            audioTrack.enabled = !audioTrack.enabled;
            muteButton.innerHTML = audioTrack.enabled ? 
                '<i class="fas fa-microphone"></i>' : 
                '<i class="fas fa-microphone-slash"></i>';
        }
    }
}

function toggleVideo() {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            videoTrack.enabled = !videoTrack.enabled;
            videoButton.innerHTML = videoTrack.enabled ? 
                '<i class="fas fa-video"></i>' : 
                '<i class="fas fa-video-slash"></i>';
        }
    }
}

async function toggleScreenShare() {
    try {
        if (!screenStream) {
            screenStream = await navigator.mediaDevices.getDisplayMedia({
                video: true
            });
            
            const videoTrack = screenStream.getVideoTracks()[0];
            
            // Replace video track in all peer connections
            for (const userId in peerConnections) {
                const sender = peerConnections[userId]
                    .getSenders()
                    .find(s => s.track.kind === 'video');
                    
                if (sender) {
                    sender.replaceTrack(videoTrack);
                }
            }
            
            // Update local video
            localVideo.srcObject = screenStream;
            
            // Listen for screen share stop
            videoTrack.onended = () => {
                stopScreenShare();
            };
            
            shareScreenButton.innerHTML = '<i class="fas fa-desktop"></i> Stop';
        } else {
            stopScreenShare();
        }
    } catch (err) {
        console.error('Error sharing screen:', err);
        alert('Could not share screen');
    }
}

function stopScreenShare() {
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
        screenStream = null;
        
        // Restore camera video
        const videoTrack = localStream.getVideoTracks()[0];
        
        // Replace video track in all peer connections
        for (const userId in peerConnections) {
            const sender = peerConnections[userId]
                .getSenders()
                .find(s => s.track.kind === 'video');
                
            if (sender) {
                sender.replaceTrack(videoTrack);
            }
        }
        
        // Update local video
        localVideo.srcObject = localStream;
        shareScreenButton.innerHTML = '<i class="fas fa-desktop"></i>';
    }
}

function sendMessage() {
    const messageInput = document.getElementById('messageInput');
    const message = messageInput.value.trim();
    if (message && socket) {
        const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        socket.emit('chat-message', userName, message, timestamp, roomName);
        addMessage(userName, message, timestamp, true);
        messageInput.value = '';
    }
}

function addMessage(sender, message, timestamp, isSent = false) {
    const chatMessages = document.getElementById('chatMessages');
    const messageElement = document.createElement('div');
    messageElement.className = `message ${isSent ? 'sent' : 'received'}`;
    
    // Only show sender name for received messages
    const senderHtml = isSent ? '' : `<span class="sender">${sender}</span>`;
    
    messageElement.innerHTML = `
        ${senderHtml}
        <div class="content">${message}</div>
        <span class="time">${timestamp}</span>
    `;
    
    chatMessages.appendChild(messageElement);
    
    // Scroll to the latest message
    messageElement.scrollIntoView({ behavior: 'smooth' });
    
    // Increment unread messages if chat is closed and message is received
    if (!isSent && !chatPanel.classList.contains('open')) {
        unreadMessages++;
        updateNotificationBadge();
    }
}

function setupChatEvents() {
    const messageInput = document.getElementById('messageInput');
    messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Focus input when chat is opened
    const chatButton = document.getElementById('chatButton');
    chatButton.addEventListener('click', () => {
        setTimeout(() => {
            messageInput.focus();
        }, 100);
    });
}

function leaveRoom() {
    if (socket) {
        socket.emit('leave', roomName, userName);
        socket.disconnect();
    }

    // Stop all media tracks
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    if (screenStream) {
        screenStream.getTracks().forEach(track => track.stop());
    }

    // Close all peer connections
    for (const userId in peerConnections) {
        peerConnections[userId].close();
    }
    peerConnections = {};

    // Clear video container
    videoContainer.innerHTML = '';
    localVideo.srcObject = null;

    // Reset UI
    conferenceContainer.style.display = 'none';
    joinDialog.style.display = 'block';
    chatPanel.style.display = 'none';
    roomNameInput.value = '';
    userNameInput.value = '';
}

// Start the application
init();