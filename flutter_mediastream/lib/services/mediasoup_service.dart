
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:mediasoup_client_flutter/mediasoup_client_flutter.dart';
import 'package:socket_io_client/socket_io_client.dart' as IO;

class MediasoupService {

  final Function(String) Refresh;

  MediasoupService({required this.Refresh});

  late IO.Socket socket;


  late Device device;
  late String socketid;
  RtpCapabilities? rtpCapabilities;
  late Transport producerTransport; 
  List<String> consumingTransports = []; 
  List<Map<String, dynamic>> consumerTransports = [];
  dynamic videoProducer; 
  dynamic consumer; 
  bool isProducer = false; 


  final List<Map<String, dynamic>> storeidandsource = [];

  final List<Map<String, dynamic>> users = [];


  void connectToServer(String room, String username) {
    print('Hello try to connect with :${username},${room}');
    // socket = IO.io('ws://43.204.127.251:3000/mediasoup', <String, dynamic>{ 
    socket = IO.io('ws://43.210.8.45:3000/mediasoup', <String, dynamic>{
      'transports': ['websocket'],
      'autoConnect': false,
    });


    socket.on('connect', (_) {
      print('connected to server');

    });

    socket.on('connection-success', (data) {
      print('Connected successfully with socket ID: ${data['socketId']}');
      socketid = data['socketId'];
      final String device = 'phone';
      final currentUser = {
        'username': username,
        'socketId': data['socketId'],
        'Device': device,
        'videoRenderer': RTCVideoRenderer(),
        'AudioRenderer': RTCVideoRenderer(),
        'screenShareRenderer':
            RTCVideoRenderer(), 
        'hasScreenSharingOn': false,
      };

      users.add(currentUser); 
      print("User added: $users");
      Refresh('yourdataupdate');
      joinRoom(room, username, device);
    });

    socket.on('FlutterjoinRoomSuccess', (data) {
      print('Joined room successfully: ${data}');

      Map<String, dynamic> rawRtpCapabilities = data['rtpCapabilities'];
      print('Raw Router RTP Capabilities: $rawRtpCapabilities');

      rawRtpCapabilities.forEach((key, value) {
        print('Key: $key, Value: $value');
      });

      try {
        rtpCapabilities = RtpCapabilities.fromMap(rawRtpCapabilities);
        print('Parsed RTP Capabilities: $rtpCapabilities');

        createDevice(data['existingPeers']);
      } catch (e) {
        print('Error converting RTP Capabilities: $e');
      }
    });

    socket.on('newPeerJoined', (data) {
      print('New peer joined: ${data['socketId']}');
      print('Peer Details: ${data['peerDetails']['name']}');

      final newUser = {
        'username': data['peerDetails']['name'],
        'socketId': data['socketId'],
        'Device': data['peerDetails']['device'],
        'videoRenderer': RTCVideoRenderer(),
        'AudioRenderer': RTCVideoRenderer(),
        'screenShareRenderer':
            RTCVideoRenderer(), 
        'hasScreenSharingOn': false,
      };

      users.add(newUser); 
      print("New User added: $users");
      Refresh('newuserjoin');

    });

    socket.on('new-producer', (data) async {
      final String producerId = data['producerId'];
      final String socketId = data['socketId'];

      print('New producer detected: $producerId from socket: $socketId');
      await signalNewConsumerTransport(producerId, socketId);
    });

    socket.on('producer-closed', (data) async {
      final remoteProducerId = data['remoteProducerId'];
      final socketId = data['socketId'];
      final source = data['source'];
      print("in section of producer closed");
      print(
          "Producer closed: remoteProducerId: $remoteProducerId, socketId: $socketId, source: $source");

      final userIndex =
          users.indexWhere((user) => user['socketId'] == socketId);
      print("checking the user ${users[userIndex]}");
      if (source == 'camera') {
        if (userIndex != -1) {
          users[userIndex]
              .remove('videoRenderer');  
          users[userIndex]['videoRenderer'] = RTCVideoRenderer();
        } else {
          print('User not found');
        }
      } else if (source == 'mic') {
        if (userIndex != -1) {
          users[userIndex]
              .remove('AudioRenderer'); 
          users[userIndex]['AudioRenderer'] = RTCVideoRenderer();
          await users[userIndex]['AudioRenderer']
              .initialize(); 
          Refresh('Audio Rendering Deleted and then updated');
        } else {
          print('User not found');
        }
      } else if (source == 'screen') {
        if (userIndex != -1) {
          users[userIndex]
              .remove('hasScreenSharingOn'); 
          users[userIndex]['hasScreenSharingOn'] = RTCVideoRenderer();
          await users[userIndex]['hasScreenSharingOn']
              .initialize();
          users[userIndex]['hasScreenSharingOn'] = false;
          Refresh('Screen Rendering Deleted and then updated');
        } else {
          print('User not found');
        }
      }

      print("checking the consumerTransports ${consumerTransports}");
      final producerToClose = consumerTransports.firstWhere(
          (transportData) => transportData['producerId'] == remoteProducerId);
      print("producer-closed part check ${producerToClose}");
      producerToClose['consumerTransport'].close();
      producerToClose['consumer'].close();

      consumerTransports = consumerTransports
          .where((transportData) =>
              transportData['producerId'] != remoteProducerId)
          .toList();
      print("Fileter consumerTransports part ${consumerTransports}");
    });

    socket.on('alert-socket', (socketId) {
      print("Alert received from server: $socketId");
      users.removeWhere((user) => user['socketId'] == socketId);
      Refresh('User is removed ${socketId}');
    });

    socket.on('connect_error', (error) {
      print('Connection error: $error');
    });

    socket.on('disconnect', (_) {
      print('disconnected from server');
    });

    socket.connect();
  }

