import {Context, APIGatewayProxyResult, APIGatewayEvent} from 'aws-lambda';
import sharp from "sharp";
import {APIGatewayProxyEventQueryStringParameters} from "aws-lambda/trigger/api-gateway-proxy";


export const handler = async (event: APIGatewayEvent, context: Context): Promise<APIGatewayProxyResult> => {
  console.log(`Event: ${JSON.stringify(event, null, 2)}`);
  console.log(`Context: ${JSON.stringify(context, null, 2)}`);
  const transformOptions = transformQueryParams(event.queryStringParameters);
  const imageBuffer = await fetchImage(transformOptions.url);
  if (!imageBuffer) {
    return {
      statusCode: 404,
      body: JSON.stringify({
        message: 'image not found',
      }),
    };
  }
  const resizedImageBuffer = await processImage(imageBuffer, transformOptions);
  if (!resizedImageBuffer) {
    return {
      statusCode: 500,
      body: JSON.stringify({
        message: 'internal server error',
      }),
    };
  }
  return {
    statusCode: 200,
    headers: {
      'Content-Type': 'image/webp',
    },
    body: resizedImageBuffer.toString('base64'),
    isBase64Encoded: true,
  };
};

export const fetchImage = async (url: string): Promise<ArrayBuffer | undefined> => {
  return fetch(url)
    .then(async (response) => {
      if (response.ok) {
        return response.arrayBuffer()
      }
      if (response.status === 404) {
        return undefined
      }
      // TODO - throw error
      throw new Error(response.statusText);
    })
    .catch((error) => {
      throw error
    });

}

// https://github.com/vercel/next.js/blob/canary/packages/next/src/server/image-optimizer.ts
async function processImage(inputBuffer: ArrayBuffer, option: TransformOption) {
  const transformer = sharp(inputBuffer, {
    sequentialRead: true,
  })

  transformer.rotate()

  if (option.height) {
    transformer.resize(option.width, option.height)
  } else {
    transformer.resize(option.width, undefined, {
      withoutEnlargement: true,
    })
  }

  // FIXME only support webp currently
  transformer.webp({quality: option.quality})

  return transformer.toBuffer()
}


export function transformQueryParams(query: APIGatewayProxyEventQueryStringParameters | null): TransformOption {
  if (!query) return {url: '', width: 0, quality: 75}
  const transformOptions = {
    url: query['url'] || '',
    width: parseInt(query['w'] || '0'),
    quality: parseInt(query['q'] || '75'),
  }
  return transformOptions as TransformOption
}

export interface TransformOption {
  url: string
  width: number
  height?: number
  quality?: number
}
