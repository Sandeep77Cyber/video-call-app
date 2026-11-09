const rtcConfig = {
    iceServers: [
        { urls: "stun:://google.com" },
        {
            urls: "turn:global.metered.ca:443",
            username: "YOUR_METERED_USERNAME", // Replace with your Metered.ca username
            credential: "YOUR_METERED_PASSWORD" // Replace with your Metered.ca password
        },
        {
            urls: "turn:global.metered.ca:443?transport=tcp",
            username: "YOUR_METERED_USERNAME",
            credential: "YOUR_METERED_PASSWORD"
        }
    ]
};

let localStream;
let peerConnection;
let ws;

async function loginAndJoin() {
    const username = document.getElementById("username").value;
    const password = document.getElementById("password").value;
    const roomId = document.getElementById("room-id").value;

    const res = await fetch("/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password })
    });

    if (!res.ok) {
        document.getElementById("error-msg").innerText = "Invalid login!";
        return;
    }

    document.getElementById("login-box").classList.add("hidden");
    document.getElementById("call-box").classList.remove("hidden");
    await startCall(roomId);
}

async function startCall(roomId) {
    localStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    document.getElementById("localVideo").srcObject = localStream;

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    ws = new WebSocket(`${protocol}//${window.location.host}/ws/${roomId}`);

    ws.onmessage = async (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "full") {
            alert("Room is full (max 2 users).");
            location.reload();
        } else if (msg.type === "joined" && msg.initiator) {
            createPeerConnection();
            const offer = await peerConnection.createOffer();
            await peerConnection.setLocalDescription(offer);
            ws.send(JSON.stringify({ type: "offer", offer }));
        } else if (msg.type === "offer") {
            createPeerConnection();
            await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.offer));
            const answer = await peerConnection.createAnswer();
            await peerConnection.setLocalDescription(answer);
            ws.send(JSON.stringify({ type: "answer", answer }));
        } else if (msg.type === "answer") {
            await peerConnection.setRemoteDescription(new RTCSessionDescription(msg.answer));
        } else if (msg.type === "candidate") {
            await peerConnection.addIceCandidate(new RTCIceCandidate(msg.candidate));
        }
    };
}

function createPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        document.getElementById("remoteVideo").srcObject = event.streams[0];
    };

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            ws.send(JSON.stringify({ type: "candidate", candidate: event.candidate }));
        }
    };
}

function toggleMic() {
    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
}

function toggleCam() {
    const videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
}

function endCall() {
    if (peerConnection) peerConnection.close();
    if (ws) ws.close();
    location.reload();
}
