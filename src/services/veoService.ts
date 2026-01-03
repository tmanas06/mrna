import { GoogleGenAI } from '@google/genai';

const genAI = new GoogleGenAI({
  apiKey: import.meta.env.VITE_GEMINI_API_KEY,
});

export interface VideoGenerationResult {
  videoUrl: string;
  status: 'completed' | 'pending' | 'failed';
  operationName?: string;
  error?: string;
}

export interface VideoGenerationConfig {
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: '16:9' | '9:16' | '1:1';
}

// Fetch video from authenticated URL and return blob URL for playback
async function fetchVideoAsBlob(videoUri: string): Promise<string> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

  // Add API key to the URL if not already present
  const urlWithKey = videoUri.includes('key=')
    ? videoUri
    : `${videoUri}${videoUri.includes('?') ? '&' : '?'}key=${apiKey}`;

  console.log('Fetching video from:', urlWithKey.replace(apiKey, 'API_KEY'));

  const response = await fetch(urlWithKey);

  if (!response.ok) {
    throw new Error(`Failed to fetch video: ${response.status} ${response.statusText}`);
  }

  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);

  console.log('Video blob URL created:', blobUrl);
  return blobUrl;
}

// Generate video using Veo via Google GenAI SDK
export async function generateVideo(config: VideoGenerationConfig): Promise<VideoGenerationResult> {
  const { prompt, aspectRatio = '16:9' } = config;

  try {
    console.log('Starting Veo video generation via SDK...');
    console.log('Prompt length:', prompt.length);

    // Try with the SDK's generateVideos method
    // The SDK should handle the correct endpoint internally
    let operation;
    try {
      operation = await genAI.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt: prompt,
        config: {
          aspectRatio: aspectRatio,
          numberOfVideos: 1,
          personGeneration: 'allow_all',
        },
      });
      console.log('Operation response:', operation);
    } catch (sdkError) {
      console.log('SDK generateVideos failed, trying veo-3.0-generate model...');

      // Try alternative model name
      try {
        operation = await genAI.models.generateVideos({
          model: 'veo-3.0-generate',
          prompt: prompt,
          config: {
            aspectRatio: aspectRatio,
            numberOfVideos: 1,
            personGeneration: 'allow_adult',
          },
        });
        console.log('veo-3.0-generate response:', operation);
      } catch (altError) {
        // Return the original error
        throw sdkError;
      }
    }

    // Check if we got an operation to poll
    if (operation?.name) {
      console.log('Long-running operation started:', operation.name);
      console.log('Operation object keys:', Object.keys(operation));
      console.log('Operation object:', operation);

      // Wait for the operation to complete using the SDK's built-in polling
      console.log('Waiting for operation to complete...');
      let result;

      // Try different methods to get the result
      if (typeof operation.wait === 'function') {
        console.log('Using operation.wait()');
        result = await operation.wait();
      } else if (operation.result !== undefined) {
        console.log('Using operation.result');
        result = await operation.result;
      } else if (typeof operation.then === 'function') {
        console.log('Operation is thenable, awaiting directly');
        result = await operation;
      } else {
        console.log('No known wait method, polling manually...');
        result = await pollForVideo(operation.name);
      }

      console.log('Operation completed:', result);

      // Check multiple possible response structures
      const videoUri =
        result?.generatedVideos?.[0]?.video?.uri ||
        result?.generateVideoResponse?.generatedSamples?.[0]?.video?.uri;

      if (videoUri) {
        // The video URL requires authentication, so fetch it and create a blob URL
        const blobUrl = await fetchVideoAsBlob(videoUri);
        return {
          videoUrl: blobUrl,
          status: 'completed',
          operationName: operation.name,
        };
      }

      return {
        videoUrl: '',
        status: 'failed',
        operationName: operation.name,
        error: 'No video in completed operation: ' + (JSON.stringify(result) || 'undefined').substring(0, 400),
      };
    }

    // Check for immediate result
    if (operation?.generatedVideos?.[0]?.video?.uri) {
      return {
        videoUrl: operation.generatedVideos[0].video.uri,
        status: 'completed',
      };
    }

    return {
      videoUrl: '',
      status: 'failed',
      error: 'Unexpected SDK response: ' + JSON.stringify(operation).substring(0, 400),
    };

  } catch (error) {
    console.error('Video generation error:', error);
    const errorMsg = error instanceof Error ? error.message : String(error);

    // Check if the error indicates the API isn't available
    if (errorMsg.includes('predictLongRunning') || errorMsg.includes('404')) {
      return {
        videoUrl: '',
        status: 'failed',
        error: `Veo API not available via SDK. The model may require Vertex AI authentication or Google AI Studio web interface. Error: ${errorMsg}`,
      };
    }

    return {
      videoUrl: '',
      status: 'failed',
      error: errorMsg,
    };
  }
}

// Poll for video completion using REST API
async function pollForVideo(operationName: string): Promise<{ generatedVideos?: Array<{ video?: { uri?: string } }> } | null> {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  const maxAttempts = 120;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`
      );

      if (!response.ok) {
        console.error(`Poll attempt ${attempt + 1} failed:`, response.status);
        await new Promise(resolve => setTimeout(resolve, 5000));
        continue;
      }

      const data = await response.json();
      console.log(`Poll ${attempt + 1}:`, data.done ? 'DONE' : 'pending...');

      if (data.done) {
        if (data.error) {
          throw new Error(data.error.message || 'Operation failed');
        }
        return data.response;
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
    } catch (error) {
      console.error(`Poll attempt ${attempt + 1} error:`, error);
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  return null;
}

// Poll for operation completion using SDK (deprecated)
async function pollOperationSDK(operationName: string): Promise<VideoGenerationResult> {
  const maxAttempts = 120;
  let attempts = 0;

  console.log('Polling operation via SDK:', operationName);

  while (attempts < maxAttempts) {
    try {
      const operation = await genAI.operations.get({ name: operationName });
      console.log(`Poll ${attempts + 1}:`, operation.done ? 'DONE' : 'pending...');

      if (operation.done) {
        // Check for video in response
        const response = operation.response as {
          generatedVideos?: Array<{ video?: { uri?: string } }>;
        };

        if (response?.generatedVideos?.[0]?.video?.uri) {
          return {
            videoUrl: response.generatedVideos[0].video.uri,
            status: 'completed',
            operationName,
          };
        }

        if (operation.error) {
          return {
            videoUrl: '',
            status: 'failed',
            operationName,
            error: operation.error.message || 'Operation failed',
          };
        }

        return {
          videoUrl: '',
          status: 'failed',
          operationName,
          error: 'No video in completed operation',
        };
      }

      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;

    } catch (error) {
      console.error('Poll error:', error);
      attempts++;
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  return {
    videoUrl: '',
    status: 'pending',
    operationName,
    error: 'Video generation timed out after 10 minutes',
  };
}
