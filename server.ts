import { uploadActions } from "@/actions/upload";
import { IS_VERCEL } from "@/shared/constants";
import { SocketServer } from "@/socket/models/server";
import { DEFAULTS } from "@/upload/constants/defaults";
import { FileSystemStorage } from "@/upload/models/storages/file-system";
import { MemoryStorage } from "@/upload/models/storages/memory";
import next from "next";
import { createServer } from "node:http";
import path from "node:path";
import { Server } from "socket.io";

(global as any).storage = IS_VERCEL
  ? new MemoryStorage()
  : new FileSystemStorage(path.resolve("node_modules", ".cache"));

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = 3000;
// when using middleware `hostname` and `port` must be provided below
const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer(handler);

  new SocketServer(
    new Server(httpServer, {
      maxHttpBufferSize: DEFAULTS.maxChunkSize,
    }),
    uploadActions
  );

  httpServer
    .once("error", (err) => {
      console.error(err);
      process.exit(1);
    })
    .listen(port, () => {
      console.log(`> Ready on http://${hostname}:${port}`);
    });
});
