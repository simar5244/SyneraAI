# Visual AI Python Backend

This directory contains the Python backend code for the Visual AI component of the application.

## Setup Instructions

1. Ensure Python 3.8+ is installed on your system
2. Install the required dependencies:

```bash
pip install -r requirements.txt
```

3. Test the installation by running:

```bash
python visual_ai.py --input=<path-to-test-image>
```

## How It Works

The Python backend performs image analysis using computer vision libraries:

1. It analyzes input images using OpenCV for features like colors, edges, and face detection
2. Based on the analysis, it generates organizational structures
3. The results are returned as JSON to the Next.js frontend

## Troubleshooting

If you encounter errors:

1. Check that Python is installed correctly: `python --version`
2. Ensure all dependencies are installed: `pip list`
3. For OpenCV face detection issues, ensure `haarcascade_frontalface_default.xml` is available in your OpenCV installation

## Integration with Next.js

The Python backend is called from the `/api/visual-ai` route in the Next.js application, which handles file uploads and processes the results. 