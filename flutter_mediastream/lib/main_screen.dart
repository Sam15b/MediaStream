import 'dart:math';

import 'package:flutter/material.dart';
import 'package:flutter_mediastream/VideoGridScreen.dart';
import 'package:url_launcher/url_launcher.dart';

class Main_page extends StatefulWidget {
  @override
  State<Main_page> createState() => _Main_pageState();
}

class _Main_pageState extends State<Main_page> {
  TextEditingController JR_Name = TextEditingController();
  TextEditingController JR_Rid = TextEditingController();
  TextEditingController CR_Name = TextEditingController();
  final GlobalKey<FormState> _joinRoomFormKey = GlobalKey<FormState>();
  final GlobalKey<FormState> _createRoomFormKey = GlobalKey<FormState>();

  String generateId() {
    const String characters =
        'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    Random random = Random();
    return List.generate(
        5, (index) => characters[random.nextInt(characters.length)]).join();
  }

  void _validateJoinRoom() {
    if (_joinRoomFormKey.currentState!.validate()) {

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
            builder: (context) => VideoGridScreen(
                room_name: JR_Rid.text, user_name: JR_Name.text)),
      );
    }
  }

  void _validateCreateRoom() {
    if (_createRoomFormKey.currentState!.validate()) {
      final String id = generateId();
      print(id);

      Navigator.pushReplacement(
        context,
        MaterialPageRoute(
            builder: (context) => VideoGridScreen(
                room_name: id.toString(), user_name: CR_Name.text)),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            children: [
              const SizedBox(height: 50),
              Center(
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Text(
                      'Media',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFFDEB887),
                      ),
                    ),
                    SizedBox(
                      width: 10,
                    ),
                    const Text(
                      'Streaming',
                      style: TextStyle(
                        fontSize: 24,
                        fontWeight: FontWeight.bold,
                        color: Color(0xFF90EE90),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
              _buildCard(
                title: 'Join Room',
                formKey: _joinRoomFormKey,
                children: [
                  _buildInputField('Name', 'Enter your Name', null, JR_Name),
                  const SizedBox(height: 12),
                  _buildInputField('Room ID', 'Enter Room Id', 5, JR_Rid),
                  const SizedBox(height: 20),
                  _buildSubmitButton(_validateJoinRoom),
                ],
              ),
              const SizedBox(height: 20),
              _buildCard(
                title: 'Create Room',
                formKey: _createRoomFormKey,
                children: [
                  _buildInputField('Name', 'Enter your Name', null, CR_Name),
                  const SizedBox(height: 20),
                  _buildSubmitButton(_validateCreateRoom),
                ],
              ),
              const SizedBox(
                height: 50,
              ),
              Row(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  TextButton(
                    onPressed: () async {
                      final Uri url = Uri.parse(
                          "https://mediastream.it.com/Terms&Conditions");
                      if (await canLaunchUrl(url)) {
                        await launchUrl(url,
                            mode: LaunchMode.externalApplication);
                      } else {
                        print("Could not launch $url");
                      }
                    },
                    child: const Text(
                      'Terms & Conditions',
                      style: TextStyle(color: Colors.blue),
                    ),
                  ),
                  const SizedBox(width: 10),
                  TextButton(
                    onPressed: () async {
                      final Uri url = Uri.parse(
                          "https://mediastream.it.com/PrivacyPolicy");
                      if (await canLaunchUrl(url)) {
                        await launchUrl(url,
                            mode: LaunchMode.externalApplication);
                      } else {
                        print("Could not launch $url");
                      }
                    },
                    child: const Text(
                      'Privacy Policy',
                      style: TextStyle(color: Colors.blue),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildCard(
      {required String title,
      required GlobalKey<FormState> formKey,
      required List<Widget> children}) {
    return Card(
      elevation: 4,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
      child: Column(
        children: [
          Container(
            decoration: BoxDecoration(
              color: Colors.blue[800],
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(10),
                topRight: Radius.circular(10),
              ),
            ),
            padding: const EdgeInsets.symmetric(vertical: 12),
            width: double.infinity,
            child: Center(
              child: Text(
                title,
                style: const TextStyle(
                  color: Colors.white,
                  fontWeight: FontWeight.bold,
                  fontSize: 18,
                ),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Form(
              key: formKey,
              child: Column(
                children: children,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputField(String label, String placeholder, int? maxLength,
      TextEditingController controller) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            fontSize: 14,
          ),
        ),
        const SizedBox(height: 6),
        TextFormField(
          controller: controller,
          maxLength: maxLength,
          validator: (value) {
            if (value == null || value.trim().isEmpty) {
              return '$label cannot be empty';
            }
            if (label == 'Room ID' && value.length < 5) {
              return 'Room ID must be at least 5 characters long';
            }
            return null; 
          },
          decoration: InputDecoration(
            hintText: placeholder,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(6),
            ),
            contentPadding: const EdgeInsets.symmetric(
              vertical: 12,
              horizontal: 10,
            ),
            counterText: '',
          ),
        ),
      ],
    );
  }

  Widget _buildSubmitButton(VoidCallback onpressed) {
    return SizedBox(
      width: double.infinity,
      height: 45,
      child: ElevatedButton(
        style: ElevatedButton.styleFrom(
          backgroundColor: Colors.blue[800],
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(6),
          ),
        ),
        onPressed: onpressed,
        child: const Text(
          'Submit',
          style: TextStyle(color: Colors.white),
        ),
      ),
    );
  }
}
