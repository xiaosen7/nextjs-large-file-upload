"use client";

import { Loading } from "@/shared/components/loading";
import { Input } from "@/shared/components/ui/input";
import { Progress } from "@/shared/components/ui/progress";
import { mp } from "@/shared/utils/jsx";
import {
  CheckIcon,
  ExclamationTriangleIcon,
  PauseIcon,
  PlayIcon,
  ReloadIcon,
  RocketIcon,
  TrashIcon,
} from "@radix-ui/react-icons";
import { useCreation, useMemoizedFn } from "ahooks";
import { sentenceCase } from "change-case";
import { get, set, uniqueId } from "lodash-es";
import { useObservable } from "rcrx";
import React, { memo, useEffect, useRef, useState } from "react";
import { Observable, throttleTime } from "rxjs";
import { IUploadClientActions, UploadClient } from "../models/client";

interface IFile extends File {
  id: string;
}

const AUTO_UPLOAD = true;

export interface IUploaderProps {
  actions: IUploadClientActions;
}

export const Uploader: React.FC<IUploaderProps> = ({ actions }) => {
  const [files, setFiles] = useState<IFile[]>([]);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const scrollContainer = scrollContainerRef.current;

  const onChange = useMemoizedFn((async (e) => {
    const files = Array.from(e.target.files ?? []).map(
      (file) => set(file, "id", uniqueId()) as IFile
    );

    setFiles((pre) => [...pre, ...files]);

    if (scrollContainer) {
      setTimeout(() => {
        (scrollContainer.lastChild as HTMLDivElement | null)?.scrollIntoView({
          behavior: "smooth",
        });
      }, 200);
    }
  }) satisfies React.ComponentProps<"input">["onChange"]);

  return (
    <div className="flex flex-col gap-4 border border-solid p-4">
      <Input multiple type="file" onChange={onChange} />

      <div ref={scrollContainerRef} className="h-64 overflow-auto">
        {files.map((file) => (
          <UploadSingleFile
            key={file.id}
            actions={actions}
            file={file}
            onRemove={() =>
              setFiles((pre) => pre.filter((x) => x.id !== file.id))
            }
          />
        ))}
      </div>
    </div>
  );
};

interface IUploaderStateProps {
  file: IFile;
  actions: IUploadClientActions;
  className?: string;
  onRemove?: () => void;
}
const UploadSingleFile = memo(function UploadSingleFile(
  props: IUploaderStateProps
) {
  const { file, actions, onRemove } = props;
  const needCreateRef = useRef(false);

  const client = useCreation(() => {
    console.log("new client");
    return new UploadClient(file, actions);
  }, [file, actions, needCreateRef.current]);

  useEffect(() => {
    client.start(AUTO_UPLOAD);
  }, [client]);

  const onPlay = useMemoizedFn(() => {
    client.startPool();
  });

  const onStop = useMemoizedFn(() => {
    client.stopPool();
  });

  const onRestart = useMemoizedFn(() => {
    client.restart(AUTO_UPLOAD);
  });

  const state = useObservable(
    client.state$.pipe(
      throttleTime(200, undefined, { leading: false, trailing: true })
    ),
    client.state$.value
  );
  const error = useObservable(client.error$, null);

  useEffect(() => {
    return () => {
      console.log("destroy");
      client.destroy();
      needCreateRef.current = true;
    };
  }, [client]);

  return mp(
    props,
    <div className="py-2">
      <div
        title={file.name}
        className="flex text-sm mb-2 justify-between gap-4"
      >
        <span className="truncate">{file.name}</span>
        <span className="whitespace-nowrap">
          {![UploadClient.EState.Default, UploadClient.EState.Error].includes(
            state
          ) && sentenceCase(UploadClient.EState[state])}

          {state === UploadClient.EState.Error && error ? (
            <span>{get(error, "message")}</span>
          ) : undefined}
        </span>
      </div>

      <div className="flex gap-2 items-center">
        <RxProgress value$={client.progress$} />
        <div className="w-16 flex items-center justify-center">
          <UploaderController
            state$={client.state$}
            onPlay={onPlay}
            onStop={onStop}
            onRestart={onRestart}
          />
        </div>
        <TrashIcon className="cursor-pointer" onClick={onRemove} />
      </div>
    </div>
  );
});

interface IUploaderControllerProps {
  onPlay?: () => void;
  onStop?: () => void;
  onRestart?: () => void;
  state$: UploadClient["state$"];
}
const UploaderController: React.FC<IUploaderControllerProps> = ({
  onPlay,
  onStop,
  onRestart,
  state$,
}) => {
  const state = useObservable(
    state$.pipe(
      throttleTime(200, undefined, { leading: false, trailing: true })
    ),
    state$.value
  );

  switch (state) {
    case UploadClient.EState.Default:
      return null;

    case UploadClient.EState.CalculatingHash:
      return <span className="text-xs">Analysis...</span>;

    case UploadClient.EState.WaitForUpload:
    case UploadClient.EState.UploadStopped:
      return <PlayIcon onClick={onPlay} className="cursor-pointer" />;

    case UploadClient.EState.Uploading:
      return <PauseIcon onClick={onStop} className="cursor-pointer" />;

    case UploadClient.EState.UploadSuccessfully:
      return (
        <div className="flex gap-2">
          <CheckIcon />
          <ReloadIcon onClick={onRestart} className="cursor-pointer" />
        </div>
      );

    case UploadClient.EState.FastUploaded:
      return <RocketIcon />;

    case UploadClient.EState.Error:
      return (
        <div className="flex gap-2">
          <ExclamationTriangleIcon color="red" />{" "}
          <ReloadIcon onClick={onRestart} className="cursor-pointer" />
        </div>
      );

    default:
      return <Loading />;
  }
};

interface IUploaderInfoProps {
  value$: Observable<number>;
}
const RxProgress: React.FC<IUploaderInfoProps> = ({ value$ }) => {
  const value = useObservable(value$, 0);

  return <Progress className="h-1 my-2" value={value} />;
};
