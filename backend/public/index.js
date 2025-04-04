const io = require('socket.io-client')
const mediasoupClient = require('mediasoup-client')


let roomName, username


function base64ToArrayBuffer(base64) {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}


function getQueryParam(param) {
  return new URLSearchParams(window.location.search).get(param);
}


async function importKey() {
  const storedKey = localStorage.getItem("aesKey");
  if (!storedKey) {
    alert("Key not found. Redirecting...");
    window.location.href = "/";
    return null;
  }

  const keyBuffer = base64ToArrayBuffer(storedKey);

  return crypto.subtle.importKey(
    "raw",
    keyBuffer,
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
}

async function decryptData(key, encrypted, iv) {

  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToArrayBuffer(iv) },
      key,
      base64ToArrayBuffer(encrypted)
    );
    const textDecoder = new TextDecoder().decode(decrypted)
    console.log(textDecoder)
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("Decryption failed:", error);
    alert("Decryption error. Please check the room ID.");
    window.location.href = "/";
  }
}


(async () => {
  const encryptedName = getQueryParam("name");
  const encryptedId = getQueryParam("id");
  const Nameiv = getQueryParam("Nameiv")
  const Idiv = getQueryParam("Idiv");


  if (!encryptedName || !encryptedId || !Nameiv || !Idiv) {
    alert("Invalid URL parameters. Redirecting...");
    window.location.href = "/";
    return;
  }

  const key = await importKey();


  if (!key) return;


  const decryptedName = await decryptData(key, encryptedName, Nameiv);
  const decryptedRoomId = await decryptData(key, encryptedId, Idiv);


  roomName = decryptedRoomId
  username = decryptedName

  const baseurl = `https://172.28.196.231:5000/`
  const link = `${baseurl}?RID=${encodeURIComponent(roomName)}`

  const message = `${username} has invited you to join a Meeting..%0A%0AJoin the meeting:%0Ahttps://172.28.196.231:5000/?RID=${encodeURIComponent(roomName)}%0A%0AOr by RoomId: ${roomName}`;




  const msg = `${username} has invited you to join a Meeting . Join the meeting:`

  const fb = document.querySelector('.facebook');
  fb.href = `https://www.facebook.com/share.php?u=${link}&quote=${msg}`;

  const twitter = document.querySelector('.twitter');
  twitter.href = `http://twitter.com/share?&url=${link}&text=${msg}`

  const whatsapp = document.querySelector('.whatsapp');
  whatsapp.href = `https://api.whatsapp.com/send?text=${message}`;

  const gmail_msg = `Meeting Link!MediaStreaming`
  const gmail = document.querySelector('.email')
  gmail.href = `https://mail.google.com/mail/?view=cm&fs=1&tf=1&to=&su=${gmail_msg}&body=${message}`;


  const linkedin = document.querySelector('.linkedin');
  linkedin.href = `https://www.linkedin.com/sharing/share-offsite/?url=${link}`;

  document.getElementById("share-link").value = link


  window.addEventListener("beforeunload", () => {
    localStorage.removeItem("aesKey");
  });
})();

const socket = io("/mediasoup")

var videoElement;
var socketid;
var checkdivisionforcard = 1;

socket.on('connection-success', ({ socketId }) => {
  socketid = socketId
  console.log("socketid", socketid)
  const videoContainer = document.getElementById('video-container1');


  const videoCard = document.createElement('div');
  videoCard.className = 'video-card1';
  videoCard.id = 'video-card-1'

  const userName = document.createElement('div');
  userName.className = 'user-name';
  userName.textContent = `${username}`;


  videoCard.appendChild(userName);


  videoContainer.appendChild(videoCard);
  videoElement = document.querySelector('.video-stream');
  console.log(videoElement)
  joinRoom()

})

let device
let rtpCapabilities
let producerTransport
let consumerTransports = []
let audioProducer
let videoProducer
let ScreenShareProducer
let consumer
let isProducer = false
let storeidandsource = new Map()
let localAudioTrack = null;
let localVideoTrack = null;
let localscreenSharingTrack = null;
let localStream = new MediaStream(); 
let localScreenShareStream = new MediaStream();
let ScreenSharingOn = false;
let ScreenSharingPeerId;

// https://mediasoup.org/documentation/v3/mediasoup-client/api/#ProducerOptions
// https://mediasoup.org/documentation/v3/mediasoup-client/api/#transport-produce
let params = {
  // mediasoup params
  encodings: [
    {
      rid: 'r0',
      maxBitrate: 100000,
      scalabilityMode: 'S1T3',
    },
    {
      rid: 'r1',
      maxBitrate: 300000,
      scalabilityMode: 'S1T3',
    },
    {
      rid: 'r2',
      maxBitrate: 900000,
      scalabilityMode: 'S1T3',
    },
  ],
  // https://mediasoup.org/documentation/v3/mediasoup-client/api/#ProducerCodecOptions
  codecOptions: {
    videoGoogleStartBitrate: 1000
  }
}

let audioParams;
let ScreenShareParms = { params }
let videoParams = { params };
let consumingTransports = [];

const streamSuccess = (stream) => {
  localVideo.srcObject = stream

  audioParams = { track: stream.getAudioTracks()[0], ...audioParams };
  videoParams = { track: stream.getVideoTracks()[0], ...videoParams };


}

const joinRoom = () => {
  console.log('Joining room with stream:', localStream);
  const devices = 'web'
  
  socket.emit('joinRoom', { roomName, username, devices });

  socket.on('FlutterjoinRoomSuccess', (data) => {
    console.log(`Router RTP Capabilities: ${data.rtpCapabilities}`);

    rtpCapabilities = data.rtpCapabilities;
    console.log("length of peer", data.peerlength)

    createDevice(data.existingPeers, data.peerlength);
  });
};


