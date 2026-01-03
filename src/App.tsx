import { useState, useEffect } from 'react';
import { THEME_CATEGORIES, fetchThemeComponents, type ThemeData, type ComponentData } from './services/supabaseService';
import { generateVideoScript, type VideoScript } from './services/geminiService';
import { generateVideo, type VideoGenerationResult } from './services/veoService';

type GenerationStatus = 'idle' | 'fetching-theme' | 'generating-script' | 'generating-video' | 'completed' | 'error';

// Nebzmart-G cinematic ad prompt - optimized for Veo 3.0 fast
const NEBZMART_PROMPT = `Create a single continuous 8-second cinematic video advertisement in a photorealistic medical-commercial style.

SCENE:
A middle-aged Indian male patient wearing a blue shirt, shown from mid-torso up, standing indoors in a clean, softly lit clinical environment. He appears calm, relieved, and breathing comfortably from the very start.

TIMING AND ACTION (NO CUTS, ONE CONTINUOUS SHOT):

Seconds 0–2:
The man gently inhales and exhales with ease. His shoulders are relaxed and his expression shows quiet relief. The camera begins a slow, smooth cinematic push-in toward his chest.

Seconds 2–5:
A medical visual metaphor appears. Soft, glowing white linear circles and rings emerge from the center of his chest and expand outward smoothly. The circles are semi-transparent, elegant, clinical, and reassuring, symbolizing airways opening and fast relief. The lighting remains warm and calming.

Seconds 5–7:
The white circles stabilize and pulse once subtly, indicating sustained relief over time. The man looks confident and comfortable. The camera push-in slows further.

Seconds 7–8:
Clean on-screen text fades in sharply while the scene holds steady.

ON-SCREEN TEXT (final second only):
Primary text: "Nebzmart-G"
Secondary text below: "Relief in 5 mins. Lasts 12 hrs."

VOICEOVER:
Calm, confident male voice with Indian English accent:
"Nebzmart-G gives relief in just five minutes, and keeps you breathing easy for up to twelve hours."

STYLE:
Photorealistic, high-end pharmaceutical commercial.
Soft diffused lighting, natural skin tones.
Slow cinematic camera movement.
No cluttered background.
One continuous shot only.
Clearly visible white expanding circles on the chest.
Exact duration: 8 seconds.`;

