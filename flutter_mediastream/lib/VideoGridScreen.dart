import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_mediastream/UserVideoCard.dart';
import 'package:flutter_mediastream/services/mediasoup_service.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';
import 'package:share_plus/share_plus.dart';


class VideoGridScreen extends StatefulWidget {

  final String user_name;
  final String room_name;

  VideoGridScreen({required this.user_name, required this.room_name});

  @override
  State<VideoGridScreen> createState() => _VideoGridScreenState();
}

class _VideoGridScreenState extends State<VideoGridScreen> {
  late MediasoupService mediasoupService;
  bool isVisible = true;
  bool showBottomIcons = false;

  bool isMuted = true;

  bool isVideoOff = true;

  bool isScreenSharing = true;

  final RTCVideoRenderer _localRenderer = RTCVideoRenderer();
  MediaStream? _localStream;
  MediaStreamTrack? _localVideoTrack;
  MediaStream? _localAudioStream;
  MediaStreamTrack? _localAudioTrack;
  MediaStreamTrack? _localscreensharingTrack;
  MediaStream? _localscreensharingStream;
  PageController _pageController = PageController();


  @override
  void initState() {
    super.initState();
    mediasoupService = MediasoupService(
      Refresh: _refreshcard,
    );
    mediasoupService.connectToServer(widget.room_name, widget.user_name);

    _initRenderers();
    _initLocalRenderer();

    Timer.periodic(Duration(milliseconds: 600), (timer) {
      setState(() {
        isVisible = !isVisible;
      });
    });

    Timer.periodic(Duration(seconds: 1), (timer) {
      if (mounted) {
        _updateSystemUI();
      } else {
        timer.cancel();
      }
    });
  }

  Future<void> _initLocalRenderer() async {
    await _localRenderer.initialize();
  }

  Future<void> _initRenderers() async {
    for (var user in mediasoupService.users) {
      await user['videoRenderer'].initialize();
    }
  }

  void _toggleVideo() async {
    if (isVideoOff) {
      print("video Enable is check---");
      await _enableVideo(); 
    } else {
      _disableVideo(); 
    }
    setState(() {
      isVideoOff = !isVideoOff;
    });
  }

  Future<void> _enableVideo() async {
    try {
      final stream = await navigator.mediaDevices.getUserMedia({
        'video': {
          'width': {'ideal': 320},
          'height': {'ideal': 240},
        },
        'audio': false,
      });

      _localVideoTrack = stream.getVideoTracks().first;
      _localStream = stream;

      await _localRenderer.initialize();
      _localRenderer.srcObject = _localStream;
      print("Video is now producing checked");

      final videoRenderer = mediasoupService.users[0]['videoRenderer'];
      await videoRenderer.initialize();
      videoRenderer.srcObject = _localStream;

      _connectSendTransportVideo();
    } catch (e) {
      print('Error accessing camera: $e');
    }
  }

  void _disableVideo() {
    if (_localVideoTrack != null) {
      _localVideoTrack!.stop(); 
      _localVideoTrack = null; 

      if (_localStream != null) {
        _localStream!.getTracks().forEach((track) {
          track.stop();
        });
        _localStream = null; 
      }
      mediasoupService.users[0].remove('videoRenderer');
      mediasoupService.users[0]['videoRenderer'] = RTCVideoRenderer();

      final videoItem = mediasoupService.storeidandsource.firstWhere(
        (item) => item['source'] == 'camera',
        orElse: () => {'id': 'Not found'},
      );

      final id = videoItem['id'];

      mediasoupService.storeidandsource
          .removeWhere((item) => item['source'] == 'camera');

      mediasoupService.AlertServerToRemoveMap('camera', id, widget.room_name,
          mediasoupService.users[0]['socketId'].toString());

      setState(() {
        print("Video Disabled");
      });
    }
  }

  Future<void> _connectSendTransportVideo() async {
    print("Sending video stream...");

    if (_localVideoTrack == null) {
      print('No local video track available.');
      return;
    }

    try {
      print("Local Video Track: $_localVideoTrack");

      print("Calling producerTransport.produce...");

      await mediasoupService.connectSendTransportVideo(
          _localStream!, _localVideoTrack!);

      print("Video Producing started");
    } catch (e, stacktrace) {
      print('Error producing video: $e');
      print('Stacktrace: $stacktrace');
    }
  }

  void _refreshcard(String type) {
    setState(() {
      print("checking for what refresh?${type}");
    });
  }