const toggleAudio = async (enableAudio) => {
  if (enableAudio) {

    if (!localAudioTrack) {
      navigator.mediaDevices.getUserMedia({ audio: true })
        .then(stream => {
          localAudioTrack = stream.getAudioTracks()[0]; 

          localAudioTrack.enabled = true; 
          audioParams = { track: localAudioTrack, appData: { source: 'mic' }, ...audioParams };

          const element = document.querySelector('.fa-microphone-slash');

          if (element) {
            element.classList.remove('fa-microphone-slash');
            element.classList.add('fa-microphone');
            document.getElementById("mic_btn").style.background = '#888'
          }

          connectSendTransportAudio()
        })
        .catch(error => console.log(error.message));
    } else {

      const element = document.querySelector('.fa-microphone-slash');

      if (element) {
        element.classList.remove('fa-microphone-slash');
        element.classList.add('fa-microphone');
        document.getElementById("mic_btn").style.background = '#888'
      }

      localAudioTrack.enabled = true;
      connectSendTransportAudio() 
    }
  } else if (localAudioTrack) {
    const element = document.querySelector('.fa-microphone');

    if (element) {
      element.classList.remove('fa-microphone');
      element.classList.add('fa-microphone-slash');
      document.getElementById("mic_btn").style.background = '#ff4c4c'
    }

    localAudioTrack.stop();  
    localAudioTrack = null;

    if (audioProducer) {
      console.log("Closing previous Audio producer...");
      await audioProducer.close();
      audioProducer = null;

      audioParams = { params }
    }

    let source = 'mic'
    let id = storeidandsource.get(source)
    storeidandsource.delete(source)
    console.log(id)
    socket.emit('AlertServertoRemoveMap', { source, id, roomName, socketid });
  }
}


const toggleVideo = async (enableVideo) => {
  if (enableVideo) {

    if (!localVideoTrack) {
      navigator.mediaDevices.getUserMedia({
        video: { width: { min: 640, max: 1920 }, height: { min: 400, max: 1080 } }
      })
        .then(stream => {
          localVideoTrack = stream.getVideoTracks()[0]; 
          localStream.addTrack(localVideoTrack); 
          videoParams = { track: localVideoTrack, appData: { source: 'camera' }, ...videoParams };

          const videoStream = document.createElement('video');
          videoStream.className = 'video-stream';
          videoStream.id = 'video';
          videoStream.autoplay = false;
          videoStream.muted = false;
          videoStream.style.width = '100%'
          videoStream.srcObject = localStream;
          videoStream.play(); 
          var videoCard = document.getElementById("video-card-1")
          const firstChild = videoCard.firstChild
          videoCard.insertBefore(videoStream, firstChild)

          const element = document.querySelector('.fa-video-slash');

          if (element) {
            element.classList.remove('fa-video-slash');
            element.classList.add('fa-video');
            document.getElementById("video_btn").style.background = '#888'
          }

          connectSendTransportVideo()
        })
        .catch(error => console.log(error.message));
    } else {

      localVideoTrack.enabled = true;

      const videoStream = document.createElement('video');
      videoStream.className = 'video-stream';
      videoStream.id = 'video';
      videoStream.autoplay = false;
      videoStream.muted = false;
      videoStream.srcObject = localStream;
      videoStream.play(); 
      var videoCard = document.getElementById("video-card-1")
      const firstChild = videoCard.firstChild
      videoCard.insertBefore(videoStream, firstChild)

      const element = document.querySelector('.fa-video-slash');

      if (element) {
        element.classList.remove('fa-video-slash');
        element.classList.add('fa-video');
        document.getElementById("video_btn").style.background = '#888'
      }

      connectSendTransportVideo()
    }
  } else if (localVideoTrack) {

    const element = document.querySelector('.fa-video');

    if (element) {
      element.classList.remove('fa-video');
      element.classList.add('fa-video-slash');
      document.getElementById("video_btn").style.background = '#d32f2f'
    }

    localVideoTrack.stop();  
    localStream.removeTrack(localVideoTrack);
    localVideoTrack = null;

    if (videoProducer) {
      console.log("Closing previous Video producer...");
      await videoProducer.close();
      videoProducer = null;

      videoParams = { params }
    }

    let source = 'camera'
    let id = storeidandsource.get(source)
    console.log(storeidandsource)
    console.log("Id", id)
    storeidandsource.delete(source)
    var elementRemove = document.getElementById("video")
    elementRemove.remove();
    socket.emit('AlertServertoRemoveMap', { source, id, roomName, socketid });
  }
}

