import { uploadActions } from "@/actions/upload";
import { IS_VERCEL } from "@/shared/constants";
import { Upload } from "@/upload/components/upload";
import { FileSystemStorage } from "@/upload/models/storages/file-system";
import { MemoryStorage } from "@/upload/models/storages/memory";
import path from "path";

(global as any).storage = IS_VERCEL
  ? new MemoryStorage()
  : new FileSystemStorage(path.resolve("node_modules", ".cache"));

export default function Home() {
  return (
    <div className="w-2/3 min-w-96 m-auto flex-0">
      <Upload actions={uploadActions} />
    </div>
  );
}
