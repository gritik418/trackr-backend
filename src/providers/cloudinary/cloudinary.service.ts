import { BadRequestException, Injectable } from '@nestjs/common';
import cloudinary from 'src/config/cloudinary.config';

@Injectable()
export class CloudinaryService {
  uploadImage(
    file: Express.Multer.File,
    options?: {
      folder?: string;
      width?: number;
      height?: number;
    },
  ): Promise<{ url: string; publicId: string }> {
    if (!file) throw new BadRequestException('Avatar image is required');
    return new Promise((resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            folder: options?.folder ?? 'trackr',
            resource_type: 'image',
            transformation:
              options?.width && options?.height
                ? [
                    {
                      width: options.width,
                      height: options.height,
                      crop: 'fill',
                    },
                  ]
                : undefined,
          },
          (error, result) => {
            if (error || !result) return reject(error);
            resolve({
              url: result.secure_url,
              publicId: result.public_id,
            });
          },
        )
        .end(file.buffer);
    });
  }

  async deleteImage(publicId: string): Promise<void> {
    await cloudinary.uploader.destroy(publicId);
  }
}