const toggleshare_screen = async (enablescreenshare) => {
  console.log("ENTERING INTO TOOGLESHARE_SCREEN FUNCT");
  if (enablescreenshare) {
    console.log("ENABLESCREEN SHARE", enablescreenshare)
    if (!localscreenSharingTrack) {
      navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' }, 
        audio: false 
      }).then(stream => {
        console.log("check error1 ");

        if (ScreenSharingOn) {
          var card_0 = document.getElementById("card_0")
          card_0.remove();
        }

        ScreenSharingPeerId = socketid
        var carouselItem = document.createElement('div');

        carouselItem.id = 'card_0';
        carouselItem.className = 'carousel-item active';
        carouselItem.setAttribute('data-bs-interval', '10000');


        localscreenSharingTrack = stream.getVideoTracks()[0];
        localScreenShareStream.addTrack(localscreenSharingTrack);

        ScreenShareParms = { track: localscreenSharingTrack, appData: { source: 'screen' }, ...ScreenShareParms };

        const topBar = document.createElement("div");
        topBar.id = "top-bar";
        topBar.className = "top-bar";

        const userSection = document.createElement("div");
        userSection.className = "user-section";

        const userDetails = document.createElement("span");
        userDetails.className = "user-details";
        userDetails.textContent = `${username} (You, presenting)`;

        userSection.appendChild(userDetails);

        const stopPresentingButton = document.createElement("button");
        stopPresentingButton.className = "stop-presenting";
        stopPresentingButton.textContent = "Stop presenting";

        stopPresentingButton.addEventListener("click", () => {
          console.log("-----------------------stopPresensting--------------------")
          let isshare_screenOn = localscreenSharingTrack ? localscreenSharingTrack.enabled : false;
          alert(isshare_screenOn)
          toggleshare_screen(!isshare_screenOn);
        });

        topBar.appendChild(userSection);
        topBar.appendChild(stopPresentingButton);

        carouselItem.appendChild(topBar)

        const centerContainer = document.createElement("div");
        centerContainer.id = "center-container";
        centerContainer.className = "center-container";

        const videoCard = document.createElement("div");
        videoCard.className = "video-card";

        const videoElement = document.createElement("video");

        videoElement.srcObject = localScreenShareStream;
        videoElement.autoplay = true;
        videoElement.muted = true;

        videoElement.style.width = '65%'

        var Selectcard = document.querySelectorAll(".carousel-item")
        var lengthcard = Selectcard.length
        carouselindicatorsbtn(lengthcard)

        videoCard.appendChild(videoElement);

        centerContainer.appendChild(videoCard);

        carouselItem.appendChild(centerContainer)
        videoElement.play();

        const card1Element = document.querySelector(".card1");
        var carouselInner = document.querySelector('.carousel-inner');

        if (card1Element) {
          card1Element.classList.remove("active");
          card1Element.removeAttribute('data-bs-interval');
          carouselInner.insertBefore(carouselItem, card1Element);
          console.log("Active class removed from card1.");
        } else {
          console.log("Element not found.");
        }

        ScreenSharingOn = true

        var Selectcard = document.querySelectorAll(".carousel-item")
        var lengthcard = Selectcard.length
        carouselindicatorsbtn(lengthcard)

        connectSendTransportScreenShare()

      }).catch(error => console.log(error.message));
    } else {

      if (ScreenSharingOn) {
        var card_0 = document.getElementById("card_0")
        card_0.remove();
      }

      ScreenSharingPeerId = socketid

      localscreenSharingTrack.enabled = true;

      var carouselItem = document.createElement('div');
      var carouselInner = document.querySelector('.carousel-inner');

      carouselItem.id = 'card_0';
      carouselItem.className = 'carousel-item active';
      carouselItem.setAttribute('data-bs-interval', '10000');

      const topBar = document.createElement("div");
      topBar.id = "top-bar";
      topBar.className = "top-bar";

      const userSection = document.createElement("div");
      userSection.className = "user-section";

      const userDetails = document.createElement("span");
      userDetails.className = "user-details";
      userDetails.textContent = `${username} (You, presenting)`;

      userSection.appendChild(userDetails);

      const stopPresentingButton = document.createElement("button");
      stopPresentingButton.className = "stop-presenting";
      stopPresentingButton.textContent = "Stop presenting";

      stopPresentingButton.addEventListener("click", () => {
        console.log("-----------------------stopPresensting--------------------")
        let isshare_screenOn = localscreenSharingTrack ? localscreenSharingTrack.enabled : false;
        alert(isshare_screenOn)
        toggleshare_screen(!isshare_screenOn);
      });

      topBar.appendChild(userSection);
      topBar.appendChild(stopPresentingButton);

      carouselItem.appendChild(topBar)

      const centerContainer = document.createElement("div");
      centerContainer.id = "center-container";
      centerContainer.className = "center-container";

      const videoCard = document.createElement("div");
      videoCard.className = "video-card";

      const videoElement = document.createElement("video");

      videoElement.srcObject = localScreenShareStream;
      videoElement.autoplay = true;
      videoElement.muted = true;

      videoCard.appendChild(videoElement);

      centerContainer.appendChild(videoCard);



      carouselItem.appendChild(centerContainer)
      videoElement.play();

      const card1Element = document.querySelector(".card1");

      if (card1Element) {
        card1Element.classList.remove("active");
        card1Element.removeAttribute('data-bs-interval');
        carouselInner.insertBefore(carouselItem, card1Element);
        console.log("Active class removed from card1.");
      } else {
        console.log("Element not found.");
      }
      ScreenSharingOn = true

      var Selectcard = document.querySelectorAll(".carousel-item")
      var lengthcard = Selectcard.length
      carouselindicatorsbtn(lengthcard)

      connectSendTransportScreenShare()
    }
  } else if (localscreenSharingTrack) {
    console.log("Now switch off the screen share video")
    var card_0 = document.getElementById("card_0")

    localscreenSharingTrack.stop();  
    localScreenShareStream.removeTrack(localscreenSharingTrack);
    localscreenSharingTrack = null;

    if (ScreenShareProducer) {
      console.log("Closing previous screen share producer...");
      await ScreenShareProducer.close();
      ScreenShareProducer = null;

      ScreenShareParms = { params }
    }


    card_0.remove();




    const card1Element = document.querySelector(".card1");

    if (card1Element) {
      card1Element.classList.add("active");
      card1Element.setAttribute('data-bs-interval', '10000');
      console.log("Active class add from card1.");
    } else {
      console.log("Element not found.");
    }

    let source = 'screen'
    let id = storeidandsource.get(source)
    storeidandsource.delete(source)
    socket.emit('AlertServertoRemoveMap', { source, id, roomName, socketid });
    ScreenSharingOn = false
    var Selectcard = document.querySelectorAll(".carousel-item")
    var lengthcard = Selectcard.length
    carouselindicatorsbtn(lengthcard)

  }
}