function App() {
  const [darkMode, setDarkMode] = useState(() => {
    const saved = localStorage.getItem('darkMode');
    return saved !== null ? JSON.parse(saved) : true;
  });
  const [selectedTheme, setSelectedTheme] = useState<ThemeData | null>(null);
  const [components, setComponents] = useState<ComponentData[]>([]);
  const [script, setScript] = useState<VideoScript | null>(null);
  const [videoResult, setVideoResult] = useState<VideoGenerationResult | null>(null);
  const [status, setStatus] = useState<GenerationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [useCustomPrompt, setUseCustomPrompt] = useState(true);

  // Apply dark mode to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', darkMode ? 'dark' : 'light');
    localStorage.setItem('darkMode', JSON.stringify(darkMode));
  }, [darkMode]);

  // Auto-select Safety theme on mount
  useEffect(() => {
    const safetyTheme = THEME_CATEGORIES.find(t => t.id === 'safety');
    if (safetyTheme) {
      handleThemeSelect(safetyTheme);
    }
  }, []);

  const handleThemeSelect = async (theme: ThemeData) => {
    setSelectedTheme(theme);
    setStatus('fetching-theme');
    setScript(null);
    setVideoResult(null);
    setErrorMessage('');

    try {
      const themeComponents = await fetchThemeComponents(theme.id);
      setComponents(themeComponents);
      setStatus('idle');
    } catch (error) {
      console.error('Error fetching theme components:', error);
      setErrorMessage('Failed to fetch theme components');
      setStatus('error');
    }
  };

  const handleGenerateVideo = async () => {
    setErrorMessage('');

    try {
      let promptToUse: string;

      if (useCustomPrompt) {
        // Use the detailed Nebzmart-G prompt directly
        setStatus('generating-video');
        promptToUse = NEBZMART_PROMPT;

        // Set script for display
        setScript({
          title: 'Nebzmart-G - Relief in 5 mins',
          duration: 8,
          scenes: [
            { timeStart: 0, timeEnd: 2, visual: 'Man breathing comfortably, camera push-in', text: '' },
            { timeStart: 2, timeEnd: 5, visual: 'White circles emerge from chest, symbolizing airways opening', text: '' },
            { timeStart: 5, timeEnd: 7, visual: 'Circles stabilize and pulse, man looks confident', text: '' },
            { timeStart: 7, timeEnd: 8, visual: 'Text overlay fades in', text: 'Nebzmart-G\nRelief in 5 mins. Lasts 12 hrs.' },
          ],
          voiceover: 'Nebzmart-G gives relief in just five minutes, and keeps you breathing easy for up to twelve hours.',
          prompt: NEBZMART_PROMPT,
        });
      } else {
        // Generate script using Gemini
        if (!selectedTheme) return;
        setStatus('generating-script');

        const videoScript = await generateVideoScript(
          selectedTheme.name,
          selectedTheme.description,
          components,
          8
        );
        setScript(videoScript);
        promptToUse = videoScript.prompt;
        setStatus('generating-video');
      }

      // Generate video using Veo 3.1 fast
      const result = await generateVideo({
        prompt: promptToUse,
        durationSeconds: 8,
        aspectRatio: '16:9',
        personGeneration: 'allow',
      });

      setVideoResult(result);

      if (result.status === 'completed') {
        setStatus('completed');
      } else if (result.status === 'failed') {
        setErrorMessage(result.error || 'Video generation failed');
        setStatus('error');
      } else {
        setErrorMessage('Video generation is still pending');
        setStatus('error');
      }
    } catch (error) {
      console.error('Error generating video:', error);
      setErrorMessage(error instanceof Error ? error.message : 'An error occurred');
      setStatus('error');
    }
  };

  const getStatusMessage = () => {
    switch (status) {
      case 'fetching-theme':
        return 'Fetching theme data from database...';
      case 'generating-script':
        return 'Generating video script with AI...';
      case 'generating-video':
        return 'Generating 8-second video with Veo 3.0 fast...';
      case 'completed':
        return 'Video generated successfully!';
      case 'error':
        return errorMessage;
      default:
        return '';
    }
  };

  const isLoading = ['fetching-theme', 'generating-script', 'generating-video'].includes(status);

  return (
    <div className="container">
      <header className="header">
        <h1>mRNA Video Generator</h1>
        <button
          className="dark-mode-btn"
          onClick={() => setDarkMode(!darkMode)}
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {darkMode ? '☀️' : '🌙'}
        </button>
      </header>

      {/* Mode Toggle */}
      <div className="card">
        <h2>Generation Mode</h2>
        <div className="theme-grid">
          <button
            className={`theme-btn ${useCustomPrompt ? 'selected' : ''}`}
            onClick={() => setUseCustomPrompt(true)}
            disabled={isLoading}
          >
            Nebzmart-G Ad
          </button>
          <button
            className={`theme-btn ${!useCustomPrompt ? 'selected' : ''}`}
            onClick={() => setUseCustomPrompt(false)}
            disabled={isLoading}
          >
            Auto-Generate
          </button>
        </div>
      </div>

      {/* Nebzmart-G Prompt Preview */}
      {useCustomPrompt && (
        <div className="card">
          <h2>Nebzmart-G Cinematic Ad Script</h2>
          <div className="script-box" style={{ maxHeight: '300px', overflow: 'auto' }}>
            <strong>Brand:</strong> Nebzmart-G<br/><br/>
            <strong>Duration:</strong> 8 seconds<br/><br/>
            <strong>Scene:</strong> Middle-aged Indian male patient in blue shirt, softly lit indoor environment<br/><br/>
            <strong>Visual Timeline:</strong><br/>
            • 0-2s: Man breathing comfortably, camera push-in<br/>
            • 2-5s: White circles emerge from chest (airways opening metaphor)<br/>
            • 5-7s: Circles stabilize and pulse, man looks confident<br/>
            • 7-8s: Text overlay fades in<br/><br/>
            <strong>On-Screen Text:</strong> "Nebzmart-G" + "Relief in 5 mins. Lasts 12 hrs."<br/><br/>
            <strong>Voiceover:</strong> "Nebzmart-G gives relief in just five minutes, and keeps you breathing easy for up to twelve hours."
          </div>
        </div>
      )}

      {/* Theme Selection (for auto-generate mode) */}
      {!useCustomPrompt && (
        <>
          <div className="card">
            <h2>Select Theme</h2>
            <div className="theme-grid">
              {THEME_CATEGORIES.map((theme) => (
                <button
                  key={theme.id}
                  className={`theme-btn ${selectedTheme?.id === theme.id ? 'selected' : ''}`}
                  onClick={() => handleThemeSelect(theme)}
                  disabled={isLoading}
                >
                  {theme.name}
                </button>
              ))}
            </div>
          </div>

          {/* Selected Theme Info */}
          {selectedTheme && components.length > 0 && (
            <div className="card">
              <h2>{selectedTheme.name} Components</h2>
              <div className="script-box">
                {components.map((c) => (
                  <div key={c.id} style={{ marginBottom: '8px' }}>
                    <strong>{c.name}</strong>: {c.content}
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Generated Script */}
      {script && (
        <div className="card">
          <h2>Generated Script</h2>
          <div className="script-box">
            <strong>Title:</strong> {script.title}
            <br /><br />
            <strong>Voiceover:</strong> {script.voiceover}
            <br /><br />
            <strong>Veo Prompt:</strong> {script.prompt}
          </div>
        </div>
      )}

      {/* Generate Button */}
      <button
        className="generate-btn"
        onClick={handleGenerateVideo}
        disabled={(!useCustomPrompt && !selectedTheme) || isLoading}
      >
        {isLoading ? (
          <>
            <span className="spinner"></span>
            {getStatusMessage()}
          </>
        ) : (
          'Generate 8s Video'
        )}
      </button>

      {/* Status */}
      {status !== 'idle' && !isLoading && (
        <div className={`status ${status === 'error' ? 'error' : ''}`}>
          {getStatusMessage()}
        </div>
      )}

      {/* Video Result */}
      {videoResult?.status === 'completed' && videoResult.videoUrl && (
        <div className="card video-container">
          <h2>Generated Video</h2>
          <video
            src={videoResult.videoUrl}
            controls
            autoPlay
            loop
            style={{ width: '100%', maxHeight: '500px' }}
          />
          <p style={{ marginTop: '12px', color: '#888' }}>
            Duration: 8 seconds | Theme: {selectedTheme?.name}
          </p>
        </div>
      )}
    </div>
  );
}

export default App;
