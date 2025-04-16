import express from 'express'
const app = express()

import https from 'httpolyglot'
import fs from 'fs'
import path from 'path'
const __dirname = path.resolve()

import favicon from 'serve-favicon'

import { Server } from 'socket.io'
import mediasoup from 'mediasoup'

app.set("view engine", "ejs");

app.set("views", path.join(__dirname, "views"));

app.use(favicon(path.join(__dirname, 'public', 'favicon.ico')))

app.use('/sfu', express.static(path.join(__dirname, 'public')))

app.get("/", (req, res) => {
  res.render("main_page");
});

app.get("/Terms&Conditions", (req, res) => {
  res.render("Terms&Conditions");
});

app.get("/PrivacyPolicy", (req, res) => {
  res.render("PrivacyPolicy");
});

app.get('*', (req, res, next) => {
  const path = '/sfu/'

  if (req.path.indexOf(path) == 0 && req.path.length > path.length) return next()

  res.send(`You need to specify a room name in the path e.g. 'https://127.0.0.1/sfu/room'`)
})


// SSL cert for HTTPS access
const options = {
  key: fs.readFileSync('./server/ssl/key.pem', 'utf-8'),
  cert: fs.readFileSync('./server/ssl/cert.pem', 'utf-8')
}

const httpsServer = https.createServer(options, app)
httpsServer.listen(5000, () => {
  console.log('listening on port: ' + 5000)
})

const io = new Server(httpsServer)


const connections = io.of('/mediasoup')

/**
 * Worker
 * |-> Router(s)
 *     |-> Producer Transport(s)
 *         |-> Producer
 *     |-> Consumer Transport(s)
 *         |-> Consumer 
 **/
const pp = new Map();
let worker
let rooms = {}          // { roomName1: { Router, rooms: [ sicketId1, ... ] }, ...}
let peers = {}          // { socketId1: { roomName1, socket, transports = [id1, id2,] }, producers = [id1, id2,] }, consumers = [id1, id2,], peerDetails }, ...}
let transports = []     // [ { socketId1, roomName1, transport, consumer }, ... ]
let producers = []      // [ { socketId1, roomName1, producer, }, ... ]
let consumers = []      // [ { socketId1, roomName1, consumer, }, ... ]

var ScreenPeer
var ScreenShareSocketId

const createWorker = async () => {
  worker = await mediasoup.createWorker({
    rtcMinPort: 2000,
    rtcMaxPort: 2020,
  })
  console.log(`worker pid ${worker.pid}`)

  worker.on('died', error => {
    console.error('mediasoup worker has died')
    setTimeout(() => process.exit(1), 2000) 
  })

  return worker
}

worker = createWorker()

const mediaCodecs = [
  {
    kind: 'audio',
    mimeType: 'audio/opus',
    clockRate: 48000,
    channels: 2,
  },
  {
    kind: 'video',
    mimeType: 'video/VP8',
    clockRate: 90000,
    parameters: {
      'x-google-start-bitrate': 1000,
    },
  },
]