function carouselindicatorsbtn(length) {
  console.log("carouselindicatorsbtn Length", length)
  var carouselindicators = document.querySelector(".carousel-indicators")
  carouselindicators.innerHTML = ''
  for (let i = 0; i < length; i++) {
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute("data-bs-target", '#carouselExampleDark');
    button.setAttribute("data-bs-slide-to", `${i}`);
    if (i == 0) {
      button.classList.add("active");

      const Btnleft = document.getElementById("Btnleft")
      const Btnright = document.getElementById("Btnright")

      button.setAttribute("aria-current", "true");
      Btnleft.style.display = "none";
      Btnright.style.display = "none";
      console.log("Hogya1")
    }

    button.setAttribute("aria-label", `Slide ${i + 1}`);

    if (i == 1) {
      const Btnleft = document.getElementById("Btnleft")
      const Btnright = document.getElementById("Btnright")

      Btnleft.removeAttribute("style")
      Btnright.removeAttribute("style")
      console.log("Hogya 2")
    }

    carouselindicators.appendChild(button)
  }
}


// A device is an endpoint connecting to a Router on the
// server side to send/recive media
const createDevice = async (existingPeers, peerlength) => {
  try {
    device = new mediasoupClient.Device()

    // https://mediasoup.org/documentation/v3/mediasoup-client/api/#device-load
    // Loads the device with RTP capabilities of the Router (server side)
    await device.load({
      // see getRtpCapabilities() below
      routerRtpCapabilities: rtpCapabilities
    })

    console.log('Device RTP Capabilities', device.rtpCapabilities)

    // once the device loads, create transport
    createSendTransport()

    existingPeers.forEach((peer, index) => {
      console.log(peer.peerlength)
      console.log(`Found existing peer: ${peer.socketId}, setting up consumer`);
      console.log(peer.peerDetails)
      if (peer.producerId) {
        console.log("ProducerId", peer.producerId)
        AddPeerCard(peer.socketId, peer.peerDetails, peer.producerId, index + 2)

      }
      else {
        console.log("No ProducerId")
        AddPeerCard(peer.socketId, peer.peerDetails, '', index + 2)
      }
      // For each existing peer, set up a consumer
      // createConsumer(peer.socketId,peer.peerDetails);

    });

  } catch (error) {
    console.log(error)
    if (error.name === 'UnsupportedError')
      console.warn('browser not supported')
  }
}

socket.on('alert-socket', (id) => {
  console.log(id)
  const test = document.getElementById(`peer_${id}`)
  if (test) {
    let className = test.className
    const splitClass = className.split('d')[2];
    console.log(splitClass)
    let selectCard = document.querySelector(`.card${splitClass}`)
    console.log(selectCard)
    test.remove();
    let videocard = document.querySelectorAll(`.video-card${splitClass}`)
    console.log(videocard)
    if (videocard.length == 0) {
      selectCard.remove()
      console.log("Selected Card Removed")
    }
    else if (videocard.length == 1) {
      console.log("Selected Card Length 1")

      let existingStyle = document.getElementById('dynamic-styles');
      let cssContent = existingStyle.textContent;

      const cardPattern = new RegExp(
        `\\.card${splitClass}\\s*\\.grid-container\\s*\\{[\\s\\S]*?\\}\\s*\\.card${splitClass}\\s*\\.grid-container\\s*\\.video-card${splitClass}\\s*\\{[\\s\\S]*?\\}`,
        'g'
      );

      console.log("CSS Content Before Removal:", cssContent);

      if (cardPattern.test(cssContent)) {
        console.log("Match found. Removing CSS...");

        cssContent = cssContent.replace(cardPattern, "");
        existingStyle.textContent = cssContent; 
        console.log("CSS Content After Removal:", cssContent);
      } else {
        console.log(`.card${splitClass} styles not found in dynamic styles.`);
      }

      const newCss = `
    .card${splitClass} .grid-container {
      display: flex;
      padding: 20px;
      background-color: #2c2c2c;
      height: 90vh;
      box-sizing: border-box;
  }
  .card${splitClass} .grid-container .video-card${splitClass} {
      position: relative;
      background-color: #333;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 50%;
      height: 60vh;
      margin: auto;
  } `;

      existingStyle.textContent += newCss;
    }
    else if (videocard.length == 2) {
      console.log("Selected Card Length 2")

      let existingStyle = document.getElementById('dynamic-styles');
      let cssContent = existingStyle.textContent;

      const cardPattern = new RegExp(
        `\\.card${splitClass}\\s*\\.grid-container\\s*\\{[\\s\\S]*?\\}\\s*\\.card${splitClass}\\s*\\.grid-container\\s*\\.video-card${splitClass}\\s*\\{[\\s\\S]*?\\}`,
        'g'
      );

      console.log("CSS Content Before Removal:", cssContent);

      if (cardPattern.test(cssContent)) {
        console.log("Match found. Removing CSS...");
        cssContent = cssContent.replace(cardPattern, "");
        existingStyle.textContent = cssContent; 
        console.log("CSS Content After Removal:", cssContent);
      } else {
        console.log(`.card${splitClass} styles not found in dynamic styles.`);
      }

      const newCss = `
    .card${splitClass} .grid-container {
      display: flex;
      padding: 20px;
      background-color: #2c2c2c;
      height: 90vh;
      box-sizing: border-box;
  }
  .card${splitClass} .grid-container .video-card${splitClass} {
      position: relative;
      background-color: #333;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 50%;
      height: 60vh;
      margin: auto 1%;
  } `;

      existingStyle.textContent += newCss;
    }
    else if (videocard.length == 3 || videocard.length == 4 || videocard.length == 5 || videocard.length == 6) {

      console.log(`Selected Card Length ${splitClass}`)

      let existingStyle = document.getElementById('dynamic-styles');

      let cssContent = existingStyle.textContent;

      const cardPattern = new RegExp(
        `\\.card${splitClass}\\s*\\.grid-container\\s*\\{[\\s\\S]*?\\}\\s*\\.card${splitClass}\\s*\\.grid-container\\s*\\.video-card${splitClass}\\s*\\{[\\s\\S]*?\\}`,
        'g'
      );
      console.log("CSS Content Before Removal:", cssContent);
      if (cardPattern.test(cssContent)) {
        console.log("Match found. Removing CSS...");
        cssContent = cssContent.replace(cardPattern, "");
        existingStyle.textContent = cssContent; 
        console.log("CSS Content After Removal:", cssContent);
      } else {
        console.log(`.card${splitClass} styles not found in dynamic styles.`);
      }

      const newCss = `
  .card${splitClass} .grid-container {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-gap: 20px;
            padding: 20px;
            background-color: #2c2c2c;
            height: 90vh; 
            box-sizing: border-box;
            overflow: hidden; /* Prevent any overflow from the container */
            margin:0 auto;
            width:100vw;
        }

        .card${splitClass} .grid-container .video-card${splitClass} {
            position: relative;
            background-color: #333;
            border-radius: 8px;
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
            aspect-ratio: 1 / 1; /* Maintain square cards */
            max-width: 100%; /* Prevent horizontal overflow */
            max-height: calc(90vh / 2 - 30px); /* Adjust height to fit within the grid cell */
            box-sizing: border-box; /* Include padding and borders in size */
            width:31vw;
        }
`;

      existingStyle.textContent += newCss;
    }
  }

  let check = document.querySelectorAll(".carousel-item")
  let length = check.length

  carouselindicatorsbtn(length)
})