  void AlertServerToRemoveMap(
      String source, String id, String roomName, String socketid) {
    print(
        "checking what is comming data format ${source} , ${id} , ${roomName} , ${socketid}");
    socket.emit('AlertServertoRemoveMap', {
      'source': source,
      'id': id,
      'roomName': roomName,
      'socketid': socketid,
    });
  }

  void joinRoom(String roomName, String username, String device) {
    print('Joining room...');
    print('${roomName},${username}&&&${device}');
    socket.emit(
      'joinRoom',
      {'roomName': roomName, 'username': username, 'devices': device},
    );
  }

  Future<void> createDevice(List<dynamic> existingPeers) async {
    try {

      device = Device();

      await device.load(routerRtpCapabilities: rtpCapabilities!);

      print('Device RTP Capabilities: ${device.rtpCapabilities}');
      print("existingPeers ${existingPeers}");
      await createSendTransport();

      for (var peer in existingPeers) {
        print('Found existing peer: ${peer['socketId']}, setting up consumer');
        print('Peer details: ${peer['peerDetails']}');
        print('Peer details checking name: ${peer['peerDetails']['name']}');

        final newUser = {
          'username': peer['peerDetails']['name'],
          'socketId': peer['socketId'],
          'Device': peer['peerDetails']['device'],
          'videoRenderer': RTCVideoRenderer(),
          'AudioRenderer': RTCVideoRenderer(),
          'screenShareRenderer':
              RTCVideoRenderer(), 
          'hasScreenSharingOn': false,
        };
        users.add(newUser);
        print("Existing User added: $users");

        if (peer['producerId'] != null && peer['producerId'].isNotEmpty) {
          print('ProducerId: ${peer['producerId']}');

          await signalNewConsumerTransport(
              peer['producerId'], peer['socketId']);
        } else {
          print('No ProducerId');
          Refresh('existinguserupdate');
        }
      }
    } catch (error) {
      print('Error creating device: $error');
      if (error.toString().contains('UnsupportedError')) {
        print('Browser or platform not supported');
      }
    }
  }

  void _producerCallback(Producer producer) {
    print("Producer created: ${producer.id}");

    producer.on('trackended', () {
      print("Producer track ended");
    });

    producer.on('transportclose', () {
      print("Transport closed for this producer");
    });
  }

