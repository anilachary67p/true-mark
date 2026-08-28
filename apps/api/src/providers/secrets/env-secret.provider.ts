import { SecretProvider } from '../interfaces';

export class EnvSecretProvider implements SecretProvider {
  async getSecret(key: string): Promise<string> {
    const value = process.env[key];
    if (!value) {
      throw new Error(`Secret not found: ${key}`);
    }
    return value;
  }
}