socket.on('newPeerJoined', (newPeer) => {
  console.log(`New peer joined: ${newPeer.socketId}, setting up consumer`);
  console.log("peers", newPeer.peerDetails)
  console.log("New Peer with peer length", newPeer.peerlength)
  if (newPeer.producerId) {
    console.log("newPeerJoined ProducerId", newPeer.producerId)
  }
  else {
    console.log(" newPeerJoined,No ProducerId")
  }

  AddPeerCard(newPeer.socketId, newPeer.peerDetails, '', newPeer.peerlength)
});

const AddPeerCard = (SocketId, peerDetails, producerId, peerlength) => {
  let assign;
  let existingStyle = document.getElementById('dynamic-styles');

  const Container = document.getElementById(`video-container${checkdivisionforcard}`);
  const checkingvideocontainer = Container.querySelectorAll(`.video-card${checkdivisionforcard}`);
  const CardCount = checkingvideocontainer.length;

  if (CardCount >= 6) {
    checkdivisionforcard++;


    const outerDiv = document.createElement("div");
    outerDiv.classList.add("carousel-item", `card${checkdivisionforcard}`);

    const innerDiv = document.createElement("div");
    innerDiv.id = `video-container${checkdivisionforcard}`; 
    innerDiv.classList.add("grid-container"); 

    outerDiv.appendChild(innerDiv);
    const carouselContainer = document.querySelector(".carousel-inner");
    carouselContainer.appendChild(outerDiv);

    let check = document.querySelectorAll(".carousel-item")
    let length = check.length
    console.log("if isshare_screenOn", ScreenSharingOn)
    carouselindicatorsbtn(length)


  }

  if (peerlength == 1 || peerlength == 2 || peerlength == 3 || peerlength == 4 || peerlength == 5 || peerlength == 6) {
    assign = peerlength;
  } else {
    assign = ((peerlength - 1) % 6) + 1;
  }


  const username = peerDetails.name || 'Unknown User'; 
  console.log("Connect Receive Transport", username);
  console.log("Connect Receive Transport", peerDetails);


  const videoCard = document.createElement('div');
  videoCard.className = `video-card${checkdivisionforcard}`;
  videoCard.id = `peer_${SocketId}`;

  const userNameDiv = document.createElement('div');
  userNameDiv.className = 'user-name';
  userNameDiv.textContent = username;


  videoCard.appendChild(userNameDiv);

  const videoContainer = document.getElementById(`video-container${checkdivisionforcard}`);
  videoContainer.appendChild(videoCard);

  if (assign == 1) {

    let cssContent = existingStyle.textContent;

    const cardPattern = new RegExp(
      `\\.card${checkdivisionforcard}\\s*\\.grid-container\\s*\\{[\\s\\S]*?\\}\\s*\\.card${checkdivisionforcard}\\s*\\.grid-container\\s*\\.video-card${checkdivisionforcard}\\s*\\{[\\s\\S]*?\\}`,
      'g'
    );


    if (cardPattern.test(cssContent)) {
      console.log("Match found. Removing CSS...");
      cssContent = cssContent.replace(cardPattern, "");
      existingStyle.textContent = cssContent; 
    } else {
      console.log(`.card${checkdivisionforcard} styles not found in dynamic styles.`);
    }

    const newCss = `
    .card${checkdivisionforcard} .grid-container {
      display: flex;
      padding: 20px;
      background-color: #2c2c2c;
      height: 90vh;
      box-sizing: border-box;
  }
  .card${checkdivisionforcard} .grid-container .video-card${checkdivisionforcard} {
      position: relative;
      background-color: #333;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 50%;
      height: 60vh;
      margin: auto;
  } `;

    existingStyle.textContent += newCss;

  }
  else if (assign == 2) {
    let cssContent = existingStyle.textContent;

    const cardPattern = new RegExp(
      `\\.card${checkdivisionforcard}\\s*\\.grid-container\\s*\\{[\\s\\S]*?\\}\\s*\\.card${checkdivisionforcard}\\s*\\.grid-container\\s*\\.video-card${checkdivisionforcard}\\s*\\{[\\s\\S]*?\\}`,
      'g'
    );


    if (cardPattern.test(cssContent)) {
      console.log("Match found. Removing CSS...");
      cssContent = cssContent.replace(cardPattern, "");
      existingStyle.textContent = cssContent; 
    } else {
      console.log(`.card${checkdivisionforcard} styles not found in dynamic styles.`);
    }

    const newCss = `
    .card${checkdivisionforcard} .grid-container {
      display: flex;
      padding: 20px;
      background-color: #2c2c2c;
      height: 90vh;
      box-sizing: border-box;
  }
  .card${checkdivisionforcard} .grid-container .video-card${checkdivisionforcard} {
      position: relative;
      background-color: #333;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      width: 50%;
      height: 60vh;
      margin: auto 1%;
  } `;

    existingStyle.textContent += newCss;

  }
  else if (assign == 3 || assign == 4 || assign == 5 || assign == 6) {

    let cssContent = existingStyle.textContent;

    const cardPattern = new RegExp(
      `\\.card${checkdivisionforcard}\\s*\\.grid-container\\s*\\{[\\s\\S]*?\\}\\s*\\.card${checkdivisionforcard}\\s*\\.grid-container\\s*\\.video-card${checkdivisionforcard}\\s*\\{[\\s\\S]*?\\}`,
      'g'
    );
    if (cardPattern.test(cssContent)) {
      console.log("Match found. Removing CSS...");
      cssContent = cssContent.replace(cardPattern, "");
      existingStyle.textContent = cssContent; 
    } else {
      console.log(`.card${checkdivisionforcard} styles not found in dynamic styles.`);
    }

    const newCss = `
  .card${checkdivisionforcard} .grid-container {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            grid-gap: 20px;
            padding: 20px;
            background-color: #2c2c2c;
            height: 90vh; 
            box-sizing: border-box;
            overflow: hidden; /* Prevent any overflow from the container */
            margin:0 auto;
            width:100vw;
        }

        .card${checkdivisionforcard} .grid-container .video-card${checkdivisionforcard} {
            position: relative;
            background-color: #333;
            border-radius: 8px;
            overflow: hidden;
            display: flex;
            justify-content: center;
            align-items: center;
            aspect-ratio: 1 / 1; /* Maintain square cards */
            max-width: 100%; /* Prevent horizontal overflow */
            max-height: calc(90vh / 2 - 30px); /* Adjust height to fit within the grid cell */
            box-sizing: border-box; /* Include padding and borders in size */
            width:31vw;
        }
`;

    existingStyle.textContent += newCss;

  }


  if (producerId != '') {
    console.log("ProducerId in AddpeerCard", producerId)
    console.log("checking new card about producer",peerDetails.device)
    signalNewConsumerTransport(producerId, SocketId, peerDetails.device)
  } else {
    console.log("Empty String in producerId")
  }
}

