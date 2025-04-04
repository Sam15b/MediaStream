import 'package:flutter/material.dart';
import 'package:flutter_webrtc/flutter_webrtc.dart';

class UserVideoCard extends StatefulWidget {
  final String username;
  final RTCVideoRenderer renderer;
  final RTCVideoRenderer Audiorenderer;
  final String Device;
  final int index;
  final double height; 

  const UserVideoCard(
      {required this.username,
      required this.renderer,
      required this.Audiorenderer,
      required this.Device,
      required this.index,
      required this.height, 
      Key? key})
      : super(key: key);

  @override
  State<UserVideoCard> createState() => _UserVideoCardState();
}

class _UserVideoCardState extends State<UserVideoCard> {
  @override
  void initState() {
    super.initState();
    _initializeAudioRenderer();
  }

  void _initializeAudioRenderer() async {
    await widget.Audiorenderer.initialize();
    setState(() {}); 
  }

  @override
  void dispose() {
    widget.Audiorenderer.dispose(); 
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      height: widget.height, 
      decoration: BoxDecoration(
        color: Colors.grey[900],
        borderRadius: BorderRadius.circular(10),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 5,
            spreadRadius: 2,
          ),
        ],
      ),
      child: Column(
        children: [
          Expanded(
            child: ClipRRect(
              borderRadius: BorderRadius.circular(10),
              child: AspectRatio(
                aspectRatio: 16 / 9,
                child: (widget.index == 0)
                    ? RTCVideoView(widget.renderer, mirror: true)
                    : (widget.index != 0 && widget.Device == 'phone')
                        ? FittedBox(
                            fit: BoxFit
                                .contain, 
                            child: RotatedBox(
                              quarterTurns: 1, 
                              child: SizedBox(
                                width: widget.height,
                                height: widget.height *
                                    (9 / 16), 
                                child:
                                    RTCVideoView(widget.renderer, mirror: true),
                              ),
                            ),
                          )
                        : SizedBox(
                            width: double.infinity, 
                            height: widget.height, 
                            child: RTCVideoView(
                              widget.renderer,
                              mirror: true,
                              objectFit: RTCVideoViewObjectFit
                                  .RTCVideoViewObjectFitCover, 
                            ),
                          ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(8.0),
            child: Text(
              widget.username,
              style: TextStyle(color: Colors.white),
              overflow: TextOverflow.ellipsis,
              maxLines: 1,
            ),
          ),
        ],
      ),
    );
  }
}