connections.on('connection', async socket => {
  console.log(socket.id)
  socket.emit('connection-success', {
    socketId: socket.id,
  })

  const removeItems = (items, socketId, type) => {
    items.forEach(item => {
      if (item.socketId === socket.id) {
        item[type].close()
      }
    })
    items = items.filter(item => item.socketId !== socket.id)

    return items
  }

  socket.on('disconnect', () => {
    console.log('peer disconnected')
    consumers = removeItems(consumers, socket.id, 'consumer')
    producers = removeItems(producers, socket.id, 'producer')
    transports = removeItems(transports, socket.id, 'transport')

    const { roomName } = peers[socket.id]
    delete peers[socket.id]

    rooms[roomName] = {
      router: rooms[roomName].router,
      peers: rooms[roomName].peers.filter(socketId => socketId !== socket.id)
    }

    console.log(`Peer with ID ${socket.id} removed. Updated peers:`, rooms[roomName].peers);
    socket.to(rooms[roomName].peers).emit('alert-socket', socket.id)
  })

  socket.on('alert-server-screensharing', ({ SocketId }) => {
    console.log("Sending alert to Peer for New peer on Screen ", SocketId)
    socket.to(ScreenShareSocketId).emit('alert-ScreenSharing-peer', SocketId)
  })

  socket.on('peer-ended', (peerId) => {
    console.log(`Peer ${peerId} ended the call. Informing other peers.`);
    consumers = removeItems(consumers, socket.id, 'consumer')
    producers = removeItems(producers, socket.id, 'producer')
    transports = removeItems(transports, socket.id, 'transport')

    delete peers[socket.id]

    const { roomName } = peers[socket.id]

    rooms[roomName] = {
      router: rooms[roomName].router,
      peers: rooms[roomName].peers.filter(socketId => socketId !== socket.id)
    }


    console.log(`Emitting 'peer-exited' for peer ID: ${socket.id} in room: ${roomName}`);
    socket.to(rooms[roomName].peers).emit('alert-socket', socket.id)
  });

  socket.on('joinRoom', async ({ roomName, username, devices }, callback) => {
    console.log("joinRoom", roomName, username, devices)

    const router1 = await createRoom(roomName, socket.id)

    peers[socket.id] = {
      socket,
      roomName,           
      transports: [],
      producers: [],
      consumers: [],
      peerDetails: {
        name: username || 'Guest',
        device: devices,
        isAdmin: false,   
      }
    }

    const rtpCapabilities = router1.rtpCapabilities

    const existingPeers = rooms[roomName].peers.filter(socketId => socketId !== socket.id);
    console.log("Executing Existing Peers");
    let length = rooms[roomName].peers.length
    console.log("Peers length", length)
    existingPeers.forEach(function (row) {

      if (peers[row].producers.length > 0) {
        console.log(row)
        console.log("Check Producer Exist", peers[row].producers[0])
      }

    })
    console.log("Extecuting CallBack");


    socket.emit('FlutterjoinRoomSuccess', {
      rtpCapabilities,
      peerlength: length,
      existingPeers: existingPeers.map(socketId => ({
        socketId,
        peerDetails: peers[socketId].peerDetails,
        producerId: peers[socketId].producers.length ? peers[socketId].producers[0] : ''  
      }))
    });
    console.log("Exectuting newPeers");
    existingPeers.forEach(existingPeerSocketId => {
      peers[existingPeerSocketId].socket.emit('newPeerJoined', {
        socketId: socket.id,
        peerlength: length,
        peerDetails: peers[socket.id].peerDetails,
        producerId: peers[socket.id].producers.length > 0 > 0 ? peers[socket.id].producers[0] : ''  
      });
    });

  })

  socket.on('AlertServertoRemoveMap', (data) => {
    console.log("checking this connection AlertServertoRemoveMap", data.source, data.id, data.roomName, data.socketid)
    pp.delete(data.id)
    socket.to(rooms[data.roomName].peers).emit('producer-closed', { remoteProducerId: data.id, socketId: data.socketid, source: data.source })

  })

  const createRoom = async (roomName, socketId) => {
    // worker.createRouter(options)
    // options = { mediaCodecs, appData }
    // mediaCodecs -> defined above
    // appData -> custom application data - we are not supplying any
    // none of the two are required
    let router1
    let peers = []
    if (rooms[roomName]) {
      router1 = rooms[roomName].router
      peers = rooms[roomName].peers || []
    } else {
      router1 = await worker.createRouter({ mediaCodecs, })
    }

    console.log(`Router ID: ${router1.id}`, peers.length)

    rooms[roomName] = {
      router: router1,
      peers: [...peers, socketId],
    }

    return router1
  }

  // Client emits a request to create server side Transport
  // We need to differentiate between the producer and consumer transports
  socket.on('createWebRtcTransport', async ({ consumer }, callback) => {

    const roomName = peers[socket.id].roomName

    const router = rooms[roomName].router


    createWebRtcTransport(router).then(
      transport => {
        callback({
          params: {
            id: transport.id,
            iceParameters: transport.iceParameters,
            iceCandidates: transport.iceCandidates,
            dtlsParameters: transport.dtlsParameters,
          }
        })

        addTransport(transport, roomName, consumer, peers[socket.id].peerDetails.name)
      },
      error => {
        console.log(error)
      })
  })

  const addTransport = (transport, roomName, consumer, username) => {

    transports = [
      ...transports,
      { socketId: socket.id, transport, roomName, consumer, }
    ]

    peers[socket.id] = {
      ...peers[socket.id],
      transports: [
        ...peers[socket.id].transports,
        transport.id,
      ],
      peerDetails: {
        ...peers[socket.id].peerDetails, 
        name: username || 'Guest',       
      }
    }
  }

  const addProducer = (producer, roomName, username) => {
    producers = [
      ...producers,
      { socketId: socket.id, producer, roomName, }
    ]

    peers[socket.id] = {
      ...peers[socket.id],
      producers: [
        ...peers[socket.id].producers,
        producer.id,
      ],
      peerDetails: {
        ...peers[socket.id].peerDetails, 
        name: username || 'Guest',       
      }
    }
  }

  const addConsumer = (consumer, roomName, username) => {
    // add the consumer to the consumers list
    consumers = [
      ...consumers,
      { socketId: socket.id, consumer, roomName, }
    ]

    // add the consumer id to the peers list
    peers[socket.id] = {
      ...peers[socket.id],
      consumers: [
        ...peers[socket.id].consumers,
        consumer.id,
      ],
      peerDetails: {
        ...peers[socket.id].peerDetails,
        name: username || 'Guest',       
      }
    }
  }

  socket.on('getProducers', callback => {
    //return all producer transports
    const { roomName } = peers[socket.id]

    let producerList = []
    producers.forEach(producerData => {
      if (producerData.socketId !== socket.id && producerData.roomName === roomName) {
        producerList = [...producerList, producerData.producer.id]
      }
    })

    // return the producer list back to the client
    callback(producerList)
  })

  const informConsumers = (roomName, socketid, producerId) => {
    console.log(`New producer joined. Producer ID: ${producerId}, Room: ${roomName},SocketId:${socketid}`);

    const producerDevice = peers[socketid].peerDetails.device
    rooms[roomName].peers.forEach(socketId => {
      if (peers[socketId]) {
        const peerSocket = peers[socketId].socket;
       
        if (peerSocket) {
          // Emit to each peer the producerId and socketId of the new producer
          peerSocket.emit('new-producer', {
            producerId: producerId,  
            socketId: socketid,
            producerDevice: producerDevice
          });

          console.log(`Notifying peer (Socket ID: ${socketId}) about new producer (Producer ID: ${producerId})`);
        } else {
          console.error(`Socket not found for peer with Socket ID: ${socketId}`);
        }
      } else {
        console.error(`Peer not found for Socket ID: ${socketId}`);
      }
    });
  };


  const getTransport = (socketId) => {
    const [producerTransport] = transports.filter(transport => transport.socketId === socketId && !transport.consumer)
    return producerTransport.transport
  }

  // see client's socket.emit('transport-connect', ...)
  socket.on('transport-connect', ({ dtlsParameters }) => {
    console.log('DTLS PARAMS... ', { dtlsParameters })

    getTransport(socket.id).connect({ dtlsParameters })
  })

  // see client's socket.emit('transport-produce', ...)
  socket.on('transport-produce', async ({ kind, rtpParameters, appData }, callback) => {
    // call produce based on the prameters from the client
    const producer = await getTransport(socket.id).produce({
      kind,
      rtpParameters,
      appData
    })

    if (appData?.source == 'screen') {
      console.log('Produce Source:', appData?.source);
      ScreenPeer = peers[socket.id].peerDetails.name
      ScreenShareSocketId = socket.id
    }


    pp.set(producer.id, producer);

    const { roomName, peerDetails } = peers[socket.id]

    addProducer(producer, roomName, peers[socket.id].peerDetails.name)

    informConsumers(roomName, socket.id, producer.id)

    console.log('Producer ID: ', producer.id, producer.kind)

    producer.on('transportclose', () => {
      console.log('-----transport for this producer closed 24495224')
      producer.close()
    })

    callback({
      id: producer.id,
      source: appData.source,
      producersExist: producers.length > 1 ? true : false
    })
  })

  socket.on('transport-recv-connect', async ({ dtlsParameters, serverConsumerTransportId }) => {
    console.log(`DTLS PARAMS: ${dtlsParameters}`)
    const consumerTransport = transports.find(transportData => (
      transportData.consumer && transportData.transport.id == serverConsumerTransportId
    )).transport
    await consumerTransport.connect({ dtlsParameters })
  })

  socket.on('consume', async ({ rtpCapabilities, remoteProducerId, serverConsumerTransportId }, callback) => {
    try {

      const { roomName } = peers[socket.id]
      const device = peers[socket.id].peerDetails.device
      const router = rooms[roomName].router
      console.log("ConsumerMedia ka Anderrr", roomName, remoteProducerId, serverConsumerTransportId)
      let consumerTransport = transports.find(transportData => (
        transportData.consumer && transportData.transport.id == serverConsumerTransportId
      )).transport

      // check if the router can consume the specified producer
      if (router.canConsume({
        producerId: remoteProducerId,
        rtpCapabilities
      })) {
        // transport can now consume and return a consumer
        const consumer = await consumerTransport.consume({
          producerId: remoteProducerId,
          rtpCapabilities,
          paused: true,
        })
        const producer = pp.get(remoteProducerId);
        const source = producer?.appData?.source;
        console.log("consume Kind", consumer.kind);
        console.log("Consumer Source", source);
        console.log("Consumer peerDetails", peers[socket.id].peerDetails.name)

        consumer.on('transportclose', () => {
          console.log('transport close from consumer')
        })

        consumer.on('producerclose', () => {
          console.log('--------producer of consumer closed--------')
          pp.delete(producer.id);
          socket.emit('producer-closed', { remoteProducerId })

          consumerTransport.close([])
          transports = transports.filter(transportData => transportData.transport.id !== consumerTransport.id)
          consumer.close()
          consumers = consumers.filter(consumerData => consumerData.consumer.id !== consumer.id)
        })

        addConsumer(consumer, roomName, peers[socket.id].peerDetails.name)


        const params = {
          id: consumer.id,
          producerId: remoteProducerId,
          kind: consumer.kind,
          rtpParameters: consumer.rtpParameters,
          serverConsumerId: consumer.id,
          Source: source,
          device: device,
          Peername: source == 'screen' ? ScreenPeer : '',
          PeerId: source == 'screen' ? ScreenShareSocketId : ''
        }

        // send the parameters to the client
        callback({ params })
      }
    } catch (error) {
      console.log(error.message)
      callback({
        params: {
          error: error
        }
      })
    }
  })

  socket.on('consumer-resume', async ({ serverConsumerId }) => {
    console.log('consumer resume')
    const { consumer } = consumers.find(consumerData => consumerData.consumer.id === serverConsumerId)
    await consumer.resume()
  })
})

const createWebRtcTransport = async (router) => {
  return new Promise(async (resolve, reject) => {
    try {
      // https://mediasoup.org/documentation/v3/mediasoup/api/#router-createWebRtcTransport
      let transport = await router.createWebRtcTransport(webRtcTransport_options)
      console.log(`transport id: ${transport.id}`)

      transport.on('dtlsstatechange', dtlsState => {
        if (dtlsState === 'closed') {
          transport.close()
        }
      })

      transport.on('close', () => {
        console.log('transport closed')
      })

      resolve(transport)

    } catch (error) {
      reject(error)
    }
  })
}