  Future<void> createSendTransport() async {
    print("Entering Into CreateSendTransport ---------");
    socket.emitWithAck('createWebRtcTransport', {'consumer': false},
        ack: (data) {
      print("CalllBack Complish");
      if (data['error'] != null) {
        print('Error creating WebRTC transport: ${data['error']}');
        return;
      }

      var transportInfo = data['params'];

      print('Params:');
      print('params-id: ${transportInfo['id']}');
      print('params-iceParameters: ${transportInfo['iceParameters']}');
      print('params-iceCandidates: ${transportInfo['iceCandidates']}');
      print('params-dtlsParameters: ${transportInfo['dtlsParameters']}');

      producerTransport = device.createSendTransportFromMap(
        transportInfo,
        producerCallback: _producerCallback,
      );

      print(" sendTransport ${producerTransport}");

      producerTransport.on('connect', (Map data) {
        print("Transport connect event triggered");

        var callback = data['callback'];
        var errback = data['errback'];

        try {

          socket.emit('transport-connect', {
            'transportId': producerTransport.id,
            'dtlsParameters': data['dtlsParameters'].toMap(),
          });
          print("checking the transport callback");

          callback();
        } catch (error) {
          print("Error during transport connect: $error");
          errback(error);
        }
      });

      producerTransport.on('produce', (Map data) {
        print("Produce event received: $data");

        var callback = data['callback'];
        var errback = data['errback'];

        try {
          var kind = data['kind'];
          var rtpParameters = data['rtpParameters'];
          var appData = data['appData'];

          socket.emitWithAck('transport-produce', {
            'transportId': producerTransport.id,
            'kind': kind,
            'rtpParameters': rtpParameters.toMap(),
            'appData':
                appData != null ? Map<String, dynamic>.from(appData) : null,
          }, ack: (response) {
            print("transport-produce successful: ${response['id']}");

            final storeid = {
              'id': response['id'],
              'source': response['source']
            };

            storeidandsource.add(storeid);

            callback(response['id']);
          });
        } catch (error) {
          print("Error during transport produce: $error");
          errback(error);
        }
      });
    });
  }

  Future<void> connectSendTransportVideo(
      MediaStream localStream, MediaStreamTrack localtrack) async {
    print("enter into connectSendTransportVideo");
    print("Checking localStream ${localStream}");
    print("Checking localtrack ${localtrack}");

    print("Checking my Producer Transport ${producerTransport}");

      try {
        producerTransport.produce(
            stream: localStream,
            track: localtrack,
            source: 'camera',
            appData: {
              'source': 'camera',
            },
            codecOptions: ProducerCodecOptions(
              videoGoogleStartBitrate: 1000,
            ),
            encodings: []);

        print("connectSendTransportVideo: ${producerTransport.id}");

        producerTransport.on('trackended', () {
          print("video track ended");
        });

        producerTransport.on('transportclose', () {
          print('video transport ended');

        });
      } catch (e) {
        print('Error during video production: $e');
      }
    
  }

  Future<void> connectSendTransportAudio(
      MediaStream _localAudioStream, MediaStreamTrack _localAudioTrack) async {
    print("Checking my Producer Transport for audio ${producerTransport}");


      try {
        producerTransport.produce(
          stream: _localAudioStream,
          track: _localAudioTrack,
          source: 'mic', 
          appData: {
            'source': 'mic',
          },
          encodings: [],
        );

        print(
            "Audio streaming started with transport ID: ${producerTransport.id}");

        producerTransport.on('trackended', () {
          print("Audio track ended.");
        });

        producerTransport.on('transportclose', () {
          print('Audio transport closed.');
        });
      } catch (e) {
        print('Error during audio production: $e');
      }
    
  }

