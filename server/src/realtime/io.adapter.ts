import { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

/** socket.io adapter that applies the same CORS allow-list as the REST API. */
export class AppIoAdapter extends IoAdapter {
  constructor(app: INestApplicationContext, private readonly origins: string[]) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.origins, credentials: true },
    });
  }
}
