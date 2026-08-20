export type StoredObject = {
  key: string;
  fileName: string;
  contentType: string;
  byteSize: number;
};

export interface StorageProvider {
  readonly name: string;
  put(input: { key: string; body: Buffer; contentType: string }): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  delete(key: string): Promise<void>;
  urlFor(key: string): string;
}