const createSendTransport = () => {
  // see server's socket.on('createWebRtcTransport', sender?, ...)
  // this is a call from Producer, so sender = true
  socket.emit('createWebRtcTransport', { consumer: false }, ({ params }) => {
    // The server sends back params needed 
    // to create Send Transport on the client side
    if (params.error) {
      console.log(params.error)
      return
    }

    console.log(params)

    // creates a new WebRTC Transport to send media
    // based on the server's producer transport params
    // https://mediasoup.org/documentation/v3/mediasoup-client/api/#TransportOptions
    producerTransport = device.createSendTransport(params)

    // https://mediasoup.org/documentation/v3/communication-between-client-and-server/#producing-media
    // this event is raised when a first call to transport.produce() is made
    // see connectSendTransport() below
    producerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      console.log("producerTransport_connect")
      try {
        // Signal local DTLS parameters to the server side transport
        // see server's socket.on('transport-connect', ...)
        await socket.emit('transport-connect', {
          dtlsParameters,
        })

        // Tell the transport that parameters were transmitted.
        callback()

      } catch (error) {
        errback(error)
      }
    })

    producerTransport.on('produce', async (parameters, callback, errback) => {
      console.log(parameters)

      try {
        // tell the server to create a Producer
        // with the following parameters and produce
        // and expect back a server side producer id
        // see server's socket.on('transport-produce', ...)
        await socket.emit('transport-produce', {
          kind: parameters.kind,
          rtpParameters: parameters.rtpParameters,
          appData: parameters.appData,
        }, ({ id, source, producersExist }) => {
          // Tell the transport that parameters were transmitted and provide it with the
          // server side producer's id.
          storeidandsource.set(source, id)
          callback({ id })

          // if producers exist, then join room
          // if (producersExist) getProducers()
        })
      } catch (error) {
        errback(error)
      }
    })


  })
}


const connectSendTransportAudio = async () => {
  audioProducer = await producerTransport.produce(audioParams);

  console.log("connectSendTransportAudio_22222222222222222", audioProducer)

  audioProducer.on('trackended', () => {
    console.log('audio track ended')

    // close audio track
  })

  audioProducer.on('transportclose', () => {
    console.log('audio transport ended')

    // close audio track
  })
}

const connectSendTransportVideo = async () => {
  console.log("enter into connectSendTransportVideo")
  // we now call produce() to instruct the producer transport
  // to send media to the Router
  // https://mediasoup.org/documentation/v3/mediasoup-client/api/#transport-produce
  // this action will trigger the 'connect' and 'produce' events above


  videoProducer = await producerTransport.produce(videoParams);

  console.log("connectSendTransportVideo_1111111111111111111111111111111", videoProducer)

  videoProducer.on('trackended', () => {
    console.log('video track ended')

    // close video track
  })

  videoProducer.on('transportclose', () => {
    console.log('video transport ended')

    // close video track
  })
}