  void _onScreenTapped() {
    setState(() {
      showBottomIcons = !showBottomIcons;
    });
  }

  void _toggleMute() async {
    if (isMuted) {
      print("audio Enable is check---");
      await _enableAudio();
    } else {
      _disableAudio();
    }
    setState(() {
      isMuted = !isMuted;
    });
  }

  Future<void> _enableAudio() async {
    try {
      final stream = await navigator.mediaDevices.getUserMedia({
        'audio': true,
        'video': false,
      });

      print("Audio is going to enabled .");

      _localAudioTrack = stream.getAudioTracks().first;
      _localAudioStream = stream;

      print("Audio is now enabled and streaming to peers.");

      _connectAudioToPeersOnly();
    } catch (e) {
      print('Error enabling audio: $e');
    }
  }

  Future<void> _connectAudioToPeersOnly() async {
    if (_localAudioTrack == null) {
      print('No local Audio track available.');
      return;
    }
    try {
      print("Local Audio Track: $_localAudioTrack");

      print("Calling producerTransport.produce...");

      await mediasoupService.connectSendTransportAudio(
          _localAudioStream!, _localAudioTrack!);

      print("Audio Producing started");
    } catch (e, stacktrace) {
      print('Error producing audio: $e');
      print('Stacktrace audio: $stacktrace');
    }
  }

  void _disableAudio() {
    try {
      if (_localAudioTrack != null) {
        _localAudioTrack!.stop(); 
        _localAudioTrack = null; 
      }

      if (_localAudioStream != null) {
        _localAudioStream!.getTracks().forEach((track) {
          track.stop(); 
        });
        _localAudioStream = null; 
      }

      mediasoupService.users[0].remove('AudioRenderer');
      mediasoupService.users[0]['AudioRenderer'] = RTCVideoRenderer();

      final AudioItem = mediasoupService.storeidandsource.firstWhere(
        (item) => item['source'] == 'mic',
        orElse: () => {'id': 'Not found'},
      );

      final id = AudioItem['id'];

      mediasoupService.storeidandsource
          .removeWhere((item) => item['source'] == 'mic');

      mediasoupService.AlertServerToRemoveMap('mic', id, widget.room_name,
          mediasoupService.users[0]['socketId'].toString());

      setState(() {
        print("Audio has been disabled.");
      });
    } catch (e) {
      print('Error disabling audio: $e');
    }
  }

  void _toggleScreenSharing() async {
    if (isScreenSharing) {
      print("screen sharing is on ");
      
      await _enableScreenSharing();
    } else {
     
      _disableScreenSharing();
    }
    setState(() {
      isScreenSharing = !isScreenSharing;
    });
  }

  Future<void> _enableScreenSharing() async {
    try {
      print("CHeck for _localscreensharingStream");
      _localscreensharingStream = await navigator.mediaDevices.getDisplayMedia({
        'video': {
          'cursor': 'always', 
        },
        'audio': false, 
      });
      print("CHeck for _localscreensharingStream222");
      _localscreensharingTrack =
          _localscreensharingStream!.getVideoTracks().first;

      final ScreenRenderer = mediasoupService.users[0]['screenShareRenderer'];
      await ScreenRenderer.initialize();
      ScreenRenderer.srcObject = _localscreensharingStream;
      mediasoupService.users[0]['hasScreenSharingOn'] = true;

      _connectSendTransportScreen();

      print("Screen sharing enabled");
    } catch (e) {
      print('Error enabling screen sharing: $e');
    }
  }

  Future<void> _disableScreenSharing() async {
    if (_localscreensharingTrack != null) {
      _localscreensharingTrack!.stop(); 
      _localscreensharingTrack = null; 

      if (_localscreensharingStream != null) {
        _localscreensharingStream!.getTracks().forEach((track) {
          track.stop(); 
        });
        _localscreensharingStream = null; 
      }

      mediasoupService.users[0].remove('screenShareRenderer');
      mediasoupService.users[0]['hasScreenSharingOn'] = false;
      mediasoupService.users[0]['screenShareRenderer'] = RTCVideoRenderer();

      final ScreenSharingItem = mediasoupService.storeidandsource.firstWhere(
        (item) => item['source'] == 'screen',
        orElse: () => {'id': 'Not found'},
      );

      final id = ScreenSharingItem['id'];

      mediasoupService.storeidandsource
          .removeWhere((item) => item['source'] == 'screen');

      mediasoupService.AlertServerToRemoveMap('screen', id, widget.room_name,
          mediasoupService.users[0]['socketId'].toString());

      setState(() {
        print("Screen Sharing Disabled");
      });
    }
  }

