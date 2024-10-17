import express from 'express';
import dotenv from 'dotenv';
import bodyParser from 'body-parser';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import http from 'http';
import { Server } from 'socket.io';
import { DBProblem, Member } from './types';
import { Message } from 'postcss';

dotenv.config();
const app = express();
const server = http.createServer(app); // Create HTTP server
const io = new Server(server, {
    cors: {
        // origin: 'http://localhost:3000',
        origin: 'https://leetcollab.vercel.app',
        credentials: true,
        methods: ['GET', 'POST'],
    },
    // cors: {
    //     origin: '*', // Allow cross-origin requests (you can restrict this based on your client domain)
    // },
});

// Middleware
app.use(express.json());
app.use(helmet());
app.use(morgan('common'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

// Routes
// app.use('/user', userRoutes);
// app.use('/problem', problemRoutes);
// app.get('/', (req, res) => {
//     res.send('Socket.IO server is running');
// });
// app.get('/hello', (req, res) => {
//     res.send('Hello World!'); 
// });

type Room = {
    users: Member[] | null;
    selectedProblem: DBProblem | null;
    host: string;
    code: string;
    messages: Message[];
    whiteboard: any[];
};



// Temporary in-memory store for rooms and their passwords
// const rooms: { [key: string]: { password: string; users: string[] } } = {};
const rooms = new Map<string, Room>();

io.on('connection', (socket) => {
    // console.log('A user connected', socket.id);
    console.log('Socket connected');
    // display the rooms
    console.log("Rooms: ", rooms);
    
    // check the users in every room
    for (const [roomId, room] of Array.from(rooms.entries())) {
        console.log("Users in the room: ", room.users);
    }

    // Room creation
    socket.on('createRoom', ({ roomId, username, selectedProblem }, callback) => {
        // console.log('createRoom - Creating room: ', roomId);
        // console.log('createRoom - User: ', username);
        // console.log('createRoom - Selected problem: ', selectedProblem);
        // roomId = roomId;

        if (rooms.has(roomId)) {
            // callback({ success: false, message: 'Room already exists' });
            // console.log('createRoom - Room already exists: ', roomId);
            return;
        }

        socket.join(roomId);

        rooms.set(roomId, {
            users: [{username: username, isMuted: true}],
            selectedProblem,
            host: username,
            code: '',
            messages: [],
            whiteboard: []
        });

        const room = rooms.get(roomId);
        // console.log("createRoom - Room: ", room);
        
        // display the members of the room
        // console.log("createRoom - Members of the room: ", room?.users);

        io.to(roomId).emit('roomCreated', { roomId, username });
        callback({ success: true, roomId });
        // console.log("createRoom - Room created: ", roomId);
        io.to(roomId).emit('roomCreated', { roomId, username });
    });

    // Room checking
    socket.on('checkRoom', ({ roomId }, callback) => {
        // console.log("checkRoom called")
        // console.log('Checking room: ', roomId);
        // display the rooms
        console.log("Room: ", rooms);
        const room = rooms.get(roomId);
        if (room) {
            // console.log("Room exists: ", roomId);
            io.to(roomId).emit('roomExists', { roomId, selectedProblem: room.selectedProblem?.idTitle, host: room.host });
            callback({ success: true });
        } else {
            callback({ success: false, message: 'Room does not exist' });
        }
    });

    // Room joining
    socket.on('joinRoom', ({ roomId, username }, callback) => {
        console.log("joinRoom called")
        // console.log("joinRoom - Rooms: ", rooms)
        // console.log('joinRoom - Joining room: ', roomId, " User: ", username);
        
        if (rooms.has(roomId)) {
            // socket.join(roomId);
            const room = rooms.get(roomId);

            if (room) {
                socket.emit('chatHistory', room.messages);
                io.to(roomId).emit('updateMembers', room.users);
            }
            
            // // append the user to the room
            room?.users?.push({username: username, isMuted: true});
            // // console.log("joinRoom - Users in the room: ", room?.users);
            // callback({ success: true });
            // // console.log("joinRoom - User joined the room: ", roomId);
            
            
            
            // // console.log("joinRoom - Code: ", room?.users);

            io.to(roomId).emit('userJoined', { roomId, username, code: room?.code });

            // check for 'null' in users.username and remove them
            if (room?.users) {
                room.users = room.users.filter(user => user.username !== null);
            }

            // check for duplicate users.username in the room and remove them
            if (room?.users) {
                // room.users = room.users.filter((user, index, self) =>
                //     index === self.indexOf(user)
                // );
                room.users = room.users.filter((user, index, self) =>
                    index === self.findIndex((t) => (
                        t.username === user.username
                    ))
                );
            }

            // console.log("joinRoom - Users in the room: ", room?.users);
            // console.log("joinRoom - Host: ", room?.host);
            
            console.log("joinRoom - Users in the room after filter: ", room?.users);
            console.log("joinRoom - Selected problem: ", room?.selectedProblem?.idTitle);

            callback({ success: true, selectedProblem: room?.selectedProblem?.idTitle, host: room?.host });
            // io.to(roomId).emit('userJoined', { roomId, username });
        } else {
            // // console.log("joinRoom - Room does not exist: ", roomId);
            // io.to(roomId).emit('roomDoesNotExist', { roomId, username });
            callback({ success: false, message: 'Room does not exists' });
        }
    });

    // Get host
    socket.on('getHost', ({ roomId }, callback) => {
        // console.log("getHost called")
        // console.log("getHost - Rooms: ", rooms)
        // console.log('getHost - Getting host: ', roomId);
        const room = rooms.get(roomId);
        // // console.log("getHost - Host: ", room?.host);
        callback({ success: true, host: room?.host });
    });

    // Change problem
    socket.on('changeProblem', ({ roomId, problemId, selectedProblem, starterCode }, callback) => {
        // console.log("changeProblem called");
        // console.log("changeProblem - Rooms: ", rooms);
        // console.log('changeProblem - Changing problem: ', problemId, " in room: ", roomId);
        // console.log('changeProblem - Selected problem: ', selectedProblem);
        const room = rooms.get(roomId);
        if (room) {
            room.selectedProblem = selectedProblem; // Update this based on your Problem type
            room.code = starterCode;
            io.to(roomId).emit('problemChanged', { problemId, selectedProblem, starterCode });
            callback({ success: true });
        } else {
            callback({ success: false, message: 'Room not found' });
        }
    });

    // Check if user is in room
    socket.on('isUserInRoom', ({ username }, callback) => {
        // console.log("isUserInRoom called")
        // console.log("isUserInRoom - Rooms: ", rooms)

        let userRoom = null;
        let userRoomId = null;
        // Iterate through all rooms to find the user
        for (const [roomId, room] of Array.from(rooms.entries())) {
            // if (room.users && room.users.includes(username)) {
            //     userRoom = room;
            //     userRoomId = roomId;
            //     break;
            // }
            if (room.users && room.users.some(user => user.username === username)) {
                userRoom = room;
                userRoomId = roomId;
                break;
            }
        }
    
        if (userRoom) {
            // console.log(`User ${username} found in room ${userRoomId}`);

            // display the problem id title
            // console.log("isUserInRoom - Problem id title: ", userRoom.selectedProblem?.idTitle);

            callback({
                success: true,
                isInRoom: true,
                roomId: userRoomId,
                problemTitle: userRoom.selectedProblem?.idTitle
            });
        } else {
            // console.log(`User ${username} is not in any room`);
            callback({
                success: true,
                isInRoom: false,
                roomId: null,
                problemTitle: null
            });
        }
    });

    // Check if user is in a specific room
    socket.on('isUserInRoomId', ({ roomId, username }, callback) => {
        // console.log("isUserInRoomId called")
        // console.log("isUserInRoomId - Rooms: ", rooms)
        // console.log('isUserInRoomId - Checking if user is in room: ', roomId, " User: ", username);
        const room = rooms.get(roomId);
        if (room && room.users && room.users.some(user => user.username === username)) {
            callback({
                success: true,
                isInRoom: true,
                problemTitle: room.selectedProblem?.idTitle
            });
        } else {
            callback({
                success: false,
                isInRoom: false,
                message: 'User not found in the room'
            });
        }
    });
    

    // Room leaving
    socket.on('leaveRoom', ({ roomId, username }, callback) => {
        // console.log('leaveRoom - Leaving room: ', roomId, " User: ", username);
        socket.leave(roomId);

        const room = rooms.get(roomId);

        // find the user in the room and delete it
        // console.log("leaveRoom - Before deleting: Users in the room: ", room?.users);
        // console.log("leaveRoom - Socket ID: ", socket.id);
        if (room && room.users) {
            room.users = room.users.filter(user => user.username !== username);
            console.log("leaveRoom - Users in the room: ", room.users);
            io.to(roomId).emit('updateMembers', room.users);
        }
        // console.log("leaveRoom - After deleting: Users in the room: ", room?.users);

        // callback({ success: true });
        // io.to(roomId).emit('userLeft', { roomId, username });

        // console.log("leaveRoom - Members of the room: ", room?.users);

        // if the room is empty, delete it
        if (room?.users?.length === 0) {
            rooms.delete(roomId);
            // console.log("leaveRoom - Room deleted: ", roomId);
        }

        // if the room is not empty, emit the userLeft event
        if (room?.users && room.users.length > 0) {
            io.to(roomId).emit('userLeft', { roomId, username });
            // console.log("leaveRoom - User left the room: ", roomId);
        }

        // if the room is not empty and the user is the host, change the host to the next user in the room
        if (room?.users && room.users.length > 0 && room.host === username) {
            // room.host = room.users[0].username;

            // get the next user in the room
            room.host = room.users[0].username;

            console.log("leaveRoom - Host changed: ", roomId);
            console.log("leaveRoom - New host: ", room.host);
            io.to(roomId).emit('hostChanged', { roomId, newHost: room.host });
            // console.log("leaveRoom - Host changed: ", roomId);
            // console.log("leaveRoom - New host: ", room.host);
        }

        callback({ success: true });
        // console.log("leaveRoom - User left the room: ", roomId);
    });

    // Handle code change
    socket.on('codeChange', ({ roomId, code }) => {
        // // console.log("codeChange - Changing code: ", code, " in room: ", roomId);
        // const room = rooms.get(roomId);
        // if (room) {
        //     room.code = code;
        // }
        // socket.to(roomId).emit('codeChange', code);

        const room = rooms.get(roomId);
        if (room) {
            room.code = code;
        }

        // reflect the code change to all users in the room
        io.to(roomId).emit('codeChange', code);
    });

    // Handle submission
    socket.on('submitCode', ({ roomId, username }) => {
        if (rooms.has(roomId)) {
            const room = rooms.get(roomId);
            io.to(roomId).emit('submissionStart', username, room?.selectedProblem?.problemId);
        }
    });

    // Handle submission result
    socket.on('submissionResult', ({ roomId, success, message }) => {
        if (rooms.has(roomId)) {
            if (success) {
                io.to(roomId).emit('submissionSuccess', { message });
            } else {
                io.to(roomId).emit('submissionFailure', { message });
            }
        }
    });

    socket.on('submissionSuccess', ({ roomId, problemId }) => {
        const room = rooms.get(roomId);
        if (room) {
            // console.log("submissionSuccess - Updating solved status: ", problemId);
            io.to(roomId).emit('updateSolvedStatus', problemId );
        }
    });

    // Handle get latest code
    socket.on('getLatestCode', ({ roomId, starterCode }, callback) => {
        const room = rooms.get(roomId);
        if (room) {
            if (room.code && room.code.trim() !== '') {
                // console.log("getLatestCode - Returning stored code");
                callback({ code: room.code });
            } else {
                // console.log("getLatestCode - No stored code, returning starter code");
                room.code = starterCode;
                callback({ code: starterCode });
            }
        } else {
            // console.log("getLatestCode - Room not found, returning default code");
            callback({ code: '// Error, try refreshing the page' });
        }
    });

    // Handle submission message after submission of the code
    socket.on('submissionMessage', ({ roomId, message, type }) => {
        if (rooms.has(roomId)) {
            io.to(roomId).emit('submissionToast', { message, type });
        }
    });

    // Handle chat message
    socket.on('sendMessage', ({ roomId, message }) => {
        const room = rooms.get(roomId);
        if (room) {
            room.messages.push(message);
            io.to(roomId).emit('chatMessage', message);
        }
    });

    // Add a new handler for fetching chat history
    socket.on('getChatHistory', ({ roomId }, callback) => {
        const room = rooms.get(roomId);
        if (room) {
            callback(room.messages);
        } else {
            callback([]);
        }
    });

    // Handle drawing on the whiteboard
    socket.on('draw', ({ roomId, x, y, color, size, tool, isNewStroke }) => {
        const room = rooms.get(roomId);
        if (room) {
            room.whiteboard.push({ x, y, color, size, tool, isNewStroke });
            socket.to(roomId).emit('draw', { x, y, color, size, tool, isNewStroke });
        }
    });
    
    // Handle clear canvas
    socket.on('clearCanvas', ({ roomId }) => {
        const room = rooms.get(roomId);
        if (room) {
            room.whiteboard = [];
            io.to(roomId).emit('clearCanvas');
            io.to(roomId).emit('whiteboardStateUpdated', []);
        }
    });

    // Handle get whiteboard
    socket.on('getWhiteboardState', ({ roomId }, callback) => {
        const room = rooms.get(roomId);
        if (room) {
            callback(room.whiteboard);
        } else {
            callback([]);
        }
    });

    // Handle save whiteboard state
    socket.on('saveWhiteboardState', ({ roomId, state }) => {
        const room = rooms.get(roomId);
        if (room) {
            room.whiteboard = state;
        }
    });

    // Handle for getting the members of the room
    socket.on('getRoomMembers', ({ roomId }, callback) => {
        const room = rooms.get(roomId);
        if (room) {
            callback(room.users);
        } else {
            callback([]);
        }
    });

    // Handle mic toggle
    socket.on('toggleMic', ({ roomId, username }) => {
        const room = rooms.get(roomId);
        if (room) {
            const member = room.users?.find(user => user.username === username);
            if (member) {
                member.isMuted = !member.isMuted;
                io.to(roomId).emit('updateMembers', room.users);
            }
        }
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log(`User ${socket.id} disconnected`);
    });
});

const port = Number(process.env.PORT) || 3001;
server.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
