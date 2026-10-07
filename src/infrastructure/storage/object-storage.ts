export interface UploadForm {
  postURL: string;
  formData: Record<string, string>;
}
export abstract class ObjectStorage {
  abstract ensureBucket(): Promise<void>;
  abstract health(): Promise<boolean>;
  abstract uploadForm(
    key: string,
    mimeType: string,
    size: number,
  ): Promise<UploadForm>;
  abstract read(key: string, maxBytes: number): Promise<Buffer>;
  abstract stat(key: string): Promise<{ size: number; mimeType: string }>;
  abstract put(key: string, body: Buffer, mimeType: string): Promise<void>;
  abstract downloadUrl(key: string): Promise<string>;
  abstract delete(key: string): Promise<void>;
}
