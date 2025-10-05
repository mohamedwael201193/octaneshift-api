import QRCode from 'qrcode';
import { logger } from './logger';

export interface QROptions {
  errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
  type?: 'image/png' | 'image/jpeg' | 'image/webp';
  quality?: number;
  margin?: number;
  color?: {
    dark?: string;
    light?: string;
  };
  width?: number;
}

/**
 * Generate QR code as base64 data URL
 */
export async function generateQRCode(
  text: string,
  options: QROptions = {}
): Promise<string> {
  try {
    const qrOptions = {
      errorCorrectionLevel: options.errorCorrectionLevel || 'M',
      type: options.type || 'image/png',
      quality: options.quality || 0.92,
      margin: options.margin || 1,
      color: {
        dark: options.color?.dark || '#000000',
        light: options.color?.light || '#FFFFFF',
      },
      width: options.width || 256,
    };

    const qrCodeDataURL = await QRCode.toDataURL(text, qrOptions);
    
    logger.debug({ text: text.substring(0, 50) + '...', options: qrOptions }, 'QR code generated');
    
    return qrCodeDataURL;
  } catch (error) {
    logger.error({ error, text: text.substring(0, 50) + '...' }, 'Failed to generate QR code');
    throw new Error('Failed to generate QR code');
  }
}

/**
 * Generate QR code as SVG string
 */
export async function generateQRCodeSVG(
  text: string,
  options: Omit<QROptions, 'type' | 'quality'> = {}
): Promise<string> {
  try {
    const qrOptions = {
      errorCorrectionLevel: options.errorCorrectionLevel || 'M',
      margin: options.margin || 1,
      color: {
        dark: options.color?.dark || '#000000',
        light: options.color?.light || '#FFFFFF',
      },
      width: options.width || 256,
    };

    const svgString = await QRCode.toString(text, {
      type: 'svg',
      ...qrOptions,
    });
    
    logger.debug({ text: text.substring(0, 50) + '...', options: qrOptions }, 'QR code SVG generated');
    
    return svgString;
  } catch (error) {
    logger.error({ error, text: text.substring(0, 50) + '...' }, 'Failed to generate QR code SVG');
    throw new Error('Failed to generate QR code SVG');
  }
}

/**
 * Validate if a string can be encoded as QR code
 */
export function validateQRContent(text: string): boolean {
  try {
    // Check length limits (QR codes have capacity limits)
    if (text.length > 4296) {
      return false;
    }
    
    // Check for valid characters (QR codes support UTF-8)
    return true;
  } catch {
    return false;
  }
}