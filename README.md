# 👁️ Eye-Tracking PDF Reader with Autoscroll

A hands-free PDF reader that uses eye tracking to automatically scroll through documents. Perfect for accessible reading, research, and presentations.

## ✨ Features

- **Real-time Eye Detection**: Uses TensorFlow.js and face-api for webcam-based gaze tracking
- **Intelligent Autoscroll**: Automatically scrolls when you look at the top or bottom of the document
- **5-Point Calibration**: Ensures accurate gaze tracking with a quick calibration process
- **Adjustable Sensitivity**: Fine-tune scroll speed to match your reading pace
- **PDF Support**: Load and read any PDF file with smooth rendering
- **Zoom Controls**: Adjust text size for comfortable reading
- **Real-time Gaze Visualization**: See your gaze point position in real-time
- **LocalStorage Persistence**: Calibration data is saved between sessions

## 🚀 Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/Vismay-dev1/eye-tracking-pdf-reader.git
cd eye-tracking-pdf-reader

# Install dependencies
npm install

# Start development server
npm run dev
```

The application will open at `http://localhost:5173`

### First Use

1. **Allow Camera Access**: Grant webcam permissions when prompted
2. **Calibrate**: Look at the 7 calibration points in sequence (2 seconds each)
3. **Upload PDF**: Select a PDF file to read
4. **Start Reading**: Look at the bottom of the document to scroll down, top to scroll up

## 🎮 How to Use

### Calibration
- Look directly at each red dot
- Keep your head still
- Hold your gaze for 2 seconds
- Complete all 7 points for best accuracy

### Reading
- **Scroll Down**: Look at the bottom 30% of the document
- **Scroll Up**: Look at the top 20% of the document
- **Zoom**: Use zoom buttons in the control bar
- **Navigate Pages**: Use previous/next buttons or arrow keys
- **Recalibrate**: Use the recalibrate button in settings if accuracy drifts

### Settings
- **Eye Tracking**: Toggle eye detection on/off
- **Autoscroll**: Enable/disable automatic scrolling
- **Scroll Sensitivity**: Adjust scroll speed (0.5x - 3x)
- **Gaze Position**: View current gaze coordinates
- **Recalibrate**: Perform calibration again

## 🛠️ Architecture

### Components

```
src/
├── components/
│   ├── EyeTracker.tsx        # Face detection & gaze tracking
│   ├── PDFViewer.tsx         # PDF rendering with autoscroll
│   ├── Calibration.tsx       # 5-point calibration UI
│   └── SettingsPanel.tsx     # Configuration panel
├── App.tsx                    # Main app state management
└── main.tsx                   # Entry point
```

### Technology Stack

- **React 18**: UI framework
- **TypeScript**: Type safety
- **TensorFlow.js**: ML for face detection
- **face-api.js**: Facial landmark detection
- **PDF.js**: PDF rendering
- **Tailwind CSS**: Styling
- **Vite**: Build tool

## 🔧 Technical Details

### Gaze Tracking Algorithm

1. **Face Detection**: TensorFlow's TinyFaceDetector identifies faces in webcam stream
2. **Landmark Detection**: face-api extracts 68 facial landmarks
3. **Eye Position**: Calculates eye center from landmarks (indices 36-41 for left, 42-47 for right)
4. **Gaze Mapping**: Maps eye position to screen coordinates
5. **Calibration**: Uses calibration data to improve accuracy

### Autoscroll Logic

- Divides screen into scroll zones (bottom 30%, top 20%)
- Calculates scroll speed based on gaze intensity in zone
- Applies sensitivity multiplier
- Throttles scroll events for smooth performance

## 📋 Requirements

- Modern browser with WebRTC support (Chrome, Firefox, Edge)
- Webcam (built-in or external)
- 50MB+ disk space for ML models
- JavaScript enabled

## ⚙️ Configuration

### Build for Production

```bash
npm run build
```

Output will be in the `dist/` directory.

## 🐛 Troubleshooting

### "Webcam access denied"
- Check browser permissions
- Ensure HTTPS (required by browsers)
- Try a different browser

### "Models failed to load"
- Check internet connection
- Verify CDN access (cdnjs.cloudflare.com)
- Clear browser cache and reload

### "Gaze tracking inaccurate"
- Ensure good lighting
- Recalibrate (button in settings)
- Keep head still during use
- Reduce glare on webcam

### "PDF not rendering"
- Verify PDF is valid and not corrupted
- Try a different PDF file
- Check browser console for errors

## 🚀 Performance Optimization

- Models are lazy-loaded
- Gaze detection runs at ~30 FPS
- Scroll events are throttled
- Canvas rendering is optimized
- LocalStorage caching for calibration

## 🤝 Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## 📄 License

MIT License - See LICENSE file for details

## 🎓 Learning Resources

- [TensorFlow.js Documentation](https://www.tensorflow.org/js)
- [face-api.js GitHub](https://github.com/justadudewhohacks/face-api.js)
- [PDF.js Documentation](https://mozilla.github.io/pdf.js/)
- [Eye Tracking Research](https://en.wikipedia.org/wiki/Eye_tracking)

## 💡 Future Enhancements

- [ ] Blink detection for page control
- [ ] Head pose estimation
- [ ] Custom calibration points
- [ ] Dark/light theme toggle
- [ ] Keyboard shortcuts
- [ ] Multiple PDF support
- [ ] Annotation tools
- [ ] Export with notes
- [ ] Mobile app version
- [ ] Voice control integration

## 📞 Support

For issues and questions:
- Open an issue on GitHub
- Check existing issues for solutions
- Review troubleshooting section

## ⭐ Acknowledgments

- TensorFlow.js team for ML models
- face-api.js creator Vincent Müller
- Mozilla team for PDF.js
- Tailwind CSS for styling

---

**Made with ❤️ for accessible reading**