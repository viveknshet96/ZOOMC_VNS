import React, { useEffect, useRef, useState } from 'react';
import io from 'socket.io-client';
import { Badge, IconButton, TextField, Avatar, Chip } from '@mui/material';
import { Button } from '@mui/material';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import styles from '../styles/videoComponent.module.css';
import CallEndIcon from '@mui/icons-material/CallEnd';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import ScreenShareIcon from '@mui/icons-material/ScreenShare';
import StopScreenShareIcon from '@mui/icons-material/StopScreenShare';
import ChatIcon from '@mui/icons-material/Chat';
import FlipCameraAndroidIcon from '@mui/icons-material/FlipCameraAndroid';
import VolumeUpIcon from '@mui/icons-material/VolumeUp';
import VolumeOffIcon from '@mui/icons-material/VolumeOff';
import FullscreenIcon from '@mui/icons-material/Fullscreen';
import FullscreenExitIcon from '@mui/icons-material/FullscreenExit';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import PersonIcon from '@mui/icons-material/Person';
import server from '../environment';

const server_url = server;

var connections = {};

const peerConfigConnections = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
};

export default function VideoMeetComponent() {
    var socketRef = useRef();
    let socketIdRef = useRef();
    let localVideoref = useRef();
    let fullscreenRef = useRef();

    let [videoAvailable, setVideoAvailable] = useState(true);
    let [audioAvailable, setAudioAvailable] = useState(true);
    let [video, setVideo] = useState(false);
    let [audio, setAudio] = useState(false);
    let [screen, setScreen] = useState(false);
    let [showModal, setModal] = useState(false);
    let [screenAvailable, setScreenAvailable] = useState(true);
    let [messages, setMessages] = useState([]);
    let [message, setMessage] = useState('');
    let [newMessages, setNewMessages] = useState(0);
    let [askForUsername, setAskForUsername] = useState(true);
    let [username, setUsername] = useState('');
    let [isFullscreen, setIsFullscreen] = useState(false);
    let [isSpeakerOn, setIsSpeakerOn] = useState(true);
    let [currentCamera, setCurrentCamera] = useState('user'); // 'user' or 'environment'
    let [callDuration, setCallDuration] = useState(0);
    let [callStartTime, setCallStartTime] = useState(null);
    let [participantCount, setParticipantCount] = useState(1);
    let [showControls, setShowControls] = useState(true);
    let [controlsTimeout, setControlsTimeout] = useState(null);

    const videoRef = useRef([]);
    let [videos, setVideos] = useState([]);

    // Call duration timer
    useEffect(() => {
        let interval = null;
        if (callStartTime && !askForUsername) {
            interval = setInterval(() => {
                setCallDuration(Math.floor((Date.now() - callStartTime) / 1000));
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [callStartTime, askForUsername]);

    // Format call duration
    const formatDuration = (seconds) => {
        const hrs = Math.floor(seconds / 3600);
        const mins = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        if (hrs > 0) {
            return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        }
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    };

    // Auto-hide controls
    useEffect(() => {
        const handleMouseMove = () => {
            setShowControls(true);
            if (controlsTimeout) {
                clearTimeout(controlsTimeout);
            }
            const timeout = setTimeout(() => {
                setShowControls(false);
            }, 3000);
            setControlsTimeout(timeout);
        };

        document.addEventListener('mousemove', handleMouseMove);
        document.addEventListener('touchstart', handleMouseMove);

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('touchstart', handleMouseMove);
            if (controlsTimeout) {
                clearTimeout(controlsTimeout);
            }
        };
    }, [controlsTimeout]);

    // Helper functions for black video and silence audio
    const silence = () => {
        let ctx = new AudioContext();
        let oscillator = ctx.createOscillator();
        let dst = oscillator.connect(ctx.createMediaStreamDestination());
        oscillator.start();
        ctx.resume();
        return Object.assign(dst.stream.getAudioTracks()[0], { enabled: false });
    };

    const black = ({ width = 640, height = 480 } = {}) => {
        let canvas = Object.assign(document.createElement('canvas'), { width, height });
        canvas.getContext('2d').fillRect(0, 0, width, height);
        let stream = canvas.captureStream();
        return Object.assign(stream.getVideoTracks()[0], { enabled: false });
    };

    useEffect(() => {
        getPermissions();
    }, []);

    let getDislayMedia = () => {
        if (screen && screenAvailable) {
            if (navigator.mediaDevices.getDisplayMedia) {
                navigator.mediaDevices
                    .getDisplayMedia({ video: true, audio: true })
                    .then(getDislayMediaSuccess)
                    .catch((e) => {
                        console.log('Error getting display media:', e);
                        setScreen(false);
                    });
            }
        } else if (!screen) {
            getUserMedia();
        }
    };

    const getPermissions = async () => {
        try {
            const videoPermissionStream = await navigator.mediaDevices.getUserMedia({ video: true }).catch(() => null);
            if (videoPermissionStream) {
                setVideoAvailable(true);
                videoPermissionStream.getTracks().forEach(track => track.stop());
            } else {
                setVideoAvailable(false);
            }

            const audioPermissionStream = await navigator.mediaDevices.getUserMedia({ audio: true }).catch(() => null);
            if (audioPermissionStream) {
                setAudioAvailable(true);
                audioPermissionStream.getTracks().forEach(track => track.stop());
            } else {
                setAudioAvailable(false);
            }

            if (navigator.mediaDevices.getDisplayMedia) {
                setScreenAvailable(true);
            } else {
                setScreenAvailable(false);
            }

            const blackTrack = black();
            const silenceTrack = silence();
            blackTrack.enabled = false;
            silenceTrack.enabled = false;
            
            window.localStream = new MediaStream([blackTrack, silenceTrack]);
            if (localVideoref.current) {
                localVideoref.current.srcObject = window.localStream;
            }
        } catch (error) {
            console.log('Error getting permissions:', error);
            setVideoAvailable(false);
            setAudioAvailable(false);
            setScreenAvailable(false);
        }
    };

    useEffect(() => {
        if (!askForUsername) {
            getUserMedia();
        }
    }, [video, audio, askForUsername, currentCamera]);

    let getMedia = () => {
        setVideo(videoAvailable);
        setAudio(audioAvailable);
        setCallStartTime(Date.now());
        connectToSocketServer();
    };

    let getUserMediaSuccess = (stream) => {
        if (window.localStream) {
            window.localStream.getTracks().forEach((track) => track.stop());
        }

        window.localStream = stream;
        localVideoref.current.srcObject = stream;

        for (let id in connections) {
            if (id === socketIdRef.current) continue;
            
            const senders = connections[id].getSenders();
            senders.forEach(sender => {
                if (sender.track) {
                    connections[id].removeTrack(sender);
                }
            });

            stream.getTracks().forEach(track => {
                connections[id].addTrack(track, stream);
            });

            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }));
                    })
                    .catch((e) => console.log('Error setting local description:', e));
            });
        }

        stream.getTracks().forEach((track) => {
            track.onended = () => {
                if (track.kind === 'video') {
                    setVideo(false);
                }
                if (track.kind === 'audio') {
                    setAudio(false);
                }
                getUserMedia();
            };
        });
    };

    let getUserMedia = async () => {
        try {
            let videoTrack, audioTrack;

            if (video && videoAvailable) {
                const videoStream = await navigator.mediaDevices.getUserMedia({ 
                    video: { facingMode: currentCamera }
                });
                videoTrack = videoStream.getVideoTracks()[0];
                videoTrack.enabled = true;
            } else {
                videoTrack = black();
                videoTrack.enabled = false;
            }

            if (audio && audioAvailable) {
                const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
                audioTrack = audioStream.getAudioTracks()[0];
                audioTrack.enabled = true;
            } else {
                audioTrack = silence();
                audioTrack.enabled = false;
            }

            const newStream = new MediaStream([videoTrack, audioTrack]);
            getUserMediaSuccess(newStream);

        } catch (e) {
            console.log('Error in getUserMedia:', e);
            
            const blackTrack = black();
            const silenceTrack = silence();
            blackTrack.enabled = false;
            silenceTrack.enabled = false;
            
            const fallbackStream = new MediaStream([blackTrack, silenceTrack]);
            
            if (window.localStream) {
                window.localStream.getTracks().forEach(track => track.stop());
            }
            
            window.localStream = fallbackStream;
            if (localVideoref.current) {
                localVideoref.current.srcObject = fallbackStream;
            }
        }
    };

    let getDislayMediaSuccess = (stream) => {
        if (window.localStream) {
            window.localStream.getTracks().forEach((track) => track.stop());
        }

        window.localStream = stream;
        localVideoref.current.srcObject = stream;

        for (let id in connections) {
            if (id === socketIdRef.current) continue;

            const senders = connections[id].getSenders();
            senders.forEach(sender => {
                if (sender.track) {
                    connections[id].removeTrack(sender);
                }
            });

            stream.getTracks().forEach(track => {
                connections[id].addTrack(track, stream);
            });

            connections[id].createOffer().then((description) => {
                connections[id].setLocalDescription(description)
                    .then(() => {
                        socketRef.current.emit('signal', id, JSON.stringify({ sdp: connections[id].localDescription }));
                    })
                    .catch((e) => console.log('Error setting local description (screen share):', e));
            });
        }

        stream.getTracks().forEach((track) => {
            track.onended = () => {
                setScreen(false);
                getUserMedia();
            };
        });
    };

    let gotMessageFromServer = (fromId, message) => {
        var signal = JSON.parse(message);

        if (fromId !== socketIdRef.current) {
            if (signal.sdp) {
                connections[fromId].setRemoteDescription(new RTCSessionDescription(signal.sdp))
                    .then(() => {
                        if (signal.sdp.type === 'offer') {
                            connections[fromId].createAnswer().then((description) => {
                                connections[fromId].setLocalDescription(description).then(() => {
                                    socketRef.current.emit('signal', fromId, JSON.stringify({ sdp: connections[fromId].localDescription }));
                                }).catch((e) => console.log(e));
                            }).catch((e) => console.log(e));
                        }
                    })
                    .catch((e) => console.log(e));
            }

            if (signal.ice) {
                connections[fromId].addIceCandidate(new RTCIceCandidate(signal.ice)).catch((e) => console.log(e));
            }
        }
    };

    let connectToSocketServer = () => {
        socketRef.current = io.connect(server_url, { secure: false });

        socketRef.current.on('signal', gotMessageFromServer);

        socketRef.current.on('connect', () => {
            socketRef.current.emit('join-call', window.location.href);
            socketIdRef.current = socketRef.current.id;

            socketRef.current.on('chat-message', addMessage);

            socketRef.current.on('user-left', (id) => {
                setVideos((videos) => videos.filter((video) => video.socketId !== id));
                setParticipantCount(prev => prev - 1);
                if (connections[id]) {
                    connections[id].close();
                    delete connections[id];
                }
            });

            socketRef.current.on('user-joined', (id, clients) => {
                setParticipantCount(clients.length);
                clients.forEach((socketListId) => {
                    if (socketListId === socketIdRef.current) return;

                    if (!connections[socketListId]) {
                        connections[socketListId] = new RTCPeerConnection(peerConfigConnections);

                        connections[socketListId].onicecandidate = function (event) {
                            if (event.candidate != null) {
                                socketRef.current.emit('signal', socketListId, JSON.stringify({ ice: event.candidate }));
                            }
                        };

                        connections[socketListId].ontrack = (event) => {
                            console.log('Received remote stream:', event.streams[0]);
                            setVideos((prevVideos) => {
                                const existingVideo = prevVideos.find(video => video.socketId === socketListId);
                                if (existingVideo) {
                                    return prevVideos.map(video =>
                                        video.socketId === socketListId ? { ...video, stream: event.streams[0] } : video
                                    );
                                } else {
                                    const newVideo = {
                                        socketId: socketListId,
                                        stream: event.streams[0],
                                        autoplay: true,
                                        playsinline: true,
                                    };
                                    return [...prevVideos, newVideo];
                                }
                            });
                        };

                        if (window.localStream) {
                            window.localStream.getTracks().forEach(track => {
                                connections[socketListId].addTrack(track, window.localStream);
                            });
                        }
                    }
                });

                if (id === socketIdRef.current) {
                    for (let id2 in connections) {
                        if (id2 === socketIdRef.current) continue;

                        connections[id2].createOffer().then((description) => {
                            connections[id2].setLocalDescription(description)
                                .then(() => {
                                    socketRef.current.emit('signal', id2, JSON.stringify({ sdp: connections[id2].localDescription }));
                                })
                                .catch((e) => console.log(e));
                        });
                    }
                }
            });
        });
    };

    // Control handlers
    let handleVideo = () => {
        setVideo(!video);
    };

    let handleAudio = () => {
        setAudio(!audio);
    };

    let handleScreen = () => {
        const newState = !screen;
        if (newState && !screenAvailable) {
            return;
        }
        setScreen(newState);
    };

    let handleSpeaker = () => {
        setIsSpeakerOn(!isSpeakerOn);
    };

    let handleCameraFlip = async () => {
        setCurrentCamera(currentCamera === 'user' ? 'environment' : 'user');
    };

    let handleFullscreen = () => {
        if (!isFullscreen) {
            if (fullscreenRef.current.requestFullscreen) {
                fullscreenRef.current.requestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            }
        }
        setIsFullscreen(!isFullscreen);
    };

    useEffect(() => {
        if (screen !== undefined) {
            getDislayMedia();
        }
    }, [screen]);

    let handleEndCall = () => {
        try {
            if (window.localStream) {
                window.localStream.getTracks().forEach((track) => track.stop());
            }
            for (let id in connections) {
                if (connections[id]) {
                    connections[id].close();
                }
            }
            connections = {};
            if (socketRef.current) {
                socketRef.current.disconnect();
            }
        } catch (e) {
            console.log('Error ending call:', e);
        }
        window.location.href = '/';
    };

    let openChat = () => {
        setModal(true);
        setNewMessages(0);
    };
    
    let closeChat = () => {
        setModal(false);
    };

    const addMessage = (data, sender, socketIdSender) => {
        setMessages((prevMessages) => [...prevMessages, { sender: sender, data: data }]);
        if (socketIdSender !== socketIdRef.current) {
            setNewMessages((prevNewMessages) => prevNewMessages + 1);
        }
    };

    let sendMessage = () => {
        if (message.trim() !== '') {
            socketRef.current.emit('chat-message', message, username);
            setMessage('');
        }
    };

    let connect = () => {
        if (username.trim() === '') {
            return;
        }
        setAskForUsername(false);
        getMedia();
    };

    // Check if remote video is off
    const isRemoteVideoOff = (videoItem) => {
        return !videoItem.stream || 
               !videoItem.stream.getVideoTracks().length || 
               !videoItem.stream.getVideoTracks().some(track => track.enabled && track.readyState === 'live');
    };

    return (
        <div ref={fullscreenRef} className={styles.videoCallContainer}>
            {askForUsername === true ? (
                <div className={styles.lobbyContainer}>
                    <div className={styles.lobbyContent}>
                        <div className={styles.appHeader}>
                            <h1>Video Call</h1>
                            <p>Connect with others seamlessly</p>
                        </div>
                        
                        <div className={styles.localVideoPreview}>
                            <video ref={localVideoref} autoPlay muted playsInline className={styles.previewVideo}></video>
                        </div>
                        
                        <div className={styles.loginForm}>
                            <TextField 
                                id="username-input" 
                                label="Enter your name" 
                                value={username} 
                                onChange={(e) => setUsername(e.target.value)} 
                                variant="outlined"
                                fullWidth
                                className={styles.usernameInput}
                                onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                        connect();
                                    }
                                }}
                            />
                            <Button 
                                variant="contained" 
                                onClick={connect}
                                disabled={!username.trim()}
                                className={styles.connectButton}
                                size="large"
                            >
                                Join Call
                            </Button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className={styles.meetVideoContainer}>
                    {/* Call Info Header */}
                    <div className={`${styles.callHeader} ${!showControls ? styles.hidden : ''}`}>
                        <div className={styles.callInfo}>
                            <Chip 
                                icon={<PersonIcon />} 
                                label={`${participantCount} participants`} 
                                variant="outlined" 
                                className={styles.participantChip}
                            />
                            <div className={styles.callDuration}>
                                {formatDuration(callDuration)}
                            </div>
                        </div>
                    </div>

                    {/* Chat Modal */}
                    {showModal && (
                        <div className={styles.chatModal}>
                            <div className={styles.chatContainer}>
                                <div className={styles.chatHeader}>
                                    <h2>Messages</h2>
                                    <IconButton onClick={closeChat} className={styles.closeButton}>
                                        ×
                                    </IconButton>
                                </div>
                                
                                <div className={styles.messagesContainer}>
                                    {messages.length > 0 ? (
                                        messages.map((item, index) => (
                                            <div 
                                                key={index} 
                                                className={`${styles.messageItem} ${
                                                    item.sender === username ? styles.myMessage : styles.otherMessage
                                                }`}
                                            >
                                                <div className={styles.messageSender}>{item.sender}</div>
                                                <div className={styles.messageText}>{item.data}</div>
                                            </div>
                                        ))
                                    ) : (
                                        <div className={styles.noMessages}>
                                            <ChatIcon className={styles.noMessageIcon} />
                                            <p>No messages yet</p>
                                        </div>
                                    )}
                                </div>

                                <div className={styles.messageInput}>
                                    <TextField
                                        value={message}
                                        onChange={(e) => setMessage(e.target.value)}
                                        placeholder="Type a message..."
                                        variant="outlined"
                                        fullWidth
                                        size="small"
                                        onKeyPress={(e) => {
                                            if (e.key === 'Enter') {
                                                sendMessage();
                                            }
                                        }}
                                    />
                                    <Button 
                                        variant="contained" 
                                        onClick={sendMessage}
                                        disabled={!message.trim()}
                                        className={styles.sendButton}
                                    >
                                        Send
                                    </Button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Main Video Area */}
                    <div className={styles.videoGrid}>
                        {/* Local Video */}
                        <div className={styles.localVideoContainer}>
                            {video ? (
                                <video 
                                    className={styles.localVideo} 
                                    ref={localVideoref} 
                                    autoPlay 
                                    muted 
                                    playsInline
                                ></video>
                            ) : (
                                <div className={styles.videoOffPlaceholder}>
                                    <Avatar className={styles.avatarLarge}>
                                        {username.charAt(0).toUpperCase()}
                                    </Avatar>
                                    <p className={styles.videoOffText}>Camera is off</p>
                                </div>
                            )}
                            <div className={styles.videoLabel}>
                                <span>{username} (You)</span>
                                {!audio && <MicOffIcon className={styles.mutedIcon} />}
                            </div>
                        </div>

                        {/* Remote Videos */}
                        {videos.map((videoItem) => (
                            <div key={videoItem.socketId} className={styles.remoteVideoContainer}>
                                <div className={`${styles.remoteVideoWrapper} ${isRemoteVideoOff(videoItem) ? styles.blurred : ''}`}>
                                    {!isRemoteVideoOff(videoItem) ? (
                                        <video
                                            data-socket={videoItem.socketId}
                                            ref={(ref) => {
                                                if (ref && videoItem.stream) {
                                                    ref.srcObject = videoItem.stream;
                                                }
                                            }}
                                            autoPlay
                                            playsInline
                                            className={styles.remoteVideo}
                                        ></video>
                                    ) : (
                                        <div className={styles.videoOffPlaceholder}>
                                            <Avatar className={styles.avatarLarge}>
                                                P
                                            </Avatar>
                                            <p className={styles.videoOffText}>Camera is off</p>
                                        </div>
                                    )}
                                </div>
                                <div className={styles.videoLabel}>
                                    <span>Participant</span>
                                    {videoItem.stream && 
                                     !videoItem.stream.getAudioTracks().some(track => track.enabled) && 
                                     <MicOffIcon className={styles.mutedIcon} />
                                    }
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Bottom Controls */}
                    <div className={`${styles.bottomControls} ${!showControls ? styles.hidden : ''}`}>
                        <div className={styles.controlsWrapper}>
                            {/* Secondary Controls */}
                            <div className={styles.secondaryControls}>
{/*                                 <IconButton 
                                    onClick={handleCameraFlip} 
                                    className={styles.controlButton}
                                    disabled={!video}
                                >
                                    <FlipCameraAndroidIcon />
                                </IconButton>
                                 */}
                                <IconButton 
                                    onClick={handleSpeaker} 
                                    className={styles.controlButton}
                                >
                                    {isSpeakerOn ? <VolumeUpIcon /> : <VolumeOffIcon />}
                                </IconButton>
                                
                                <IconButton 
                                    onClick={handleFullscreen} 
                                    className={styles.controlButton}
                                >
                                    {isFullscreen ? <FullscreenExitIcon /> : <FullscreenIcon />}
                                </IconButton>
                            </div>

                            {/* Primary Controls */}
                            <div className={styles.primaryControls}>
                                <IconButton 
                                    onClick={handleVideo} 
                                    className={`${styles.controlButton} ${!video ? styles.disabled : ''}`}
                                >
                                    {video ? <VideocamIcon /> : <VideocamOffIcon />}
                                </IconButton>
                                
                                <IconButton 
                                    onClick={handleAudio} 
                                    className={`${styles.controlButton} ${!audio ? styles.disabled : ''}`}
                                >
                                    {audio ? <MicIcon /> : <MicOffIcon />}
                                </IconButton>
                                
                                <IconButton 
                                    onClick={handleEndCall} 
                                    className={styles.endCallButton}
                                >
                                    <CallEndIcon />
                                </IconButton>
                                
                                {screenAvailable && (
                                    <IconButton 
                                        onClick={handleScreen} 
                                        className={`${styles.controlButton} ${screen ? styles.active : ''}`}
                                    >
                                        {screen ? <StopScreenShareIcon /> : <ScreenShareIcon />}
                                    </IconButton>
                                )}
                                
                                <Badge badgeContent={newMessages} max={99} color="error">
                                    <IconButton 
                                        onClick={openChat} 
                                        className={styles.controlButton}
                                    >
                                        <ChatIcon />
                                    </IconButton>
                                </Badge>
                            </div>

                            {/* More Options */}
{/*                             <div className={styles.moreOptions}>
                                <IconButton className={styles.controlButton}>
                                    <MoreVertIcon />
                                </IconButton>
                            </div> */}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
