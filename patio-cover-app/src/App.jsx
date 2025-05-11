import React, { useState, useRef, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import './App.css';

function PatioCover({ modelPath, position, rotationX, rotationY, scale, color }) {
  const [model, setModel] = useState(null);

  useEffect(() => {
    const loader = new GLTFLoader();
    loader.load(
      modelPath,
      (gltf) => {
        setModel(gltf.scene);
      },
      undefined,
      (error) => {
        console.error('Error loading GLTF model:', error);
        alert('Failed to load the 3D model. Using a placeholder instead.');
      }
    );
  }, [modelPath]);

  if (!model) {
    return (
      <mesh position={position} rotation={[rotationX, rotationY, 0]} scale={scale}>
        <boxGeometry args={[2, 0.2, 2]} />
        <meshStandardMaterial color={color} />
      </mesh>
    );
  }

  return (
    <primitive
      object={model}
      position={position}
      rotation={[rotationX, rotationY, 0]}
      scale={scale}
    >
      <meshStandardMaterial color={color} />
    </primitive>
  );
}

function App() {
  const [photo, setPhoto] = useState(null);
  const [step, setStep] = useState('capture'); // 'capture', 'preview'
  const [patioPosition, setPatioPosition] = useState([0, 0, 0]); // X, Y, Z control
  const [rotationX, setRotationX] = useState(Math.PI); // Default to π (centered)
  const [rotationY, setRotationY] = useState(Math.PI); // Default to π (centered)
  const [scale, setScale] = useState(1);
  const [color, setColor] = useState('brown');
  const [modelOptions, setModelOptions] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [zoom, setZoom] = useState(1); // Zoom for both image and model
  const [backgroundZoom, setBackgroundZoom] = useState(1); // Zoom for background only
  const [pan, setPan] = useState({ x: 0, y: 0 }); // Pan offsets
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const imageContainerRef = useRef(null);

  // Fetch the list of models
  useEffect(() => {
    fetch('/models.json')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status} - ${response.statusText}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!data.models || !Array.isArray(data.models) || data.models.length === 0) {
          throw new Error('Invalid or empty model list in models.json');
        }
        setModelOptions(data.models);
        setSelectedModel(data.models[0]?.value || null);
      })
      .catch((error) => {
        console.error('Error loading models.json:', error.message);
        alert(`Failed to load the model list: ${error.message}. Using a placeholder model.`);
        setModelOptions([{ value: '', label: 'Default Model (Placeholder)' }]);
        setSelectedModel('');
      });
  }, []);

  // Start the camera
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Error accessing camera:', err);
      alert('Could not access the camera. Please upload a photo instead.');
    }
  };

  // Capture photo from camera
  const capturePhoto = () => {
    const video = videoRef.current;
    if (!video) return;

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const photoData = canvas.toDataURL('image/png');
    setPhoto(photoData);
    setStep('preview');

    // Stop the camera
    streamRef.current.getTracks().forEach((track) => track.stop());
  };

  // Handle file upload
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const photoData = URL.createObjectURL(file);
      setPhoto(photoData);
      setStep('preview');
    }
  };

  // Export the design
  const exportDesign = () => {
    const canvas = canvasRef.current;
    const link = document.createElement('a');
    link.download = 'patio-cover-design.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
  };

  // Handle panning
  const handleMouseDown = (e) => {
    if (zoom <= 1 && backgroundZoom <= 1) return; // Only allow panning if zoomed in
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const newPanX = e.clientX - dragStart.x;
    const newPanY = e.clientY - dragStart.y;

    // Calculate boundaries to prevent panning too far
    const container = imageContainerRef.current;
    if (container) {
      const img = container.querySelector('img');
      const containerWidth = container.offsetWidth;
      const containerHeight = container.offsetHeight;
      const imgWidth = img.offsetWidth * zoom * backgroundZoom;
      const imgHeight = img.offsetHeight * zoom * backgroundZoom;

      const maxPanX = (imgWidth - containerWidth) / 2 / (zoom * backgroundZoom);
      const maxPanY = (imgHeight - containerHeight) / 2 / (zoom * backgroundZoom);

      const boundedPanX = Math.max(-maxPanX, Math.min(maxPanX, newPanX));
      const boundedPanY = Math.max(-maxPanY, Math.min(maxPanY, newPanY));

      setPan({ x: boundedPanX, y: boundedPanY });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (step === 'capture') {
      startCamera();
    }
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, [step]);

  return (
    <div className="app">
      <h1>Patio Cover Visualizer</h1>
      <p className="privacy-notice">
        📸 Your photo stays on your device and is not stored.
      </p>

      {step === 'capture' && (
        <div className="capture-section">
          <h2>Step 1: Capture or Upload a Photo</h2>
          <div className="camera-feed">
            <video ref={videoRef} autoPlay playsInline />
          </div>
          <button onClick={capturePhoto}>Capture Photo</button>
          <p>Or upload a photo:</p>
          <input type="file" accept="image/*" onChange={handleFileUpload} />
        </div>
      )}

      {step === 'preview' && (
        <div className="preview-section">
          <h2>Step 2: Place the Patio Cover</h2>
          <div className="scene-container" ref={imageContainerRef}>
            <div
              className="image-wrapper"
              style={{
                transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
                transformOrigin: 'center center',
              }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              <img
                src={photo}
                alt="House"
                className="background-photo"
                style={{
                  transform: `scale(${backgroundZoom})`,
                  transformOrigin: 'center center',
                }}
              />
              <div className="canvas-overlay">
                <Canvas
                  camera={{ position: [0, 0, 10], fov: 50 }}
                  onCreated={({ gl }) => {
                    canvasRef.current = gl.domElement;
                  }}
                >
                  <ambientLight intensity={0.5} />
                  <directionalLight position={[10, 10, 5]} intensity={1} />
                  {selectedModel && (
                    <PatioCover
                      modelPath={selectedModel}
                      position={patioPosition}
                      rotationX={rotationX}
                      rotationY={rotationY}
                      scale={scale}
                      color={color}
                    />
                  )}
                  <OrbitControls enableRotate={false} enableZoom={false} enablePan={false} />
                </Canvas>
              </div>
            </div>
          </div>
          <div className="controls">
            <h3>Adjust Photo View</h3>
            <label>
              Zoom (Image + Model):
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={zoom}
                onChange={(e) => {
                  setZoom(parseFloat(e.target.value));
                  setPan({ x: 0, y: 0 }); // Reset pan when zooming
                }}
              />
            </label>
            <label>
              Background Zoom (Image Only):
              <input
                type="range"
                min="1"
                max="3"
                step="0.1"
                value={backgroundZoom}
                onChange={(e) => {
                  setBackgroundZoom(parseFloat(e.target.value));
                  setPan({ x: 0, y: 0 }); // Reset pan when zooming
                }}
              />
            </label>
            <h3>Adjust Patio Cover</h3>
            <label>
              Select Model:
              <select
                value={selectedModel || ''}
                onChange={(e) => setSelectedModel(e.target.value)}
              >
                {modelOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              X Position:
              <input
                type="range"
                min="-10"
                max="10"
                step="0.1"
                value={patioPosition[0]}
                onChange={(e) =>
                  setPatioPosition([
                    parseFloat(e.target.value),
                    patioPosition[1],
                    patioPosition[2],
                  ])
                }
              />
            </label>
            <label>
              Y Position:
              <input
                type="range"
                min="-10"
                max="10"
                step="0.1"
                value={patioPosition[1]}
                onChange={(e) =>
                  setPatioPosition([
                    patioPosition[0],
                    parseFloat(e.target.value),
                    patioPosition[2],
                  ])
                }
              />
            </label>
            <label>
              Z Position (Depth):
              <input
                type="range"
                min="-5"
                max="5"
                step="0.1"
                value={patioPosition[2]}
                onChange={(e) =>
                  setPatioPosition([
                    patioPosition[0],
                    patioPosition[1],
                    parseFloat(e.target.value),
                  ])
                }
              />
            </label>
            <label>
              Rotate X:
              <input
                type="range"
                min="0"
                max="6.28"
                step="0.1"
                value={rotationX}
                onChange={(e) => setRotationX(parseFloat(e.target.value))}
              />
            </label>
            <label>
              Rotate Y:
              <input
                type="range"
                min="0"
                max="6.28"
                step="0.1"
                value={rotationY}
                onChange={(e) => setRotationY(parseFloat(e.target.value))}
              />
            </label>
            <label>
              Scale:
              <input
                type="range"
                min="0.5"
                max="2"
                step="0.1"
                value={scale}
                onChange={(e) => setScale(parseFloat(e.target.value))}
              />
            </label>
            <label>
              Color:
              <select value={color} onChange={(e) => setColor(e.target.value)}>
                <option value="brown">Brown</option>
                <option value="gray">Gray</option>
                <option value="white">White</option>
              </select>
            </label>
            <button onClick={() => setPatioPosition([0, 0, 0])}>
              Reset Position
            </button>
            <button onClick={exportDesign}>Export Design</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;