const connectSendTransportScreenShare = async () => {
  console.log("Check111-12221");
  console.log("enter into connectSendTransportScreenShare")
  // we now call produce() to instruct the producer transport
  // to send media to the Router
  // https://mediasoup.org/documentation/v3/mediasoup-client/api/#transport-produce
  // this action will trigger the 'connect' and 'produce' events above


  ScreenShareProducer = await producerTransport.produce(ScreenShareParms);

  console.log("connectSendTransportScreenShare_3333333333", ScreenShareProducer)

  ScreenShareProducer.on('trackended', () => {
    console.log('ScreenShare track ended')

    ScreenShareProducer.close();
    ScreenShareProducer = null;

    ScreenShareParms = { params }

    var card_0 = document.getElementById("card_0")

    if (card_0) {
      card_0.remove();
      ScreenSharingOn = false

      localscreenSharingTrack.stop();  
      localScreenShareStream.removeTrack(localscreenSharingTrack);
      localscreenSharingTrack = null;


      const card1Element = document.querySelector(".card1");

      if (card1Element) {
        card1Element.classList.add("active");
        card1Element.setAttribute('data-bs-interval', '10000');
        console.log("Active class add from card1.");
      } else {
        console.log("Element not found.");
      }

      let source = 'screen'
      let id = storeidandsource.get(source)
      storeidandsource.delete(source)
      socket.emit('AlertServertoRemoveMap', { source, id, roomName, socketid });
      ScreenSharingOn = false
      var Selectcard = document.querySelectorAll(".carousel-item")
      var lengthcard = Selectcard.length
      carouselindicatorsbtn(lengthcard)

    }

    // close video track
  })

  ScreenShareProducer.on('transportclose', () => {
    console.log('ScreenShare transport ended')

    // close video track
  })
}

const signalNewConsumerTransport = async (remoteProducerId, socketId, producerDevice) => {
  console.log("signalNewConsumerTransport", remoteProducerId, socketId, producerDevice);
  //check if we are already consuming the remoteProducerId
  if (consumingTransports.includes(remoteProducerId)) return;
  consumingTransports.push(remoteProducerId);

  await socket.emit('createWebRtcTransport', { consumer: true }, ({ params }) => {

    if (params.error) {
      console.log(params.error)
      return
    }
    console.log(`PARAMS... ${params}`)

    let consumerTransport
    try {
      consumerTransport = device.createRecvTransport(params)
    } catch (error) {

      console.log(error)
      return
    }

    consumerTransport.on('connect', async ({ dtlsParameters }, callback, errback) => {
      try {

        await socket.emit('transport-recv-connect', {
          dtlsParameters,
          serverConsumerTransportId: params.id,
        })

        callback()
      } catch (error) {

        errback(error)
      }
    })

    console.log("connectRecvTransport to check peers", socketId);

    connectRecvTransport(consumerTransport, remoteProducerId, params.id, socketId, producerDevice)
  })
}

// server informs the client of a new producer just joined
socket.on('new-producer', ({ producerId, socketId, producerDevice }) => signalNewConsumerTransport(producerId, socketId, producerDevice))


const connectRecvTransport = async (consumerTransport, remoteProducerId, serverConsumerTransportId, socketId, producerDevice) => {
  // for consumer, we need to tell the server first
  // to create a consumer based on the rtpCapabilities and consume
  // if the router can consume, it will send back a set of params as below
  await socket.emit('consume', {
    rtpCapabilities: device.rtpCapabilities,
    remoteProducerId,
    serverConsumerTransportId,
  }, async ({ params }) => {
    if (params.error) {
      console.log('Cannot Consume')
      return
    }

    console.log(`Consumer Params ${params}`)
    console.log(producerDevice)

    const consumer = await consumerTransport.consume({
      id: params.id,
      producerId: params.producerId,
      kind: params.kind,
      rtpParameters: params.rtpParameters
    })

    consumerTransports = [
      ...consumerTransports,
      {
        consumerTransport,
        serverConsumerTransportId: params.id,
        producerId: remoteProducerId,
        consumer,
      },
    ]

    const videoCard = document.getElementById(`peer_${socketId}`)
    let mediaElement;
    
    console.log(`Device checking what is comming ${device}`)
    if (videoCard) {
      console.log("SocketId", socketId)
      if (params.kind === 'video') {
        console.log("Checking Source", params.source)
        if (params.Source == 'camera') {
          mediaElement = document.createElement('video');
          mediaElement.className = 'video-stream';
          mediaElement.id = remoteProducerId;
          mediaElement.autoplay = true;
          mediaElement.muted = true; 
          if (producerDevice == 'web') {
            console.log(`Device checking what is comming ${producerDevice} True part`)
            mediaElement.style.width = '100%'
          }
          const firstChild = videoCard.firstChild;
          videoCard.insertBefore(mediaElement, firstChild);
          console.log(`Video Tag is Appended ${remoteProducerId}`)
        }
        else if (params.Source == 'screen') {
          if (ScreenSharingOn) {
            if (ScreenSharingPeerId == socketid) {
              localscreenSharingTrack.stop();
              localscreenSharingTrack = null;
              var card_0 = document.getElementById("card_0")
              card_0.remove();
              alert(`New user Start streaming ${params.Peername}`)
            }

          }
          ScreenSharingOn = true

          ScreenSharingPeerId = params.PeerId
          var carouselItem = document.createElement('div');

          
          carouselItem.id = 'card_0';
          carouselItem.className = 'carousel-item active';
          carouselItem.setAttribute('data-bs-interval', '10000');
          const topBar = document.createElement("div");
          topBar.id = "top-bar";
          topBar.className = "top-bar";

          
          const userSection = document.createElement("div");
          userSection.className = "user-section";

          
          const userDetails = document.createElement("span");
          userDetails.className = "user-details";
          userDetails.textContent = `${params.Peername} presenting`;

          userSection.appendChild(userDetails);


          topBar.appendChild(userSection);

          carouselItem.appendChild(topBar)

          const centerContainer = document.createElement("div");
          centerContainer.id = "center-container";
          centerContainer.className = "center-container";

          const videoCard = document.createElement("div");
          videoCard.className = "video-card";

          if (producerDevice == 'web') {
            videoCard.style.width = '100%'
            videoCard.style.maxWidth = '100%'
          } else if (producerDevice == 'phone') {
            videoCard.style.height = '100vh'
          }


          mediaElement = document.createElement('video');
          mediaElement.className = 'video-stream';
          mediaElement.id = remoteProducerId;
          mediaElement.autoplay = true;
          mediaElement.muted = true; 

          if (producerDevice == 'web') {
            mediaElement.style.width = '65%'
          }



          videoCard.appendChild(mediaElement);

          centerContainer.appendChild(videoCard);
          console.log("Appended video screen_share", videoCard)
          carouselItem.appendChild(centerContainer)

          const card1Element = document.querySelector(".card1");
          var carouselInner = document.querySelector('.carousel-inner');
          if (card1Element) {
            card1Element.classList.remove("active");
            card1Element.removeAttribute('data-bs-interval');
            carouselInner.insertBefore(carouselItem, card1Element);
            console.log("Active class removed from card1.");
          } else {
            console.log("Element not found.");
          }

          var Selectcard = document.querySelectorAll(".carousel-item")
          var lengthcard = Selectcard.length
          carouselindicatorsbtn(lengthcard)
        }
      } else if (params.kind === 'audio') {
        // Create an audio element for audio tracks
        mediaElement = document.createElement('audio');
        mediaElement.className = 'audio-stream';
        mediaElement.id = remoteProducerId;
        mediaElement.autoplay = true;
        mediaElement.style.display = 'none';

        videoCard.appendChild(mediaElement);
        console.log(`Audio element appended for remoteProducerId: ${remoteProducerId}`);
      }
    } else {
      console.log(`No Element is present ${socketId}`)
      return
    }

    const { track } = consumer;
    mediaElement.srcObject = new MediaStream([track]);

    socket.emit('consumer-resume', { serverConsumerId: params.serverConsumerId })
  })
}