  Future<void> connectSendTransportScreenSharing(
      MediaStream _localscreensharingStream,
      MediaStreamTrack _localscreensharingTrack) async {
    print(
        "Checking my Producer Transport for SharingStream ${producerTransport}");


      try {

        producerTransport.produce(
          stream: _localscreensharingStream,
          track: _localscreensharingTrack,
          source: 'screen',
          appData: {
            'source': 'screen',
          },
        );

        print("Screen sharing track is now being produced");

        producerTransport.on('trackended', () {
          print("Screen sharing track ended");
        });

        producerTransport.on('transportclose', () {
          print('Screen sharing transport closed');
        });
      } catch (e) {
        print('Error during ScreenSharing production: $e');
      }
   
  }

  void _consumerCallback(Consumer consumer, accept, socketId) async {
    if (socketId == socketid) {
      return;
    } else {
      print("Consumer created: ${consumer.id}");

      MediaStreamTrack track = consumer.track;
      print("checking track in callback consumer ${track}");
      print("Received track in callback consumer: ${track.id}");

      var paramater = accept({});
      print("checkwhat is comming in accept callback ${paramater}");
      print(
          "Also checking here the Parameter of Source ${paramater['Source']}");

      consumerTransports.add({
        'consumerTransport': paramater['consumerTransport'],
        'serverConsumerTransportId': paramater['serverConsumerTransportId'],
        'producerId': paramater['remoteProducerId'],
        'consumer': consumer
      });
      print(
          "Check the paramaters kind ====== ${paramater['kind']} And Source ${paramater['Source']}");
      if (paramater['kind'] == 'audio') {
        final Map<String, dynamic> checkuser = users.firstWhere(
          (user) => user['socketId'] == socketId,
          orElse: () =>
              {'error': 'User not found'},
        );
        if (checkuser.containsKey('error')) {
          print("User with socketId $socketId not found for audio");
        } else {
          MediaStream AudioStream = await createLocalMediaStream('AudioStream');
          await AudioStream.addTrack(track);

          checkuser['AudioRenderer'].srcObject = AudioStream;
          Refresh('Audio updated');

        }
      }
      if (paramater['kind'] == 'video') {
        if (paramater['Source'] == 'camera') {
          final Map<String, dynamic> VideoUser = users.firstWhere(
            (user) => user['socketId'] == socketId,
            orElse: () => {'error': 'User not found'},
          );
          if (VideoUser.containsKey('error')) {
            print(
                "User with socketId $socketId not found for Video RENDERING.");
          } else {
            MediaStream remoteStream =
                await createLocalMediaStream('remoteStream');
            print("Created local media stream.In callback consumer");

            await remoteStream.addTrack(track);
            RTCVideoRenderer renderer = VideoUser['videoRenderer'];
            try {
              await renderer.initialize();
              print("Renderer initialized for video stream.");

              renderer.srcObject = remoteStream;
              Refresh('Video Rendering updated');
            } catch (e) {
              print("Error initializing renderer: $e");
            }
          }
        }
        if (paramater['Source'] == 'screen') {
          print(
              "✅ Consumer received for screen sharing with track: ${track.id}");

          final Map<String, dynamic>? screenUser = users.firstWhere(
            (user) => user['socketId'] == socketId,
            orElse: () {
              print(
                  "🚨 No matching user found for screen share with socketId: $socketId");
              return {};
            },
          );

          if (screenUser!.isEmpty) {
            print("🚨 No valid user found for screen share.");
            return; 
          }

          print("🟢 User found for screen share: ${screenUser['username']}");

          MediaStream screenShareStream =
              await createLocalMediaStream('screenShareStream');
          await screenShareStream.addTrack(track);

          print("🔍 Adding track to screenShareRenderer...");

          RTCVideoRenderer screenRenderer = screenUser['screenShareRenderer'];

          if (screenRenderer.textureId == null) {
            await screenRenderer.initialize();
          }

          screenUser['screenShareRenderer'].srcObject = screenShareStream;
          screenUser['hasScreenSharingOn'] = true;

          print(
              "✅ Screen sharing successfully bound for ${screenUser['username']}");
          Refresh('Screen sharing updated');
        }
      }

      socket.emit('consumer-resume', {
        'serverConsumerId': paramater['serverConsumerId'],
      });
      print("Track added to remote stream in callback consumer");
    }
  }

