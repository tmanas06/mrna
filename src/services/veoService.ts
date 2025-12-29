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
        model: 'veo-3.0-fast-generate',
        prompt: prompt,
        config: {
          aspectRatio: aspectRatio,
          numberOfVideos: 1,
          personGeneration: 'allow_adult',
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
      return await pollOperationSDK(operation.name);
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

// Poll for operation completion using SDK
async function pollOperationSDK(operationName: string): Promise<VideoGenerationResult> {
  const maxAttempts = 120;
  let attempts = 0;

  console.log('Polling operation via SDK:', operationName);

  while (attempts < maxAttempts) {
    try {
      const operation = await genAI.operations.get({ operation: operationName });
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