socket.on('producer-closed', ({ remoteProducerId, socketId, source }) => {

  console.log("Checking the socketid and source------------------------------------------------------------------------------------------ ", socketId, source)
  console.log("remoteproducerid", remoteProducerId)

  const producerToClose = consumerTransports.find(transportData => transportData.producerId === remoteProducerId)
  producerToClose.consumerTransport.close()
  producerToClose.consumer.close()


  consumerTransports = consumerTransports.filter(transportData => transportData.producerId !== remoteProducerId)

  if (source == 'camera') {

    const videoContainer = document.getElementById("video-container");
    const elementToRemove = document.getElementById(`${remoteProducerId}`);

    if (elementToRemove) {
      console.log("camera eske ander")
      elementToRemove.remove();
      console.log(`Camera Element with ID ${remoteProducerId} has been removed.`);
    }
  } else if (source == 'mic') {
    const elementToRemove = document.getElementById(`${remoteProducerId}`);

    if (elementToRemove) {
      console.log("audio eske ander")
      elementToRemove.remove();
      console.log(`Audio Element with ID ${remoteProducerId} has been removed.`);
    }
  } else if (source == 'screen') {
    const elementToRemove = document.getElementById(`card_0`);
    ScreenSharingOn = false
    if (elementToRemove) {
      console.log("screen eske ander")
      elementToRemove.remove();
      var Selectcard = document.querySelectorAll(".carousel-item")
      var lengthcard = Selectcard.length
      carouselindicatorsbtn(lengthcard)
      const card1 = document.querySelector('.card1')
      card1.classList.add("active");
      card1.setAttribute('data-bs-interval', '10000');
    }
  }

})

socket.on('alert-ScreenSharing-peer', (SocketId) => {
  alert(`Screen sharing on from: ${SocketId}`);


  console.log("Now switch off the screen share video")
  var card_0 = document.getElementById("card_0")

  localscreenSharingTrack.stop();
  localscreenSharingTrack = null;

  card_0.innerHTML = ''

  let source = 'screen'
  let id = storeidandsource.get(source)
  storeidandsource.delete(source)


});

document.getElementById('mic_btn').addEventListener('click', () => {
  alert("click_mic")
  //console.log("audio", localStream)
  // Toggle audio state
  let isAudioOn = localAudioTrack ? localAudioTrack.enabled : false;
  //alert(isAudioOn)
  toggleAudio(!isAudioOn);
});

document.getElementById('video_btn').addEventListener('click', () => {
  alert("click_vid")
  console.log("vid", localStream)
  // Toggle video state
  let isVideoOn = localVideoTrack ? localVideoTrack.enabled : false;
  //alert(isVideoOn)
  toggleVideo(!isVideoOn);
});

document.getElementById('share_screen').addEventListener('click', () => {
  //alert("click_share_screen")
  console.log("share_screen", localScreenShareStream)

  let isshare_screenOn = localscreenSharingTrack ? localscreenSharingTrack.enabled : false;
  alert(isshare_screenOn)
  toggleshare_screen(!isshare_screenOn);
});

document.getElementById('call_ended').addEventListener('click', () => {

  console.log(`Call ended. Peer card removed for peer ID: ${socketid}`);
  window.location.href = '/'
});

document.getElementById('mic_btn').addEventListener('mouseover', () => {
  document.getElementById('mic_btn').style.opacity = '0.5';
});

document.getElementById('mic_btn').addEventListener('mouseout', () => {
  document.getElementById('mic_btn').style.opacity = '1';
});

document.getElementById('video_btn').addEventListener('mouseover', () => {
  document.getElementById('video_btn').style.opacity = '0.5';
});

document.getElementById('video_btn').addEventListener('mouseout', () => {
  document.getElementById('video_btn').style.opacity = '1';
});

const popup = document.getElementById("share-popup");
const closeBtn = document.getElementById("close-popup");
const copyBtn = document.getElementById("copy-btn");
const shareLink = document.getElementById("share-link");
const button_popup = document.getElementById("pop_up_button")

document.getElementById("pop_up_button").addEventListener('click', () => {
  popup.style.display = "flex";
})


closeBtn.addEventListener("click", () => {
  popup.style.display = "none";
});

window.addEventListener("click", (e) => {
  if (!popup.contains(e.target) && e.target != button_popup) {
    popup.style.display = "none";
  }
});


copyBtn.addEventListener("click", () => {
  shareLink.select();
  document.execCommand("copy");

});