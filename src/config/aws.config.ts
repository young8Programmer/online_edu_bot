import { ConfigService } from '@nestjs/config';

export const awsConfig = (configService: ConfigService) => ({
  accessKeyId: configService.get('AWS_ACCESS_KEY_ID', ''),
  secretAccessKey: configService.get('AWS_SECRET_ACCESS_KEY', ''),
  s3Bucket: configService.get('AWS_S3_BUCKET', ''),
});