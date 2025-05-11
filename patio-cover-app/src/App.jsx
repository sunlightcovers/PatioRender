import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import * as THREE from 'three';
import EXIF from 'exif-js';
import './App.css';

function PatioCover({ modelPath, position, rotationX, rotationY, scale }) {
  const [model, setModel] = useState(null);
  const modelCache = useRef(new Map());

  useEffect(() => {
    if (modelCache.current.has(modelPath)) {
      setModel(modelCache.current.get(modelPath));
      return;
    }

    const loader = new GLTFLoader();
    loader.load(
      modelPath,
      (gltf) => {
        const scene = gltf.scene;
        modelCache.current.set(modelPath, scene);
        setModel(scene);
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
        <meshStandardMaterial color="gray" />
      </mesh>
    );
  }

  return (
    <primitive
      object={model}
      position={position}
      rotation={[rotationX, rotationY, 0]}
      scale={scale}
    />
  );
}

function App() {
  const [photo, setPhoto] = useState(null);
  const [step, setStep] = useState('capture');
  const [patioPosition, setPatioPosition] = useState([0, 0, 0]);
  const [rotationX, setRotationX] = useState(Math.PI);
  const [rotationY, setRotationY] = useState(Math.PI);
  const [scale, setScale] = useState(1);
  const [modelOptions, setModelOptions] = useState([]);
  const [selectedModel, setSelectedModel] = useState(null);
  const [zoom, setZoom] = useState(1);
  const [backgroundZoom, setBackgroundZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [imageRotation, setImageRotation] = useState(0);
  const canvasRef = useRef();
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const imageContainerRef = useRef(null);

  // Memoized props for PatioCover
  const patioProps = useMemo(
    () => ({
      modelPath: selectedModel,
      position: patioPosition,
      rotationX,
      rotationY,
      scale,
    }),
    [selectedModel, patioPosition, rotationX, rotationY, scale]
  );

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
        alert(`Failed to load the model list: ${error.message}. Using a default model.`);
        setModelOptions([{ value: '/default-model.gltf', label: 'Default Model' }]);
        setSelectedModel('/default-model.gltf');
      });
  }, []);

  // Start the camera
  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: 'environment',
        },
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch (err) {
      console.error('Error accessing rear camera:', err);
      try {
        const fallbackConstraints = { video: true };
        const stream = await navigator.mediaDevices.getUserMedia(fallbackConstraints);
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      } catch (fallbackErr) {
        console.error('Error accessing any camera:', fallbackErr);
        alert(
          'Could not access the camera. Please upload a photo instead or check your device permissions.'
        );
        setStep('capture');
      }
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

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
    }
  };

  // Handle file upload with EXIF orientation
  const handleFileUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      const photoData = URL.createObjectURL(file);
      setPhoto(photoData);
      setStep('preview');

      EXIF.getData(file, function () {
        const orientation = EXIF.getTag(this, 'Orientation');
        let rotation = 0;
        switch (orientation) {
          case 3:
            rotation = 180;
            break;
          case 6:
            rotation = 90;
            break;
          case 8:
            rotation = -90;
            break;
          default:
            rotation = 0;
            break;
        }
        setImageRotation(rotation);
      });
    }
  };

  // Export the design
  const exportDesign = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement('a');
    link.download = 'patio-cover-design.png';
    link.href = canvas.toDataURL('image/png', 1.0);
    link.click();
  };

  // Handle panning
  const handleMouseDown = (e) => {
    if (zoom <= 1 && backgroundZoom <= 1) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
    const newPanX = e.clientX - dragStart.x;
    const newPanY = e.clientY - dragStart.y;

    const container = imageContainerRef.current;
    if (container) {
      const img = container.querySelector('img');
      if (!img) return;
      const containerWidth = container.offsetWidth;
      const containerHeight = container.offsetHeight;
      const imgWidth = img.naturalWidth * zoom * backgroundZoom;
      const imgHeight = img.naturalHeight * zoom * backgroundZoom;

      const maxPanX = Math.max(0, (imgWidth - containerWidth) / 2 / (zoom * backgroundZoom));
      const maxPanY = Math.max(0, (imgHeight - containerHeight) / 2 / (zoom * backgroundZoom));

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
          <button onClick={capturePhoto} aria-label="Capture a photo from the camera">
            Capture Photo
          </button>
          <button onClick={startCamera} aria-label="Retry camera access">
            Retry Camera
          </button>
          <p>Or upload a photo:</p>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            aria-label="Upload a photo"
          />
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
                  transform: `scale(${backgroundZoom}) rotate(${imageRotation}deg)`,
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
                  {selectedModel && <PatioCover {...patioProps} />}
                  <OrbitControls enableRotate={false} enableZoom={false} enablePan={false} />
                </Canvas>
              </div>
            </div>
          </div>
          {/* Scrollable controls container */}
          <div className="scrollable-controls">
            <div className="controls">
              <h3>Adjust Photo View</h3>
              <label>
                Zoom (Image + Model):
                <div className="slider-container">
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={zoom}
                    onChange={(e) => {
                      setZoom(parseFloat(e.target.value));
                      setPan({ x: 0, y: 0 });
                    }}
                    className="custom-slider"
                    aria-label="Adjust zoom for image and model"
                  />
                  <input
                    type="number"
                    min="1"
                    max="3"
                    step="0.1"
                    value={zoom}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= 1 && value <= 3) {
                        setZoom(value);
                        setPan({ x: 0, y: 0 });
                      }
                    }}
                    className="number-input"
                    aria-label="Enter zoom value for image and model"
                    inputMode="decimal"
                  />
                </div>
              </label>
              <label>
                Background Zoom (Image Only):
                <div className="slider-container">
                  <input
                    type="range"
                    min="1"
                    max="3"
                    step="0.1"
                    value={backgroundZoom}
                    onChange={(e) => {
                      setBackgroundZoom(parseFloat(e.target.value));
                      setPan({ x: 0, y: 0 });
                    }}
                    className="custom-slider"
                    aria-label="Adjust zoom for background image"
                  />
                  <input
                    type="number"
                    min="1"
                    max="3"
                    step="0.1"
                    value={backgroundZoom}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= 1 && value <= 3) {
                        setBackgroundZoom(value);
                        setPan({ x: 0, y: 0 });
                      }
                    }}
                    className="number-input"
                    aria-label="Enter zoom value for background image"
                    inputMode="decimal"
                  />
                </div>
              </label>
              <h3>Adjust Patio Cover</h3>
              <label>
                Select Model:
                <select
                  value={selectedModel || ''}
                  onChange={(e) => setSelectedModel(e.target.value)}
                  aria-label="Select a patio cover model"
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
                <div className="slider-container">
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
                    className="custom-slider"
                    aria-label="Adjust X position of the patio cover"
                  />
                  <input
                    type="number"
                    min="-10"
                    max="10"
                    step="0.1"
                    value={patioPosition[0]}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= -10 && value <= 10) {
                        setPatioPosition([value, patioPosition[1], patioPosition[2]]);
                      }
                    }}
                    className="number-input"
                    aria-label="Enter X position of the patio cover"
                    inputMode="decimal"
                  />
                </div>
              </label>
              <label>
                Y Position:
                <div className="slider-container">
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
                    className="custom-slider"
                    aria-label="Adjust Y position of the patio cover"
                  />
                  <input
                    type="number"
                    min="-10"
                    max="10"
                    step="0.1"
                    value={patioPosition[1]}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= -10 && value <= 10) {
                        setPatioPosition([patioPosition[0], value, patioPosition[2]]);
                      }
                    }}
                    className="number-input"
                    aria-label="Enter Y position of the patio cover"
                    inputMode="decimal"
                  />
                </div>
              </label>
              <label>
                Z Position (Depth):
                <div className="slider-container">
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
                    className="custom-slider"
                    aria-label="Adjust Z position of the patio cover"
                  />
                  <input
                    type="number"
                    min="-5"
                    max="5"
                    step="0.1"
                    value={patioPosition[2]}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= -5 && value <= 5) {
                        setPatioPosition([patioPosition[0], patioPosition[1], value]);
                      }
                    }}
                    className="number-input"
                    aria-label="Enter Z position of the patio cover"
                    inputMode="decimal"
                  />
                </div>
              </label>
              <label>
                Rotate X:
                <div className="slider-container">
                  <input
                    type="range"
                    min="0"
                    max="6.28"
                    step="0.1"
                    value={rotationX}
                    onChange={(e) => setRotationX(parseFloat(e.target.value))}
                    className="custom-slider"
                    aria-label="Adjust X rotation of the patio cover"
                  />
                  <input
                    type="number"
                    min="0"
                    max="6.28"
                    step="0.1"
                    value={rotationX}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= 0 && value <= 6.28) {
                        setRotationX(value);
                      }
                    }}
                    className="number-input"
                    aria-label="Enter X rotation of the patio cover"
                    inputMode="decimal"
                  />
                </div>
              </label>
              <label>
                Rotate Y:
                <div className="slider-container">
                  <input
                    type="range"
                    min="0"
                    max="6.28"
                    step="0.1"
                    value={rotationY}
                    onChange={(e) => setRotationY(parseFloat(e.target.value))}
                    className="custom-slider"
                    aria-label="Adjust Y rotation of the patio cover"
                  />
                  <input
                    type="number"
                    min="0"
                    max="6.28"
                    step="0.1"
                    value={rotationY}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= 0 && value <= 6.28) {
                        setRotationY(value);
                      }
                    }}
                    className="number-input"
                    aria-label="Enter Y rotation of the patio cover"
                    inputMode="decimal"
                  />
                </div>
              </label>
              <label>
                Scale:
                <div className="slider-container">
                  <input
                    type="range"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={scale}
                    onChange={(e) => setScale(parseFloat(e.target.value))}
                    className="custom-slider"
                    aria-label="Adjust scale of the patio cover"
                  />
                  <input
                    type="number"
                    min="0.5"
                    max="2"
                    step="0.1"
                    value={scale}
                    onChange={(e) => {
                      const value = parseFloat(e.target.value);
                      if (!isNaN(value) && value >= 0.5 && value <= 2) {
                        setScale(value);
                      }
                    }}
                    className="number-input"
                    aria-label="Enter scale of the patio cover"
                    inputMode="decimal"
                  />
                </div>
              </label>
              <button
                onClick={() => setPatioPosition([0, 0, 0])}
                aria-label="Reset patio cover position"
              >
                Reset Position
              </button>
              <button onClick={exportDesign} aria-label="Export patio cover design as image">
                Export Design
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;