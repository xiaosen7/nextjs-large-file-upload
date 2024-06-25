import { uploadActions } from "@/actions/upload";
import { Uploader } from "@/upload/components/upload";

export default function Home() {
  return (
    <div className="w-2/3 min-w-96 m-auto flex-0">
      <Uploader actions={uploadActions} />
    </div>
  );
}