  Future<void> signalNewConsumerTransport(
      String remoteProducerId, String socketId) async {
    print("signalNewConsumerTransport: $remoteProducerId, $socketId");

    if (consumingTransports.contains(remoteProducerId)) {
      print("Already consuming this remote producer");
      return;
    }

    consumingTransports.add(remoteProducerId);

    socket.emitWithAck('createWebRtcTransport', {'consumer': true},
        ack: (data) async {
      print("Received transport params: $data");

      if (data['error'] != null) {
        print('Error creating consumer transport: ${data['error']}');
        return;
      }

      final params = Map<String, dynamic>.from(data['params']);
      print('signalNewConsumerTransport Params:');
      print('signalNewConsumerTransport params-id: ${params['id']}');
      print(
          'signalNewConsumerTransport params-iceParameters: ${params['iceParameters']}');
      print(
          'signalNewConsumerTransport params-iceCandidates: ${params['iceCandidates']}');
      print(
          'signalNewConsumerTransport params-dtlsParameters: ${params['dtlsParameters']}');

      Transport consumerTransport;
      try {
        consumerTransport = device.createRecvTransportFromMap(
          params,
          consumerCallback: (Consumer consumer, [dynamic accept]) =>
              _consumerCallback(consumer, accept, socketId),
        );
        print("cusmerTransport ${consumerTransport.id}");
      } catch (error) {
        print("Error creating RecvTransport: $error");
        return;
      }

      consumerTransport.on('connect', (Map data) async {
        var callback = data['callback'];
        var errback = data['errback'];

        try {
          if (data['dtlsParameters'] != null) {
            print(
                "Checking the dtlsparameter: ${data['dtlsParameters'].toMap()}");

            socket.emit('transport-recv-connect', {
              'dtlsParameters': data['dtlsParameters'].toMap(),
              'serverConsumerTransportId': consumerTransport.id,
            });

            callback();
          } else {
            throw Exception("dtlsParameters are missing or null.");
          }
        } catch (error) {
          print("Error during transport-recv-connect: $error");
          errback(error); 
        }
      });

      print("Connecting recv transport to peer: $socketId , $remoteProducerId");
      await connectRecvTransport(
          consumerTransport, remoteProducerId, consumerTransport.id, socketId);
    });
  }

  Future<void> connectRecvTransport(
      Transport consumerTransport,
      String remoteProducerId,
      String serverConsumerTransportId,
      String socketId) async {
    try {
      print("--Entr into connectRecvTransport--- $serverConsumerTransportId");
      socket.emitWithAck('consume', {
        'rtpCapabilities': device.rtpCapabilities.toMap(),
        'remoteProducerId': remoteProducerId,
        'serverConsumerTransportId': serverConsumerTransportId,
      }, ack: (response) async {
        if (response == null) {
          print("Response from consume event is null.");
          return;
        }

        final params = response['params'];

        print("Consumer Params: $params");
        print("Response id check ${params['id']}");

        consumerTransport.consume(
            id: params['id'],
            producerId: params['producerId'],
            kind: RTCRtpMediaTypeExtension.fromString(params['kind']),
            rtpParameters: RtpParameters.fromMap(params['rtpParameters']),
            peerId: socketId,
            accept: (param) {
              print("check the params ${params}");
              print("checking the Source from Params ${params['Source']}");

              var param = {
                'consumerTransport': consumerTransport,
                'serverConsumerTransportId': params['id'],
                'producerId': remoteProducerId,
                'kind': params['kind'],
                'Source': params['Source'],
                'serverConsumerId': params['serverConsumerId']
              };
              print("checking the parm that will return ${param}");

              return param;
            });
      });
    } catch (error) {
      print("Error in connectRecvTransport: $error");
    }
  }

  void disconnect() {
    socket.disconnect();
  }
}
