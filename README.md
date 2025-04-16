# 🎥 MediaStream – Real-Time Video Conferencing & Streaming Platform

**MediaStream** is a high-performance real-time conferencing and media streaming platform built with **Mediasoup**, **WebRTC**, and **Flutter**. It provides seamless audio/video communication, screen sharing, and multi-user connectivity, similar to platforms like **Google Meet** and **Zoom**.

The system is divided into three major components:
- A **Node.js backend** using **Mediasoup** and **Socket.IO** for signaling and media transport.
- A **web interface** (under `views/` and `/public`) for hosting and joining meetings.
- A **Flutter client** (`flutter_mediastream/`) for mobile access.

---

## 🌟 Features

- **Real-time communication** with support for **audio, video, and screen sharing**
- Built on **WebRTC and Mediasoup** to ensure low-latency, scalable media transmission
- **Flutter Client with Deep Linking** for directly joining rooms from shared URLs
- **Dynamic peer connection management** using custom producer-consumer transport logic
- **Responsive web and Flutter clients** for accessible conferencing from any device
- **Secure media delivery** with optimized deployment on **Ubuntu EC2** with **Nginx**

---

## 📁 Project Structure

```
 ├── backend/ # Node.js server (signaling, Mediasoup integration, Web Client side in `/public/index.html`)
 └── flutter_mediastream/ # Flutter client app for Android, iOS, and desktop
```


---

## 🚀 Tech Stack

- **Node.js**, **Express.js**, **Socket.IO**
- **Mediasoup**, **WebRTC**
- **Flutter**, **Dart**
- **AWS EC2**, **Ubuntu**, **Nginx**
- **SSL**, **Cloud Deployment**

---

## 🎥 Demo Video

Click the image below to watch a full demo of MediaStream in action:

<a data-start="223" data-end="337" rel="noopener" target="_new" class="" href=""><img src="https://drive.google.com/uc?export=view&id=1LPXoIVpbXUVRUV5JH-P4mQjmGc7tOrNd" alt="Watch the Demo" style="max-width:100%;width:50vh;">
</a>

---

## 🛠️ Getting Started

### Backend Setup

```bash
cd backend
npm install
npm start
```
### Flutter Client

```bash
cd flutter_mediastream
flutter pub get
flutter run
```

---

## 📬 Contact

Feel free to reach out for questions, contributions, or collaborations.
We’re always open to feedback and ideas!