  Future<void> _connectSendTransportScreen() async {
    if (_localscreensharingTrack == null) {
      print("Screen sharing is not enable");
      return;
    }
    try {
      print("Local Streaming Track: $_localscreensharingTrack");

      print("Calling Streaming producerTransport.produce...");

      await mediasoupService.connectSendTransportScreenSharing(
          _localscreensharingStream!, _localscreensharingTrack!);

      print("Audio Producing started");
    } catch (e, stacktrace) {
      print('Error producing ScreenStream: $e');
      print('Stacktrace ScreenStream: $stacktrace');
    }
  }

  void _hangUp() {
    
    print("Hang Up Call");
    Navigator.pop(context);
  }

  void _updateSystemUI() {
    if (MediaQuery.of(context).orientation == Orientation.landscape) {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.immersiveSticky,
          overlays: []);
    } else {
      SystemChrome.setEnabledSystemUIMode(SystemUiMode.edgeToEdge);
    }
  }

  @override
  Widget build(BuildContext context) {
    int userCount = mediasoupService.users.length;
    int totalPages = (userCount / 6).ceil();
    bool hasScreenShare =
        mediasoupService.users.any((user) => user['hasScreenSharingOn']);

    return Scaffold(
      backgroundColor: Colors.black,
      body: GestureDetector(
        onTap: _onScreenTapped,
        child: Stack(
          children: [
            PageView.builder(
              controller: _pageController,
              scrollDirection: Axis.horizontal,
              itemCount: hasScreenShare ? totalPages + 1 : totalPages,
              itemBuilder: (context, pageIndex) {
                bool isLandscape =
                    MediaQuery.of(context).orientation == Orientation.landscape;
                if (pageIndex == 0 && hasScreenShare) {
                  SystemChrome.setPreferredOrientations([]);

                  var screenSharingUser = mediasoupService.users.firstWhere(
                    (user) => user['hasScreenSharingOn'],
                    orElse: () => <String, dynamic>{},
                  );

                  if (screenSharingUser.isNotEmpty) {
                    double screenWidth = MediaQuery.of(context).size.width;
                    double screenHeight =
                        MediaQuery.of(context).size.height - 40;
                    double aspectRatio =
                        screenWidth / screenHeight; 

                    return Container(
                      width: MediaQuery.of(context).size.width,
                      height: MediaQuery.of(context).size.height,
                      color: Colors.black, 
                      child: Stack(
                        alignment: Alignment.center,
                        children: [
                          Positioned.fill(
                            child: ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: AspectRatio(
                                aspectRatio: aspectRatio, 
                                child: RTCVideoView(
                                  screenSharingUser['screenShareRenderer'],
                                  mirror:
                                      false, 
                                ),
                              ),
                            ),
                          ),
                          if (!isLandscape)
                            Positioned(
                              top: 20,
                              child: Container(
                                padding: EdgeInsets.symmetric(
                                    horizontal: 16, vertical: 8),
                                decoration: BoxDecoration(
                                  color: Colors.black.withOpacity(0.6),
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Text(
                                  "Presented by ${screenSharingUser['username']}",
                                  style: TextStyle(
                                      color: Colors.white,
                                      fontSize: 18,
                                      fontWeight: FontWeight.bold),
                                ),
                              ),
                            ),
                        ],
                      ),
                    );
                  }
                } 

                int userCount = mediasoupService.users.length;
                int startIdx =
                    (hasScreenShare ? (pageIndex - 1) : pageIndex) * 6;

                if (startIdx >= userCount) {
                  print("Checking the Starting Index ${startIdx}");
                  return SizedBox(); 
                }

                int endIdx = (startIdx + 6)
                    .clamp(0, userCount); 


                List usersToShow =
                    mediasoupService.users.sublist(startIdx, endIdx);

                double screenHeight = MediaQuery.of(context).size.height;
                double availableHeight = screenHeight - 40; 

                double cardHeight;
                if (usersToShow.length <= 3) {
                  cardHeight = availableHeight /
                      3; 
                } else {
                  cardHeight = availableHeight /
                      ((usersToShow.length / 2).ceil());
                }

                print("check the height of the card: $cardHeight");
                print(
                    "checking the child Aspect ratio ${usersToShow.length <= 3 ? ((MediaQuery.of(context).size.width / cardHeight) + 0.1) : (MediaQuery.of(context).size.width / (cardHeight * 2))}");

                return Padding(
                  padding: const EdgeInsets.all(5.0),
                  child: SizedBox(
                    height: availableHeight, 
                    child: GridView.builder(
                      physics:
                          NeverScrollableScrollPhysics(), 
                      gridDelegate: SliverGridDelegateWithFixedCrossAxisCount(
                        crossAxisCount: isLandscape?3 :usersToShow.length <= 3 ? 1 : 2,
                        crossAxisSpacing: 8,
                        mainAxisSpacing: 8,
                        childAspectRatio: isLandscape?(MediaQuery.of(context).size.width / (availableHeight * 1.6)) : usersToShow.length <= 3
                            ? ((MediaQuery.of(context).size.width /
                                    cardHeight) +
                                0.15)
                            : (MediaQuery.of(context).size.width /
                                (cardHeight * 1.8)),
                      ),
                      itemCount: usersToShow.length,
                      itemBuilder: (context, index) {
                        var user = usersToShow[index];
                        return UserVideoCard(
                          username: user['username'],
                          renderer: user['videoRenderer'],
                          Audiorenderer: user['AudioRenderer'],
                          Device: user['Device'],
                          index: index,
                          height: cardHeight, 
                        );
                      },
                    ),
                  ),
                );
              },
            ),
            Visibility(
              visible: showBottomIcons,
              child: SafeArea(
                child: Align(
                  alignment: Alignment.topCenter,
                  child: Padding(
                    padding: const EdgeInsets.only(top: 0.0),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        AnimatedOpacity(
                          duration: Duration(milliseconds: 600),
                          opacity: isVisible ? 1.0 : 0.2,
                          child: Container(
                            width: 12,
                            height: 12,
                            decoration: BoxDecoration(
                              color: Colors.yellow,
                              shape: BoxShape.circle,
                            ),
                          ),
                        ),
                        SizedBox(width: 8),
                        Text(
                          "Share & connect with friends! Invite",
                          style: TextStyle(color: Colors.white, fontSize: 16),
                        ),
                        IconButton(
                          icon: Icon(Icons.link, color: Colors.blueAccent),
                          onPressed: () async {
                            final String meetingUrl =
                                "https://mediastream.it.com/?RID=${Uri.encodeComponent(widget.room_name)}";
                
                            final String message = """
                ${widget.user_name} has invited you to join a Meeting.                
                🔗 Join the meeting:
                $meetingUrl                          
                📌 Or join using Room ID: ${widget.room_name}
                """;
                
                            
                            await Share.share(message);
                          },
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Visibility(
              visible: showBottomIcons,
              child: SafeArea(
                child: Align(
                  alignment: Alignment.bottomCenter,
                  child: Padding(
                    padding: const EdgeInsets.only(bottom: 8.0),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceEvenly,
                      children: [
                        Container(
                          width: 60, 
                          height: 65, 
                          decoration: BoxDecoration(
                            color: Colors.red,
                            shape: BoxShape.circle,
                          ),
                          child: IconButton(
                            icon: Icon(Icons.call_end, color: Colors.white),
                            iconSize: 36,
                            onPressed: _hangUp,
                          ),
                        ),
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                          child: IconButton(
                            icon: Icon(
                              isVideoOff
                                  ? Icons.videocam_off_outlined
                                  : Icons.videocam_outlined,
                              color: Colors.black,
                            ),
                            iconSize: 32,
                            onPressed: _toggleVideo,
                          ),
                        ),
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.white,
                            shape: BoxShape.circle,
                          ),
                          child: IconButton(
                            icon: Icon(
                              isMuted
                                  ? Icons.mic_off_outlined
                                  : Icons.mic_outlined,
                              color: Colors.black,
                            ),
                            iconSize: 32,
                            onPressed: _toggleMute,
                          ),
                        ),
                        Container(
                          decoration: BoxDecoration(
                            color: Colors.grey[800],
                            shape: BoxShape.circle,
                          ),
                          child: IconButton(
                            icon: Icon(
                              isScreenSharing
                                  ? Icons.stop_screen_share
                                  : Icons.screen_share,
                              color: Colors.white,
                            ),
                            iconSize: 32,
                            onPressed: _toggleScreenSharing,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  void dispose() {
    _localRenderer.dispose();
    _localStream?.dispose();
    for (var user in mediasoupService.users) {
      user['renderer'].dispose();
    }
    super.dispose();
  }
}

